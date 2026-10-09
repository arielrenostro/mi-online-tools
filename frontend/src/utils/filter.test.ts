import { describe, it, expect } from 'vitest'
import {
  computeDeltaAmplitude,
  computeClosedLoopSkipMask,
  computeOpenLoopSkipMask,
  computeClosedLoopSkipBeforeMask,
  computeOpenLoopSkipBeforeMask,
  evaluateFilterForLog,
  evaluateFilter,
} from './filter'
import { cloneFilter, DEFAULT_FILTER, type FilterConfig } from '@/types/filter'
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

describe('computeClosedLoopSkipBeforeMask', () => {
  it('excludes the N points right before each open->closed transition, not the transition point', () => {
    const rows = [
      row(0,   { 'Lambda Loop': 0 }),
      row(100, { 'Lambda Loop': 0 }), // excluded (2nd before)
      row(200, { 'Lambda Loop': 0 }), // excluded (1st before)
      row(300, { 'Lambda Loop': 1 }), // transition point -> kept
      row(400, { 'Lambda Loop': 1 }),
    ]
    expect(computeClosedLoopSkipBeforeMask(rows, 2)).toEqual([false, true, true, false, false])
  })

  it('reaches the closed state with auto-correção too', () => {
    const rows = [row(0, { 'Lambda Loop': 0 }), row(100, { 'Lambda Loop': 2 })]
    expect(computeClosedLoopSkipBeforeMask(rows, 1)).toEqual([true, false])
  })

  it('stops at the start of the log when fewer than N points precede the transition', () => {
    const rows = [row(0, { 'Lambda Loop': 0 }), row(100, { 'Lambda Loop': 1 })]
    expect(computeClosedLoopSkipBeforeMask(rows, 5)).toEqual([true, false])
  })

  it('does not create a window when toggling between the closed states', () => {
    const rows = [row(0, { 'Lambda Loop': 1 }), row(100, { 'Lambda Loop': 2 }), row(200, { 'Lambda Loop': 1 })]
    expect(computeClosedLoopSkipBeforeMask(rows, 2)).toEqual([false, false, false])
  })

  it('does not treat the first point of a log as a transition', () => {
    expect(computeClosedLoopSkipBeforeMask([row(0, { 'Lambda Loop': 1 })], 3)).toEqual([false])
  })

  it('excludes nothing when N is 0', () => {
    const rows = [row(0, { 'Lambda Loop': 0 }), row(100, { 'Lambda Loop': 1 })]
    expect(computeClosedLoopSkipBeforeMask(rows, 0)).toEqual([false, false])
  })
})

describe('computeOpenLoopSkipBeforeMask', () => {
  it('excludes the N points right before each closed->open transition, from either closed state', () => {
    const rows = [
      row(0,   { 'Lambda Loop': 1 }),
      row(100, { 'Lambda Loop': 1 }), // excluded
      row(200, { 'Lambda Loop': 0 }), // transition point -> kept
      row(300, { 'Lambda Loop': 2 }),
      row(400, { 'Lambda Loop': 0 }), // 2nd transition: the point before (300) is excluded
    ]
    expect(computeOpenLoopSkipBeforeMask(rows, 1)).toEqual([false, true, false, true, false])
  })

  it('does not create a window when staying closed', () => {
    const rows = [row(0, { 'Lambda Loop': 1 }), row(100, { 'Lambda Loop': 2 })]
    expect(computeOpenLoopSkipBeforeMask(rows, 3)).toEqual([false, false])
  })

  it('excludes nothing when N is 0', () => {
    const rows = [row(0, { 'Lambda Loop': 1 }), row(100, { 'Lambda Loop': 0 })]
    expect(computeOpenLoopSkipBeforeMask(rows, 0)).toEqual([false, false])
  })
})

/** Filtro com tudo desligado, para isolar um critério por teste. */
function allOff(): FilterConfig {
  const f = cloneFilter(DEFAULT_FILTER)
  for (const sig of Object.keys(f.ranges) as (keyof FilterConfig['ranges'])[]) f.ranges[sig] = { enabled: false, min: null, max: null }
  f.lambdaLoop = { enabled: false, states: [] }
  f.maxDeltaTps.enabled = false
  f.maxDeltaMap.enabled = false
  f.maxDeltaLambdaTarget.enabled = false
  f.skipClosed.enabled = false
  f.skipOpen.enabled = false
  return f
}

function withRange(sig: keyof FilterConfig['ranges'], min: number | null, max: number | null): FilterConfig {
  const f = allOff()
  f.ranges[sig] = { enabled: true, min, max }
  return f
}

