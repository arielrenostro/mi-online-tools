import type { DatalogRow, LogEntry } from '@/types/datalog'
import type { CorrectionFilterConfig } from '@/types/correction'

export const DELTA_WINDOW_MS = 200

/**
 * For each row, the amplitude (max - min) of the given signal within the
 * trailing `windowMs` ending at that row's timestamp. `rows` must be sorted
 * ascending by `timestamp_ms` and belong to a single log (log-local
 * timestamps, not the globally-offset concatenation). Shared by the TPS
 * delta and MAP delta filters — same windowed-amplitude mechanism, different
 * signal.
 *
 * Returns `null` for a row that doesn't yet have a full trailing window
 * (near the start of the log) — such a row is never excluded by a delta
 * filter using this function, regardless of its partial-window amplitude.
 */
export function computeDeltaAmplitude(rows: DatalogRow[], signal: string, windowMs = DELTA_WINDOW_MS): (number | null)[] {
  const n = rows.length
  const result: (number | null)[] = new Array(n).fill(null)
  const maxDeque: number[] = []
  const minDeque: number[] = []
  let left = 0

  for (let right = 0; right < n; right++) {
    const t = rows[right].timestamp_ms
    const v = rows[right][signal]

    while (rows[left].timestamp_ms < t - windowMs) {
      if (maxDeque[0] === left) maxDeque.shift()
      if (minDeque[0] === left) minDeque.shift()
      left++
    }

    if (!Number.isNaN(v)) {
      while (maxDeque.length && rows[maxDeque[maxDeque.length - 1]][signal] <= v) maxDeque.pop()
      maxDeque.push(right)
      while (minDeque.length && rows[minDeque[minDeque.length - 1]][signal] >= v) minDeque.pop()
      minDeque.push(right)
    }

    const hasFullWindow = t - rows[0].timestamp_ms >= windowMs
    if (hasFullWindow && maxDeque.length && minDeque.length) {
      result[right] = rows[maxDeque[0]][signal] - rows[minDeque[0]][signal]
    }
  }

  return result
}

/** Lambda Loop is "closed" for 1 (closed) and 2 (closed + auto-correção); 0 is open. */
function isClosedLoop(loop: number | undefined): boolean {
  return loop === 1 || loop === 2
}

/**
 * Shared skip-first-N-after-transition mechanism: excludes the first N points
 * (inclusive of the transition row itself) counted from each row where
 * `isEntry(prevLoop, loop)` becomes true. `rows` must be a single log's rows,
 * sorted ascending.
 */
function computeLoopTransitionSkipMask(
  rows: DatalogRow[],
  skipFirstN: number,
  isEntry: (prevLoop: number | undefined, loop: number) => boolean,
): boolean[] {
  const excluded = new Array<boolean>(rows.length).fill(false)
  if (skipFirstN <= 0) return excluded

  let prevLoop: number | undefined
  let countdown = 0
  for (let i = 0; i < rows.length; i++) {
    const loop = rows[i]['Lambda Loop']
    if (isEntry(prevLoop, loop)) countdown = skipFirstN
    if (countdown > 0) {
      excluded[i] = true
      countdown--
    }
    prevLoop = loop
  }
  return excluded
}

/**
 * For each row, whether it's excluded by the skip-first-N-after-closed-loop-
 * entry filter. The countdown (re)starts whenever the loop goes from open (0)
 * to either closed state (1 or 2) — toggling between 1 and 2 while staying
 * closed does not restart it.
 */
export function computeClosedLoopSkipMask(rows: DatalogRow[], skipFirstN: number): boolean[] {
  return computeLoopTransitionSkipMask(rows, skipFirstN, (prevLoop, loop) => prevLoop === 0 && isClosedLoop(loop))
}

/**
 * For each row, whether it's excluded by the skip-first-N-after-open-loop-
 * entry filter. The countdown (re)starts whenever the loop goes from either
 * closed state (1 or 2) to open (0).
 */
export function computeOpenLoopSkipMask(rows: DatalogRow[], skipFirstN: number): boolean[] {
  return computeLoopTransitionSkipMask(rows, skipFirstN, (prevLoop, loop) => isClosedLoop(prevLoop) && loop === 0)
}

function passesStatelessFilters(row: DatalogRow, filters: CorrectionFilterConfig): boolean {
  const loop = row['Lambda Loop'] as 0 | 1 | 2
  if (!filters.lambdaLoop.includes(loop)) return false
  if (row['CLT'] < filters.minClt) return false
  const lambda1 = row['Lambda 1']
  if (lambda1 < filters.minLambda || lambda1 > filters.maxLambda) return false
  if (Math.abs(lambda1 - row['Lambda Target']) > filters.maxDeltaLambdaTarget) return false
  return true
}

/** Evaluates every filter for one log's rows (sorted ascending, log-local timestamps). */
export function evaluateCorrectionFiltersForLog(rows: DatalogRow[], filters: CorrectionFilterConfig): boolean[] {
  if (rows.length === 0) return []
  const tpsDelta = computeDeltaAmplitude(rows, 'Pedal')
  const mapDelta = computeDeltaAmplitude(rows, 'MAP')
  const clSkip   = computeClosedLoopSkipMask(rows, filters.skipFirstClosedLoop)
  const olSkip   = computeOpenLoopSkipMask(rows, filters.skipFirstOpenLoop)

  return rows.map((row, i) => {
    if (clSkip[i]) return false
    if (olSkip[i]) return false
    if (!passesStatelessFilters(row, filters)) return false
    const tpsD = tpsDelta[i]
    if (tpsD !== null && tpsD > filters.maxDeltaTps) return false
    const mapD = mapDelta[i]
    if (mapD !== null && mapD > filters.maxDeltaMap) return false
    return true
  })
}

/**
 * Evaluates every correction filter across every active (enabled) log,
 * returning a flat boolean mask in the same order as `selectAllRows`
 * (active logs, each log's rows in order, concatenated).
 */
export function evaluateCorrectionFilters(logs: LogEntry[], filters: CorrectionFilterConfig): boolean[] {
  const result: boolean[] = []
  for (const log of logs) {
    if (!log.enabled) continue
    result.push(...evaluateCorrectionFiltersForLog(log.model.rows, filters))
  }
  return result
}
