import type { LogEntry, TimeSelection } from '@/types/datalog'
import { MODE_TOLERANCE } from '@/types/correction'
import type { CorrectionCell, CorrectionRun, RunLogRecipe } from '@/types/correction'
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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Approximate most frequent value: slide a window of width 2·MODE_TOLERANCE starting at each value,
 * keep the one with most points and return the mean of the points inside it. Ties go to the window
 * closest to the median, then to the lower value, so the result is deterministic.
 */
export function densestClusterMode(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const med    = median(sorted)
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

function makeGrid(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(0))
}

/**
 * Per-cell statistics of the VE Lambda values of every qualifying point: active logs, passing the
 * filter, inside the time selection (when there is one, in the concatenated timeline).
 */
export function computeCorrectionCells(
  logs: LogEntry[],
  filter: FilterConfig,
  timeSelection: TimeSelection | null,
  mapBreakpoints: number[],
  rpmBreakpoints: number[],
): CorrectionCell[][] {
  const nRows = mapBreakpoints.length
  const nCols = rpmBreakpoints.length
  const weightSum        = makeGrid(nRows, nCols)
  const weightedValueSum = makeGrid(nRows, nCols)
  const valuesPerCell: number[][][] =
    Array.from({ length: nRows }, () => Array.from({ length: nCols }, () => [] as number[]))

  const rows     = flattenActiveRows(logs)
  const passMask = evaluateFilterCached(logs, filter)

  for (let i = 0; i < rows.length; i++) {
    if (!passMask[i]) continue
    const row = rows[i]
    if (timeSelection && (row.timestamp_ms < timeSelection.start_ms || row.timestamp_ms > timeSelection.end_ms)) continue

    const veLambda = computeVeLambda(row)
    const weights  = bilinearWeights(row['MAP'], row['RPM'], mapBreakpoints, rpmBreakpoints)
    for (const { rowI, colJ, weight } of weights) {
      weightSum[rowI][colJ]        += weight
      weightedValueSum[rowI][colJ] += weight * veLambda
      valuesPerCell[rowI][colJ].push(veLambda)
    }
  }

  return weightSum.map((row, rowI) =>
    row.map((n, colJ) => {
      if (n === 0) return { n: 0, mean: null, median: null, mode: null }
      return {
        n,
        mean:   weightedValueSum[rowI][colJ] / n,
        median: median(valuesPerCell[rowI][colJ]),
        mode:   densestClusterMode(valuesPerCell[rowI][colJ]),
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
    cells:       computeCorrectionCells(logs, filter, timeSelection, mapBreakpoints, rpmBreakpoints),
    recipe:      { logs: toPerLogRanges(timeSelection, logs), filter: cloneFilter(filter) },
  }
}
