import type { LogEntry, TimeSelection } from '@/types/datalog'
import { MODE_TOLERANCE, breakpointsEqual, runHasSamples } from '@/types/correction'
import type { CorrectionCell, CorrectionRun, RunBreakpoints, RunLogRecipe } from '@/types/correction'
import { cloneFilter, type FilterConfig } from '@/types/filter'
import { computeVeLambda } from '@/signals/veLambdaFormula'
import { evaluateFilterCached } from './filter'
import { flattenActiveRows } from '@/store/logStore'

interface CellWeight { rowI: number; colJ: number; weight: number }

type Bracket =
  | { exactIndex: number }
  | { loIndex: number; hiIndex: number; frac: number } // frac 0 at loIndex's value, 1 at hiIndex's value

function locate(breakpoints: number[], value: number): Bracket | null {
  const n = breakpoints.length
  const minVal = Math.min(breakpoints[0], breakpoints[n - 1])
  const maxVal = Math.max(breakpoints[0], breakpoints[n - 1])
  if (value < minVal || value > maxVal) return null

  for (let i = 0; i < n; i++) {
    if (breakpoints[i] === value) return { exactIndex: i }
  }

  for (let i = 0; i < n - 1; i++) {
    const a = breakpoints[i], b = breakpoints[i + 1]
    const lo = Math.min(a, b), hi = Math.max(a, b)
    if (value > lo && value < hi) {
      const loIndex = a <= b ? i : i + 1
      const hiIndex = a <= b ? i + 1 : i
      return { loIndex, hiIndex, frac: (value - lo) / (hi - lo) }
    }
  }
  return null
}

function bracketParts(bracket: Bracket): { index: number; w: number }[] {
  if ('exactIndex' in bracket) return [{ index: bracket.exactIndex, w: 1 }]
  return [
    { index: bracket.loIndex, w: 1 - bracket.frac },
    { index: bracket.hiIndex, w: bracket.frac },
  ]
}

/**
 * Bilinear attribution of one point to the map's cells, matching how the ECU
 * itself reads the table (up to 4 cells; fewer on an exact breakpoint match).
 * Returns [] when the point falls outside the map's MAP or RPM range.
 */
export function bilinearWeights(
  mapKpa: number, rpm: number,
  mapBreakpoints: number[], rpmBreakpoints: number[],
): CellWeight[] {
  const mapBracket = locate(mapBreakpoints, mapKpa)
  const rpmBracket = locate(rpmBreakpoints, rpm)
  if (mapBracket === null || rpmBracket === null) return []

  const result: CellWeight[] = []
  for (const mp of bracketParts(mapBracket)) {
    for (const rp of bracketParts(rpmBracket)) {
      const weight = mp.w * rp.w
      if (weight > 0) result.push({ rowI: mp.index, colJ: rp.index, weight })
    }
  }
  return result
}

function medianOfSorted(sorted: ArrayLike<number>): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Approximate most frequent value (of per-point ratios): slide a window of width 2·MODE_TOLERANCE starting at each value,
 * keep the one with most points and return the mean of the points inside it. Ties go to the window
 * closest to the median, then to the lower value, so the result is deterministic.
 */
export function densestClusterMode(values: number[]): number {
  return densestClusterModeOfSorted(Float64Array.from(values).sort())
}

function densestClusterModeOfSorted(sorted: Float64Array): number {
  const med    = medianOfSorted(sorted)
  const width  = 2 * MODE_TOLERANCE + 1e-9
  let best: { count: number; mean: number } | null = null
  let j = 0
  let sum = 0
  for (let i = 0; i < sorted.length; i++) {
    if (j < i) { j = i; sum = 0 }
    while (j < sorted.length && sorted[j] - sorted[i] <= width) { sum += sorted[j]; j++ }
    const count = j - i
    const mean  = sum / count
    if (
      best === null || count > best.count ||
      (count === best.count && Math.abs(mean - med) < Math.abs(best.mean - med))
    ) best = { count, mean }
    sum -= sorted[i]
  }
  return best!.mean
}

/** Map cells are raw VE (%×10); VE Lambda is in real %. */
const RAW_VE_PER_PERCENT = 10