describe('evaluateFilterForLog — default filter', () => {
  it('passes a row that satisfies every default threshold', () => {
    const rows = [row(0), row(100), row(200)]
    expect(evaluateFilterForLog(rows, DEFAULT_FILTER)).toEqual([true, true, true])
  })

  it('passes Lambda Loop state 2 (closed + auto-correção) by default', () => {
    expect(evaluateFilterForLog([row(0, { 'Lambda Loop': 2 })], DEFAULT_FILTER)).toEqual([true])
  })

  it('excludes open loop by default', () => {
    expect(evaluateFilterForLog([row(0, { 'Lambda Loop': 0 })], DEFAULT_FILTER)).toEqual([false])
  })

  it('returns an empty mask for an empty log', () => {
    expect(evaluateFilterForLog([], DEFAULT_FILTER)).toEqual([])
  })
})

describe('evaluateFilterForLog — ranges', () => {
  it('single range, inclusive bounds', () => {
    const rows = [row(0, { MAP: 79 }), row(0, { MAP: 80 }), row(0, { MAP: 120 }), row(0, { MAP: 121 })]
    expect(evaluateFilterForLog(rows, withRange('MAP', 80, 120))).toEqual([false, true, true, false])
  })

  it('combines ranges with AND', () => {
    const f = withRange('MAP', 80, 120)
    f.ranges['RPM'] = { enabled: true, min: 3000, max: 4000 }
    const rows = [row(0, { MAP: 100, RPM: 3500 }), row(0, { MAP: 100, RPM: 5000 }), row(0, { MAP: 50, RPM: 3500 })]
    expect(evaluateFilterForLog(rows, f)).toEqual([true, false, false])
  })

  it('open-ended: only min / only max', () => {
    const rows = [row(0, { MAP: 50 }), row(0, { MAP: 150 })]
    expect(evaluateFilterForLog(rows, withRange('MAP', 100, null))).toEqual([false, true])
    expect(evaluateFilterForLog(rows, withRange('MAP', null, 100))).toEqual([true, false])
  })

  it('enabled range with no bounds constrains nothing', () => {
    expect(evaluateFilterForLog([row(0, { MAP: 1 }), row(0, { MAP: 999 })], withRange('MAP', null, null))).toEqual([true, true])
  })

  it('a disabled range is ignored even when it holds values', () => {
    const f = allOff()
    f.ranges['MAP'] = { enabled: false, min: 500, max: 600 }
    expect(evaluateFilterForLog([row(0, { MAP: 100 })], f)).toEqual([true])
  })

  it('NaN fails an enabled range, even an unbounded one, but not a disabled signal', () => {
    expect(evaluateFilterForLog([row(0, { MAP: NaN })], withRange('MAP', null, null))).toEqual([false])
    expect(evaluateFilterForLog([row(0, { MAP: NaN })], withRange('MAP', 0, null))).toEqual([false])
    expect(evaluateFilterForLog([row(0, { RPM: NaN })], withRange('MAP', 0, null))).toEqual([true])
  })

  it('CLT is a range like the others (minimum only)', () => {
    expect(evaluateFilterForLog([row(0, { CLT: 50 }), row(0, { CLT: 90 })], withRange('CLT', 80, null))).toEqual([false, true])
  })

  it('new signal ranges are inclusive and open-ended like the others', () => {
    const rows = [row(0, { 'Batt Volt.': 11.9 }), row(0, { 'Batt Volt.': 12 }), row(0, { 'Batt Volt.': 15 }), row(0, { 'Batt Volt.': 15.1 })]
    expect(evaluateFilterForLog(rows, withRange('Batt Volt.', 12, 15))).toEqual([false, true, true, false])
    expect(evaluateFilterForLog(rows, withRange('Batt Volt.', 12, null))).toEqual([false, true, true, true])
    expect(evaluateFilterForLog(rows, withRange('Batt Volt.', null, 12))).toEqual([true, true, false, false])
  })

  it('combines Boost and Lambda Target ranges with AND', () => {
    const f = withRange('Boost', null, 150)
    f.ranges['Lambda Target'] = { enabled: true, min: 0.8, max: null }
    const rows = [
      row(0, { Boost: 100, 'Lambda Target': 0.9 }),
      row(0, { Boost: 200, 'Lambda Target': 0.9 }),
      row(0, { Boost: 100, 'Lambda Target': 0.7 }),
    ]
    expect(evaluateFilterForLog(rows, f)).toEqual([true, false, false])
  })

  it('a row without the optional signal (Inj. DT) fails the enabled range, even an unbounded one', () => {
    const rows = [row(0), row(0, { 'Inj. DT': 1.1 })]
    expect(evaluateFilterForLog(rows, withRange('Inj. DT', null, null))).toEqual([false, true])
    expect(evaluateFilterForLog(rows, withRange('Inj. DT', 0.5, 2))).toEqual([false, true])
  })

  it('a disabled new range is ignored even when it holds values', () => {
    const f = allOff()
    f.ranges['Inj. Utiliz.'] = { enabled: false, min: 90, max: 100 }
    expect(evaluateFilterForLog([row(0)], f)).toEqual([true])
  })

  it('Lambda 1 range excludes values outside min/max', () => {
    expect(evaluateFilterForLog([row(0, { 'Lambda 1': 1.2 })], withRange('Lambda 1', 0.6, 1.09))).toEqual([false])
  })
})

