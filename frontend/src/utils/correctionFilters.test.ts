import { describe, it, expect } from 'vitest'
import {
  computeDeltaAmplitude,
  computeClosedLoopSkipMask,
  computeOpenLoopSkipMask,
  evaluateCorrectionFiltersForLog,
  evaluateCorrectionFilters,
} from './correctionFilters'
import { DEFAULT_CORRECTION_FILTERS } from '@/types/correction'
import type { LambdaLoopState } from '@/types/correction'
import type { DatalogRow } from '@/types/datalog'
import type { LogEntry } from '@/types/datalog'

function row(ts: number, overrides: Partial<DatalogRow> = {}): DatalogRow {
  return {
    timestamp_ms:    ts,
    'RPM':           3000,
    'MAP':           80,
    'Lambda 1':      1.0,
    'Lambda Target': 1.0,
    'Lambda Corr':   0,
    'VE':            50,
    'CLT':           90,
    'Lambda Loop':   1,
    'Pedal':         0,
    ...overrides,
  }
}

describe('computeDeltaAmplitude', () => {
  it('returns null (insufficient history) for rows within the first 200ms of the log', () => {
    const rows = [row(0, { Pedal: 0 }), row(50, { Pedal: 50 }), row(100, { Pedal: 0 })]
    const result = computeDeltaAmplitude(rows, 'Pedal')
    expect(result).toEqual([null, null, null])
  })

  it('computes the max-min amplitude within the trailing 200ms window once history is available', () => {
    const rows = [
      row(0,   { Pedal: 0 }),
      row(100, { Pedal: 80 }),
      row(200, { Pedal: 10 }),   // window [0,200]: pedal values 0,80,10 -> amplitude 80
      row(400, { Pedal: 12 }),   // window [200,400]: pedal values 10,12 -> amplitude 2 (row@0 aged out)
    ]
    const result = computeDeltaAmplitude(rows, 'Pedal')
    expect(result[2]).toBeCloseTo(80, 6)
    expect(result[3]).toBeCloseTo(2, 6)
  })

  it('ignores rows with a NaN value when computing the window extremes', () => {
    const rows = [
      row(0,   { Pedal: 0 }),
      row(100, { Pedal: NaN }),
      row(200, { Pedal: 5 }),
    ]
    const result = computeDeltaAmplitude(rows, 'Pedal')
    expect(result[2]).toBeCloseTo(5, 6)
  })

  it('works the same way for the MAP signal (shared mechanism)', () => {
    const rows = [
      row(0,   { MAP: 40 }),
      row(100, { MAP: 90 }),
      row(200, { MAP: 45 }), // window [0,200]: 40,90,45 -> amplitude 50
    ]
    const result = computeDeltaAmplitude(rows, 'MAP')
    expect(result[2]).toBeCloseTo(50, 6)
  })
})

describe('computeClosedLoopSkipMask', () => {
  it('excludes the N points starting at each open->closed transition', () => {
    const rows = [
      row(0,   { 'Lambda Loop': 0 }),
      row(100, { 'Lambda Loop': 1 }), // transition -> excluded (1 of 2)
      row(200, { 'Lambda Loop': 1 }), // excluded (2 of 2)
      row(300, { 'Lambda Loop': 1 }), // qualifies again
      row(400, { 'Lambda Loop': 0 }),
      row(500, { 'Lambda Loop': 1 }), // new transition -> excluded again
    ]
    const mask = computeClosedLoopSkipMask(rows, 2)
    expect(mask).toEqual([false, true, true, false, false, true])
  })

  it('treats a transition into state 2 (closed + auto-correção) the same as into state 1', () => {
    const rows = [
      row(0,   { 'Lambda Loop': 0 }),
      row(100, { 'Lambda Loop': 2 }), // open->closed(auto-correção) transition -> excluded
      row(200, { 'Lambda Loop': 1 }), // still counting down, toggling to plain closed doesn't restart it
      row(300, { 'Lambda Loop': 2 }), // countdown exhausted -> qualifies again
    ]
    const mask = computeClosedLoopSkipMask(rows, 2)
    expect(mask).toEqual([false, true, true, false])
  })

  it('excludes nothing when skipFirstN is 0', () => {
    const rows = [row(0, { 'Lambda Loop': 0 }), row(100, { 'Lambda Loop': 1 })]
    expect(computeClosedLoopSkipMask(rows, 0)).toEqual([false, false])
  })
})

describe('computeOpenLoopSkipMask', () => {
  it('excludes the N points starting at each closed->open transition, from either closed state', () => {
    const rows = [
      row(0,   { 'Lambda Loop': 1 }),
      row(100, { 'Lambda Loop': 0 }), // closed->open transition -> excluded (1 of 2)
      row(200, { 'Lambda Loop': 0 }), // excluded (2 of 2)
      row(300, { 'Lambda Loop': 0 }), // qualifies again
      row(400, { 'Lambda Loop': 2 }),
      row(500, { 'Lambda Loop': 0 }), // new transition (from state 2) -> excluded again
    ]
    const mask = computeOpenLoopSkipMask(rows, 2)
    expect(mask).toEqual([false, true, true, false, false, true])
  })

  it('does not restart the countdown when toggling between the two closed states', () => {
    const rows = [
      row(0,   { 'Lambda Loop': 1 }),
      row(100, { 'Lambda Loop': 2 }), // still closed, no open-loop transition
      row(200, { 'Lambda Loop': 0 }), // transition -> excluded
    ]
    expect(computeOpenLoopSkipMask(rows, 1)).toEqual([false, false, true])
  })

  it('excludes nothing when skipFirstN is 0', () => {
    const rows = [row(0, { 'Lambda Loop': 1 }), row(100, { 'Lambda Loop': 0 })]
    expect(computeOpenLoopSkipMask(rows, 0)).toEqual([false, false])
  })
})

