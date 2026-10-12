import type { DatalogRow, LogEntry } from '@/types/datalog'
import { FILTER_RANGE_SIGNALS, type FilterConfig } from '@/types/filter'

export const DELTA_WINDOW_MS = 200

/**
 * Sliding-window amplitude (max - min) of `signal`, one value per row. `rows` is a single log's rows,
 * sorted ascending. `evicts(left, right)` says whether row `left` has left the window ending at row
 * `right`; `hasFullWindow(right)` says whether that window is complete — rows without a full window
 * get `null` (never excluded by a criterion built on this). NaN values are ignored.
 */
function slidingAmplitude(
  rows: DatalogRow[],
  signal: string,
  evicts: (left: number, right: number) => boolean,
  hasFullWindow: (right: number) => boolean,
): (number | null)[] {
  const n = rows.length
  const result: (number | null)[] = new Array(n).fill(null)
  const maxDeque: number[] = []
  const minDeque: number[] = []
  let left = 0

  for (let right = 0; right < n; right++) {
    const v = rows[right][signal]

    while (evicts(left, right)) {
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

    if (hasFullWindow(right) && maxDeque.length && minDeque.length) {
      result[right] = rows[maxDeque[0]][signal] - rows[minDeque[0]][signal]
    }
  }

  return result
}

/**
 * For each row, the amplitude (max - min) of the given signal within the
 * trailing `windowMs` ending at that row's timestamp. `rows` must be sorted
 * ascending by `timestamp_ms` and belong to a single log (log-local
 * timestamps, not the globally-offset concatenation). Shared by the TPS
 * delta and MAP delta filters — same windowed-amplitude mechanism, different
 * signal — and by the step detection of the Pedal/MAP hold-offs.
 *
 * Returns `null` for a row that doesn't yet have a full trailing window
 * (near the start of the log) — such a row is never excluded by a delta
 * filter using this function, regardless of its partial-window amplitude.
 */
export function computeDeltaAmplitude(rows: DatalogRow[], signal: string, windowMs = DELTA_WINDOW_MS): (number | null)[] {
  return slidingAmplitude(
    rows, signal,
    (left, right) => rows[left].timestamp_ms < rows[right].timestamp_ms - windowMs,
    right => rows[right].timestamp_ms - rows[0].timestamp_ms >= windowMs,
  )
}

/**
 * For each row, the amplitude (max - min) of `signal` over the trailing window of `n` points (the row
 * itself and the n - 1 before it). `null` for the first n - 1 rows (no full window) and for any
 * `n < 2`. Used by the Pedal/MAP stability criteria.
 */
export function computeCountAmplitude(rows: DatalogRow[], signal: string, n: number): (number | null)[] {
  if (!Number.isInteger(n) || n < 2) return new Array(rows.length).fill(null)
  return slidingAmplitude(rows, signal, (left, right) => right - left >= n, right => right >= n - 1)
}

/**
 * Hold-off: excludes each event row and the `n` rows after the LAST event row, so a transient lasting
 * several rows starts counting its `n` only when it ends, and a new event inside a hold extends it.
 */
export function computeHoldMask(isEvent: boolean[], n: number): boolean[] {
  const excluded = new Array<boolean>(isEvent.length).fill(false)
  let lastEventIdx = -1
  for (let i = 0; i < isEvent.length; i++) {
    if (isEvent[i]) lastEventIdx = i
    if (lastEventIdx >= 0 && i - lastEventIdx <= n) excluded[i] = true
  }
  return excluded
}

/** Rows where the 200 ms amplitude of `signal` is above `step` — the start (and body) of a pedal/MAP step. */
export function computeStepEvents(rows: DatalogRow[], signal: string, step: number): boolean[] {
  return computeDeltaAmplitude(rows, signal).map(a => a !== null && a > step)
}

/**
 * Rows where Marcha differs from the last numeric Marcha before them. A row without a number (or a log
 * without the Marcha column) is never an event and does not reset the reference.
 */
export function computeGearChangeEvents(rows: DatalogRow[]): boolean[] {
  const events = new Array<boolean>(rows.length).fill(false)
  let prev: number | undefined
  for (let i = 0; i < rows.length; i++) {
    const gear = rows[i]['Marcha']
    if (typeof gear !== 'number' || Number.isNaN(gear)) continue
    if (prev !== undefined && gear !== prev) events[i] = true
    prev = gear
  }
  return events
}

/** Lambda Loop is "closed" for 1 (closed) and 2 (closed + auto-correção); 0 is open. */
function isClosedLoop(loop: number | undefined): boolean {
  return loop === 1 || loop === 2
}

type TransitionPredicate = (prevLoop: number | undefined, loop: number) => boolean

/** Open (0) to either closed state (1 or 2). Toggling 1↔2 is not a transition. */
const entersClosedLoop: TransitionPredicate = (prevLoop, loop) => prevLoop === 0 && isClosedLoop(loop)
/** Either closed state (1 or 2) to open (0). */
const entersOpenLoop: TransitionPredicate = (prevLoop, loop) => isClosedLoop(prevLoop) && loop === 0

/**
 * Shared skip-first-N-after-transition mechanism: excludes the first N points
 * (inclusive of the transition row itself) counted from each row where
 * `isEntry(prevLoop, loop)` becomes true. `rows` must be a single log's rows,
 * sorted ascending.
 */
function computeLoopTransitionSkipMask(
  rows: DatalogRow[],
  skipFirstN: number,
  isEntry: TransitionPredicate,
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
  return computeLoopTransitionSkipMask(rows, skipFirstN, entersClosedLoop)
}

/**
 * For each row, whether it's excluded by the skip-first-N-after-open-loop-
 * entry filter. The countdown (re)starts whenever the loop goes from either
 * closed state (1 or 2) to open (0).
 */
export function computeOpenLoopSkipMask(rows: DatalogRow[], skipFirstN: number): boolean[] {
  return computeLoopTransitionSkipMask(rows, skipFirstN, entersOpenLoop)
}

/**
 * Shared skip-last-N-before-transition mechanism: excludes the N points immediately preceding each
 * row where `isEntry(prevLoop, loop)` becomes true (the transition row itself is not excluded).
 * `rows` must be a single log's rows, sorted ascending; a window never extends past the log start.
 */
function computeLoopTransitionSkipBeforeMask(
  rows: DatalogRow[],
  skipLastN: number,
  isEntry: TransitionPredicate,
): boolean[] {
  const excluded = new Array<boolean>(rows.length).fill(false)
  if (skipLastN <= 0) return excluded

  for (let i = 1; i < rows.length; i++) {
    if (!isEntry(rows[i - 1]['Lambda Loop'], rows[i]['Lambda Loop'])) continue
    for (let j = Math.max(0, i - skipLastN); j < i; j++) excluded[j] = true
  }
  return excluded
}

/** For each row, whether it is one of the N points right before a transition into closed loop. */
export function computeClosedLoopSkipBeforeMask(rows: DatalogRow[], skipLastN: number): boolean[] {
  return computeLoopTransitionSkipBeforeMask(rows, skipLastN, entersClosedLoop)
}

/** For each row, whether it is one of the N points right before a transition into open loop. */
export function computeOpenLoopSkipBeforeMask(rows: DatalogRow[], skipLastN: number): boolean[] {
  return computeLoopTransitionSkipBeforeMask(rows, skipLastN, entersOpenLoop)
}

interface ActiveRange { sig: typeof FILTER_RANGE_SIGNALS[number]; min: number | null; max: number | null }

function isNum(v: unknown): v is number {
  return typeof v === 'number' && !Number.isNaN(v)
}

/**
 * Evaluates the filter for one log's rows (sorted ascending, log-local timestamps). Enabled criteria
 * combine with AND; a row without a numeric value for an enabled range's signal (or for Lambda Loop,
 * or for Lambda 1 / Lambda Target when the |Δλ×alvo| limit is enabled) fails. The windowed,
 * transition, hold-off and stability criteria are only computed when enabled.
 */
export function evaluateFilterForLog(rows: DatalogRow[], filter: FilterConfig): boolean[] {
  if (rows.length === 0) return []

  const ranges: ActiveRange[] = FILTER_RANGE_SIGNALS
    .filter(sig => filter.ranges[sig].enabled)
    .map(sig => ({ sig, min: filter.ranges[sig].min, max: filter.ranges[sig].max }))
  const loopStates = filter.lambdaLoop.enabled ? filter.lambdaLoop.states : null
  const lambdaTargetMax = filter.maxDeltaLambdaTarget.enabled ? filter.maxDeltaLambdaTarget.value : null

  const tpsDelta = filter.maxDeltaTps.enabled ? computeDeltaAmplitude(rows, 'Pedal') : null
  const mapDelta = filter.maxDeltaMap.enabled ? computeDeltaAmplitude(rows, 'MAP') : null
  const clSkip   = filter.skipClosed.enabled ? computeClosedLoopSkipMask(rows, filter.skipClosed.n) : null
  const olSkip   = filter.skipOpen.enabled ? computeOpenLoopSkipMask(rows, filter.skipOpen.n) : null
  const clBefore = filter.skipBeforeClosed.enabled ? computeClosedLoopSkipBeforeMask(rows, filter.skipBeforeClosed.n) : null
  const olBefore = filter.skipBeforeOpen.enabled ? computeOpenLoopSkipBeforeMask(rows, filter.skipBeforeOpen.n) : null
  const pedalHold = filter.holdPedal.enabled ? computeHoldMask(computeStepEvents(rows, 'Pedal', filter.holdPedal.value), filter.holdPedal.n) : null
  const mapHold   = filter.holdMap.enabled ? computeHoldMask(computeStepEvents(rows, 'MAP', filter.holdMap.value), filter.holdMap.n) : null
  const gearHold  = filter.holdGear.enabled ? computeHoldMask(computeGearChangeEvents(rows), filter.holdGear.n) : null
  const pedalWin  = filter.stablePedal.enabled ? computeCountAmplitude(rows, 'Pedal', filter.stablePedal.n) : null
  const mapWin    = filter.stableMap.enabled ? computeCountAmplitude(rows, 'MAP', filter.stableMap.n) : null

  return rows.map((row, i) => {
    if (clSkip?.[i]) return false
    if (olSkip?.[i]) return false
    if (clBefore?.[i]) return false
    if (olBefore?.[i]) return false
    if (pedalHold?.[i] || mapHold?.[i] || gearHold?.[i]) return false
    if (loopStates && !loopStates.includes(row['Lambda Loop'] as 0 | 1 | 2)) return false
    for (const { sig, min, max } of ranges) {
      const v = row[sig]
      if (!isNum(v)) return false
      if (min !== null && v < min) return false
      if (max !== null && v > max) return false
    }
    if (lambdaTargetMax !== null) {
      const lambda1 = row['Lambda 1']
      const target  = row['Lambda Target']
      if (!isNum(lambda1) || !isNum(target)) return false
      if (Math.abs(lambda1 - target) > lambdaTargetMax) return false
    }
    const tpsD = tpsDelta?.[i]
    if (tpsD != null && tpsD > filter.maxDeltaTps.value) return false
    const mapD = mapDelta?.[i]
    if (mapD != null && mapD > filter.maxDeltaMap.value) return false
    const pedalW = pedalWin?.[i]
    if (pedalW != null && pedalW > filter.stablePedal.value) return false
    const mapW = mapWin?.[i]
    if (mapW != null && mapW > filter.stableMap.value) return false
    return true
  })
}

/**
 * Evaluates the filter across every active (enabled) log, returning a flat boolean mask in the same
 * order as `selectAllRows` (active logs, each log's rows in order, concatenated).
 */
export function evaluateFilter(logs: LogEntry[], filter: FilterConfig): boolean[] {
  const result: boolean[] = []
  for (const log of logs) {
    if (!log.enabled) continue
    const part = evaluateFilterForLog(log.model.rows, filter)
    for (let i = 0; i < part.length; i++) result.push(part[i])
  }
  return result
}

let lastMask: { logs: LogEntry[]; filter: FilterConfig; mask: boolean[] } | null = null

/**
 * `evaluateFilter` with a one-entry cache keyed by the identity of `logs` and `filter`, so the many
 * consumers of the applied filter (tabs, header button, generation) share one evaluation. Pass only
 * objects held by the stores — a throwaway filter (e.g. a draft preview) would just thrash the entry.
 */
export function evaluateFilterCached(logs: LogEntry[], filter: FilterConfig): boolean[] {
  if (lastMask && lastMask.logs === logs && lastMask.filter === filter) return lastMask.mask
  const mask = evaluateFilter(logs, filter)
  lastMask = { logs, filter, mask }
  return mask
}