describe('evaluateFilterForLog — Lambda Loop', () => {
  const rows = [row(0, { 'Lambda Loop': 0 }), row(0, { 'Lambda Loop': 1 }), row(0, { 'Lambda Loop': 2 })]
  const loop = (states: LambdaLoopState[], enabled = true): FilterConfig => {
    const f = allOff()
    f.lambdaLoop = { enabled, states }
    return f
  }

  it('keeps only the accepted states', () => {
    expect(evaluateFilterForLog(rows, loop([1, 2]))).toEqual([false, true, true])
    expect(evaluateFilterForLog(rows, loop([0]))).toEqual([true, false, false])
  })

  it('a disabled loop criterion is ignored', () => {
    expect(evaluateFilterForLog(rows, loop([0], false))).toEqual([true, true, true])
  })

  it('a missing / NaN Lambda Loop value fails an enabled loop criterion', () => {
    const missing: DatalogRow = { timestamp_ms: 0 }
    expect(evaluateFilterForLog([missing, row(0, { 'Lambda Loop': NaN })], loop([0, 1, 2]))).toEqual([false, false])
  })

  it('combines with a range using AND', () => {
    const f = loop([1])
    f.ranges['MAP'] = { enabled: true, min: 80, max: null }
    const rs = [row(0, { 'Lambda Loop': 1, MAP: 100 }), row(0, { 'Lambda Loop': 0, MAP: 100 }), row(0, { 'Lambda Loop': 1, MAP: 10 })]
    expect(evaluateFilterForLog(rs, f)).toEqual([true, false, false])
  })
})

