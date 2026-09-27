import type { LogEntry, TimeSelection } from '@/types/datalog'
import type { CorrectionCell, CorrectionFilterConfig, CorrectionSnapshot } from '@/types/correction'
import { computeVeLambda } from '@/signals/veLambdaFormula'
import { evaluateCorrectionFilters } from './correctionFilters'
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

function makeGrid(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(0))
}

export function generateCorrectionSnapshot(
  logs: LogEntry[],
  filters: CorrectionFilterConfig,
  timeSelection: TimeSelection | null,
  mapBreakpoints: number[],
  rpmBreakpoints: number[],
): CorrectionSnapshot {
  const nRows = mapBreakpoints.length
  const nCols = rpmBreakpoints.length
  const weightSum        = makeGrid(nRows, nCols)
  const weightedValueSum = makeGrid(nRows, nCols)
  const valuesPerCell: number[][][] =
    Array.from({ length: nRows }, () => Array.from({ length: nCols }, () => [] as number[]))

  const activeLogs = logs.filter(l => l.enabled)
  const rows       = flattenActiveRows(logs)
  const passMask   = evaluateCorrectionFilters(logs, filters)

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

  const cells: CorrectionCell[][] = weightSum.map((row, rowI) =>
    row.map((n, colJ) => {
      if (n === 0) return { n: 0, mean: null, median: null }
      return {
        n,
        mean:   weightedValueSum[rowI][colJ] / n,
        median: median(valuesPerCell[rowI][colJ]),
      }
    })
  )

  return {
    cells,
    generatedAt: Date.now(),
    provenance: {
      logFilenames: activeLogs.map(l => l.filename),
      timeRange:    timeSelection,
      filters,
    },
  }
}