describe('evaluateCorrectionFiltersForLog', () => {
  it('passes a row that satisfies every default threshold', () => {
    const rows = [row(0), row(100), row(200)]
    expect(evaluateCorrectionFiltersForLog(rows, DEFAULT_CORRECTION_FILTERS)).toEqual([true, true, true])
  })

  it('passes Lambda Loop state 2 (closed + auto-correção) by default', () => {
    const rows = [row(0, { 'Lambda Loop': 2 })]
    expect(evaluateCorrectionFiltersForLog(rows, DEFAULT_CORRECTION_FILTERS)).toEqual([true])
  })

  it('excludes a point outside the Lambda Loop selection', () => {
    const rows = [row(0, { 'Lambda Loop': 0 })]
    const filters = { ...DEFAULT_CORRECTION_FILTERS, lambdaLoop: [1 as const] }
    expect(evaluateCorrectionFiltersForLog(rows, filters)).toEqual([false])
  })

  it('excludes a point below the minimum CLT', () => {
    const rows = [row(0, { CLT: 50 })]
    const filters = { ...DEFAULT_CORRECTION_FILTERS, minClt: 80 }
    expect(evaluateCorrectionFiltersForLog(rows, filters)).toEqual([false])
  })

  it('excludes a point outside the min/max Lambda range', () => {
    const rows = [row(0, { 'Lambda 1': 1.2 })]
    const filters = { ...DEFAULT_CORRECTION_FILTERS, maxLambda: 1.09 }
    expect(evaluateCorrectionFiltersForLog(rows, filters)).toEqual([false])
  })

  it('excludes a point during a rapid MAP transient (boost spike/lift)', () => {
    const rows = [
      row(0,   { MAP: 40 }),
      row(100, { MAP: 100 }),
      row(200, { MAP: 38 }), // full 200ms window now available: amplitude 100-38=62 > 5 -> excluded
    ]
    const filters = { ...DEFAULT_CORRECTION_FILTERS, maxDeltaMap: 5 }
    expect(evaluateCorrectionFiltersForLog(rows, filters)).toEqual([true, true, false])
  })

  it('excludes a point whose lambda deviates too much from target', () => {
    const rows = [row(0, { 'Lambda 1': 1.3, 'Lambda Target': 1.0 })]
    const filters = { ...DEFAULT_CORRECTION_FILTERS, maxDeltaLambdaTarget: 0.2 }
    expect(evaluateCorrectionFiltersForLog(rows, filters)).toEqual([false])
  })

  it('combines filters with AND semantics', () => {
    const rows = [row(0, { CLT: 50, 'Lambda 1': 1.2 })]
    const filters = { ...DEFAULT_CORRECTION_FILTERS, minClt: 80, maxLambda: 1.09 }
    // fails both — still just excluded once
    expect(evaluateCorrectionFiltersForLog(rows, filters)).toEqual([false])
  })
})

describe('evaluateCorrectionFilters', () => {
  function makeLog(hash: string, rows: DatalogRow[], enabled = true): LogEntry {
    return {
      hash, filename: `${hash}.csv`, enabled,
      duration_ms: rows[rows.length - 1]?.timestamp_ms ?? 0,
      model: { hash, filename: `${hash}.csv`, rows, duration_ms: 0, signals: [] },
    }
  }

  it('concatenates results across active logs, skipping disabled ones, per-log for stateful filters', () => {
    // logA ends mid-countdown (skip=3, only 1 of 3 points consumed before the log ends).
    // logC starts already-closed with no transition of its own — if the countdown incorrectly
    // carried over from logA, logC's rows would wrongly be excluded too.
    const logA = makeLog('a', [row(0, { 'Lambda Loop': 0 }), row(100, { 'Lambda Loop': 1 })])
    const logB = makeLog('b', [row(0, { 'Lambda Loop': 0 }), row(100, { 'Lambda Loop': 1 })], false)
    const logC = makeLog('c', [row(0, { 'Lambda Loop': 1 }), row(100, { 'Lambda Loop': 1 })])

    // lambdaLoop restored to permissive here so the open-loop row (logA[0]) isn't also
    // excluded by the loop-selection filter, keeping this test isolated to skip-mask behavior
    const filters = { ...DEFAULT_CORRECTION_FILTERS, lambdaLoop: [0, 1, 2] as LambdaLoopState[], skipFirstClosedLoop: 3 }
    const mask = evaluateCorrectionFilters([logA, logB, logC], filters)
    // logB disabled -> excluded from output entirely
    expect(mask).toEqual([true, false, true, true])
  })
})