describe('evaluateFilterForLog — window, target and skip criteria', () => {
  it('excludes a point during a rapid MAP transient (boost spike/lift)', () => {
    const rows = [
      row(0,   { MAP: 40 }),
      row(100, { MAP: 100 }),
      row(200, { MAP: 38 }), // full 200ms window now available: amplitude 100-38=62 > 5 -> excluded
    ]
    const f = allOff()
    f.maxDeltaMap = { enabled: true, value: 5 }
    expect(evaluateFilterForLog(rows, f)).toEqual([true, true, false])
  })

  it('does not apply the MAP delta when the criterion is disabled', () => {
    const rows = [row(0, { MAP: 40 }), row(100, { MAP: 100 }), row(200, { MAP: 38 })]
    expect(evaluateFilterForLog(rows, allOff())).toEqual([true, true, true])
  })

  it('excludes a point whose lambda deviates too much from target', () => {
    const f = allOff()
    f.maxDeltaLambdaTarget = { enabled: true, value: 0.2 }
    expect(evaluateFilterForLog([row(0, { 'Lambda 1': 1.3, 'Lambda Target': 1.0 })], f)).toEqual([false])
  })

  it('a missing Lambda Target fails the enabled |Δλ×alvo| criterion', () => {
    const f = allOff()
    f.maxDeltaLambdaTarget = { enabled: true, value: 0.2 }
    expect(evaluateFilterForLog([row(0, { 'Lambda Target': NaN })], f)).toEqual([false])
  })

  it('applies the skip-after-closed-loop criterion only when enabled', () => {
    const rows = [row(0, { 'Lambda Loop': 0 }), row(100, { 'Lambda Loop': 1 }), row(200, { 'Lambda Loop': 1 })]
    const f = allOff()
    f.skipClosed = { enabled: true, n: 1 }
    expect(evaluateFilterForLog(rows, f)).toEqual([true, false, true])
    f.skipClosed.enabled = false
    expect(evaluateFilterForLog(rows, f)).toEqual([true, true, true])
  })

  it('applies the skip-before-closed-loop criterion only when enabled', () => {
    const rows = [row(0, { 'Lambda Loop': 0 }), row(100, { 'Lambda Loop': 0 }), row(200, { 'Lambda Loop': 1 })]
    const f = allOff()
    f.skipBeforeClosed = { enabled: true, n: 1 }
    expect(evaluateFilterForLog(rows, f)).toEqual([true, false, true])
    f.skipBeforeClosed.enabled = false
    expect(evaluateFilterForLog(rows, f)).toEqual([true, true, true])
  })

  it('applies the skip-before-open-loop criterion only when enabled', () => {
    const rows = [row(0, { 'Lambda Loop': 1 }), row(100, { 'Lambda Loop': 1 }), row(200, { 'Lambda Loop': 0 })]
    const f = allOff()
    f.skipBeforeOpen = { enabled: true, n: 2 }
    expect(evaluateFilterForLog(rows, f)).toEqual([false, false, true])
    f.skipBeforeOpen.enabled = false
    expect(evaluateFilterForLog(rows, f)).toEqual([true, true, true])
  })

  it('combines "before" and "after" skips, excluding both sides of the transition', () => {
    const rows = [
      row(0,   { 'Lambda Loop': 0 }),
      row(100, { 'Lambda Loop': 0 }), // before (excluded)
      row(200, { 'Lambda Loop': 1 }), // after, 1st (excluded)
      row(300, { 'Lambda Loop': 1 }), // after, 2nd (excluded)
      row(400, { 'Lambda Loop': 1 }),
    ]
    const f = allOff()
    f.skipBeforeClosed = { enabled: true, n: 1 }
    f.skipClosed = { enabled: true, n: 2 }
    expect(evaluateFilterForLog(rows, f)).toEqual([true, false, false, false, true])
  })

  it('leaves the default filter mask unchanged by the (disabled) "before" skips', () => {
    const rows = [row(0, { 'Lambda Loop': 0 }), row(100, { 'Lambda Loop': 1 }), row(200, { 'Lambda Loop': 1 })]
    const withBefore = cloneFilter(DEFAULT_FILTER)
    withBefore.skipBeforeClosed.n = 3
    expect(evaluateFilterForLog(rows, withBefore)).toEqual(evaluateFilterForLog(rows, DEFAULT_FILTER))
  })

  it('combines criteria with AND semantics', () => {
    const f = allOff()
    f.ranges['CLT'] = { enabled: true, min: 80, max: null }
    f.ranges['Lambda 1'] = { enabled: true, min: null, max: 1.09 }
    expect(evaluateFilterForLog([row(0, { CLT: 50, 'Lambda 1': 1.2 })], f)).toEqual([false])
  })
})

describe('evaluateFilter', () => {
  function makeLog(hash: string, rows: DatalogRow[], enabled = true): LogEntry {
    return {
      hash, filename: `${hash}.csv`, enabled,
      duration_ms: rows[rows.length - 1]?.timestamp_ms ?? 0,
      model: { hash, filename: `${hash}.csv`, rows, duration_ms: 0, signals: [] },
    }
  }

  it('concatenates results across active logs, skipping disabled ones, per-log for stateful criteria', () => {
    // logA ends mid-countdown (skip=3, only 1 of 3 points consumed before the log ends).
    // logC starts already-closed with no transition of its own — if the countdown incorrectly
    // carried over from logA, logC's rows would wrongly be excluded too.
    const logA = makeLog('a', [row(0, { 'Lambda Loop': 0 }), row(100, { 'Lambda Loop': 1 })])
    const logB = makeLog('b', [row(0, { 'Lambda Loop': 0 }), row(100, { 'Lambda Loop': 1 })], false)
    const logC = makeLog('c', [row(0, { 'Lambda Loop': 1 }), row(100, { 'Lambda Loop': 1 })])

    const f = allOff()
    f.skipClosed = { enabled: true, n: 3 }
    // logB disabled -> excluded from output entirely
    expect(evaluateFilter([logA, logB, logC], f)).toEqual([true, false, true, true])
  })

  it('does not let a "before" window reach into the previous log', () => {
    const logA = makeLog('a', [row(0, { 'Lambda Loop': 0 }), row(100, { 'Lambda Loop': 0 })])
    const logC = makeLog('c', [row(0, { 'Lambda Loop': 1 }), row(100, { 'Lambda Loop': 1 })])
    const f = allOff()
    f.skipBeforeClosed = { enabled: true, n: 3 }
    expect(evaluateFilter([logA, logC], f)).toEqual([true, true, true, true])
  })

  it('handles a very large log without overflowing the call stack', () => {
    const rows = Array.from({ length: 300_000 }, (_, i) => row(i * 10))
    const mask = evaluateFilter([makeLog('big', rows)], allOff())
    expect(mask).toHaveLength(300_000)
    expect(mask.every(Boolean)).toBe(true)
  })
})