const EMPTY_CELL: CorrectionCell = { n: 0, mean: null, median: null, mode: null }

/** Number of values per sample in `CorrectionRun.samples`: MAP, RPM, VE Lambda. */
const SAMPLE_STRIDE = 3

/**
 * The samples of every qualifying point: active logs, passing the filter, inside the time selection
 * (when there is one, in the concatenated timeline) and inside the map's MAP and RPM range. Layout is
 * `[MAP, RPM, VE Lambda, …]`. Points without a finite VE Lambda are dropped.
 */
export function collectSamples(
  logs: LogEntry[],
  filter: FilterConfig,
  timeSelection: TimeSelection | null,
  mapBreakpoints: number[],
  rpmBreakpoints: number[],
): Float64Array {
  const rows     = flattenActiveRows(logs)
  const passMask = evaluateFilterCached(logs, filter)
  const out: number[] = []

  for (let i = 0; i < rows.length; i++) {
    if (!passMask[i]) continue
    const row = rows[i]
    if (timeSelection && (row.timestamp_ms < timeSelection.start_ms || row.timestamp_ms > timeSelection.end_ms)) continue

    const veLambda = computeVeLambda(row)
    if (!Number.isFinite(veLambda)) continue
    const mapKpa = row['MAP'], rpm = row['RPM']
    if (locate(mapBreakpoints, mapKpa) === null || locate(rpmBreakpoints, rpm) === null) continue
    out.push(mapKpa, rpm, veLambda)
  }
  return Float64Array.from(out)
}

/** Per sample, the (up to 4) cells it touches and their bilinear weights — independent of the map's values. */
interface SamplePlan {
  breakpoints: RunBreakpoints
  count:       number
  /** 4 entries per sample: flat cell index `rowI * nCols + colJ`, or -1 for padding. */
  cellIdx:     Int32Array
  weight:      Float64Array
}

const planCache = new WeakMap<Float64Array, SamplePlan>()

function getPlan(samples: Float64Array, breakpoints: RunBreakpoints): SamplePlan {
  const cached = planCache.get(samples)
  if (cached && breakpointsEqual(cached.breakpoints, breakpoints)) return cached

  const nCols = breakpoints.rpm.length
  const count = Math.floor(samples.length / SAMPLE_STRIDE)
  const cellIdx = new Int32Array(count * 4).fill(-1)
  const weight  = new Float64Array(count * 4)
  for (let s = 0; s < count; s++) {
    const ws = bilinearWeights(samples[s * SAMPLE_STRIDE], samples[s * SAMPLE_STRIDE + 1], breakpoints.map, breakpoints.rpm)
    for (let k = 0; k < ws.length; k++) {
      cellIdx[s * 4 + k] = ws[k].rowI * nCols + ws[k].colJ
      weight[s * 4 + k]  = ws[k].weight
    }
  }
  const plan = { breakpoints: { map: [...breakpoints.map], rpm: [...breakpoints.rpm] }, count, cellIdx, weight }
  planCache.set(samples, plan)
  return plan
}

/**
 * Per-cell statistics of a run against the map now loaded. Each sample is turned into a ratio — its VE
 * Lambda over the VE the map gives at the sample's own MAP and RPM (the map interpolated with the same
 * four bilinear weights that attribute the sample to cells) — so the map's slope across a cell's
 * neighbourhood does not leak into the cell's value. `mean` is weighted by the bilinear weights, `median`
 * and `mode` are not; all three are factors (1.02 = +2%). A sample whose interpolated map value is not
 * positive is discarded and does not count in `n`.
 *
 * `editableMap` is raw VE (%×10) with the run's grid shape.
 */
export function deriveCells(
  run: Pick<CorrectionRun, 'samples' | 'breakpoints'>,
  editableMap: number[][],
): CorrectionCell[][] {
  const nRows = run.breakpoints.map.length
  const nCols = run.breakpoints.rpm.length
  const emptyGrid = () => Array.from({ length: nRows }, () => Array.from({ length: nCols }, () => ({ ...EMPTY_CELL })))
  if (!runHasSamples(run)) return emptyGrid()

  const plan   = getPlan(run.samples!, run.breakpoints)
  const mapVe  = new Float64Array(nRows * nCols)
  for (let r = 0; r < nRows; r++) for (let c = 0; c < nCols; c++) mapVe[r * nCols + c] = (editableMap[r]?.[c] ?? 0) / RAW_VE_PER_PERCENT

  const cellCount        = nRows * nCols
  const weightSum        = new Float64Array(cellCount)
  const weightedRatioSum = new Float64Array(cellCount)
  const ratiosPerCell: number[][] = Array.from({ length: cellCount }, () => [])

  for (let s = 0; s < plan.count; s++) {
    let interpolated = 0
    for (let k = 0; k < 4; k++) {
      const idx = plan.cellIdx[s * 4 + k]
      if (idx >= 0) interpolated += plan.weight[s * 4 + k] * mapVe[idx]
    }
    if (!(interpolated > 0)) continue
    const ratio = run.samples![s * SAMPLE_STRIDE + 2] / interpolated
    for (let k = 0; k < 4; k++) {
      const idx = plan.cellIdx[s * 4 + k]
      if (idx < 0) continue
      const w = plan.weight[s * 4 + k]
      weightSum[idx]        += w
      weightedRatioSum[idx] += w * ratio
      ratiosPerCell[idx].push(ratio)
    }
  }

  return Array.from({ length: nRows }, (_, r) =>
    Array.from({ length: nCols }, (_, c): CorrectionCell => {
      const idx = r * nCols + c
      if (weightSum[idx] === 0) return { ...EMPTY_CELL }
      // One numeric sort per cell feeds both the median and the mode (sorting dominates the cost).
      const sorted = Float64Array.from(ratiosPerCell[idx]).sort()
      return {
        n:      weightSum[idx],
        mean:   weightedRatioSum[idx] / weightSum[idx],
        median: medianOfSorted(sorted),
        mode:   densestClusterModeOfSorted(sorted),
      }
    })
  )
}

/**
 * Turns the time selection (global ms over the concatenated active logs) into one entry per active
 * log: used in full, not used, or an interval in that log's own milliseconds. Recorded in the run so
 * reordering or deactivating logs later does not change what it says it used.
 */
export function toPerLogRanges(selection: TimeSelection | null, logs: LogEntry[]): RunLogRecipe[] {
  const recipe: RunLogRecipe[] = []
  let offset = 0
  for (const log of logs) {
    if (!log.enabled) continue
    const start = offset
    const end   = offset + log.duration_ms
    offset = end
    if (selection === null) { recipe.push({ hash: log.hash, filename: log.filename, range: 'full' }); continue }
    const from = Math.max(selection.start_ms, start)
    const to   = Math.min(selection.end_ms, end)
    if (to <= from) recipe.push({ hash: log.hash, filename: log.filename, range: 'unused' })
    else if (from <= start && to >= end) recipe.push({ hash: log.hash, filename: log.filename, range: 'full' })
    else recipe.push({ hash: log.hash, filename: log.filename, range: { start_ms: from - start, end_ms: to - start } })
  }
  return recipe
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Default run name: creation date and time, e.g. `08/10/2026 14:32`. */
export function defaultRunName(createdAt: number): string {
  const d = new Date(createdAt)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function newRunId(createdAt: number): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
  return `run-${createdAt}-${rnd}`
}

export function generateCorrectionRun(
  logs: LogEntry[],
  filter: FilterConfig,
  timeSelection: TimeSelection | null,
  mapBreakpoints: number[],
  rpmBreakpoints: number[],
  createdAt = Date.now(),
): CorrectionRun {
  return {
    id:          newRunId(createdAt),
    name:        defaultRunName(createdAt),
    createdAt,
    breakpoints: { map: [...mapBreakpoints], rpm: [...rpmBreakpoints] },
    samples:     collectSamples(logs, filter, timeSelection, mapBreakpoints, rpmBreakpoints),
    recipe:      { logs: toPerLogRanges(timeSelection, logs), filter: cloneFilter(filter) },
  }
}
