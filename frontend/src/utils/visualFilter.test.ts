import { describe, it, expect } from 'vitest'
import {
  emptyVisualFilter, evaluateVisualFilter, evaluateVisualFilterForRows,
  hasInvalidRange, isVisualFilterActive,
  type VisualFilterConfig,
} from './visualFilter'
import type { LambdaLoopState } from '@/types/correction'
import type { DatalogRow, LogEntry } from '@/types/datalog'

function row(over: Partial<DatalogRow> = {}): DatalogRow {
  return { timestamp_ms: 0, MAP: 100, RPM: 3500, 'Lambda 1': 1, 'Lambda Corr': 0, Pedal: 50, 'Lambda Loop': 1, ...over }
}

function filter(
  rangeOver: Record<string, { min?: number | null; max?: number | null }> = {},
  loop?: LambdaLoopState[],
): VisualFilterConfig {
  const f = emptyVisualFilter()
  for (const [sig, b] of Object.entries(rangeOver)) {
    f.ranges[sig as keyof typeof f.ranges] = { enabled: true, min: b.min ?? null, max: b.max ?? null }
  }
  if (loop) f.lambdaLoop = { enabled: true, states: loop }
  return f
}

describe('evaluateVisualFilterForRows — ranges', () => {
  it('single range, inclusive bounds', () => {
    const rows = [row({ MAP: 79 }), row({ MAP: 80 }), row({ MAP: 120 }), row({ MAP: 121 })]
    expect(evaluateVisualFilterForRows(rows, filter({ MAP: { min: 80, max: 120 } })))
      .toEqual([false, true, true, false])
  })

  it('combines ranges with AND', () => {
    const rows = [row({ MAP: 100, RPM: 3500 }), row({ MAP: 100, RPM: 5000 }), row({ MAP: 50, RPM: 3500 })]
    expect(evaluateVisualFilterForRows(rows, filter({ MAP: { min: 80, max: 120 }, RPM: { min: 3000, max: 4000 } })))
      .toEqual([true, false, false])
  })

  it('open-ended: only min / only max', () => {
    const rows = [row({ MAP: 50 }), row({ MAP: 150 })]
    expect(evaluateVisualFilterForRows(rows, filter({ MAP: { min: 100 } }))).toEqual([false, true])
    expect(evaluateVisualFilterForRows(rows, filter({ MAP: { max: 100 } }))).toEqual([true, false])
  })

  it('enabled row with no bounds constrains nothing', () => {
    expect(evaluateVisualFilterForRows([row({ MAP: 1 }), row({ MAP: 999 })], filter({ MAP: {} })))
      .toEqual([true, true])
  })

  it('disabled rows are ignored even with values', () => {
    const f = emptyVisualFilter()
    f.ranges.MAP = { enabled: false, min: 500, max: 600 }
    expect(evaluateVisualFilterForRows([row({ MAP: 100 })], f)).toEqual([true])
  })

  it('NaN fails an enabled range, even an unbounded one', () => {
    expect(evaluateVisualFilterForRows([row({ MAP: NaN })], filter({ MAP: {} }))).toEqual([false])
    expect(evaluateVisualFilterForRows([row({ MAP: NaN })], filter({ MAP: { min: 0 } }))).toEqual([false])
  })

  it('NaN in a signal that is not enabled does not matter', () => {
    expect(evaluateVisualFilterForRows([row({ RPM: NaN })], filter({ MAP: { min: 0 } }))).toEqual([true])
  })
})

describe('evaluateVisualFilterForRows — Lambda Loop', () => {
  const rows = [row({ 'Lambda Loop': 0 }), row({ 'Lambda Loop': 1 }), row({ 'Lambda Loop': 2 })]

  it('keeps only the checked states', () => {
    expect(evaluateVisualFilterForRows(rows, filter({}, [1, 2]))).toEqual([false, true, true])
    expect(evaluateVisualFilterForRows(rows, filter({}, [0]))).toEqual([true, false, false])
  })

  it('all three states checked passes everything', () => {
    expect(evaluateVisualFilterForRows(rows, filter({}, [0, 1, 2]))).toEqual([true, true, true])
  })

  it('disabled loop row is ignored even with states checked', () => {
    const f = emptyVisualFilter()
    f.lambdaLoop = { enabled: false, states: [0] }
    expect(evaluateVisualFilterForRows(rows, f)).toEqual([true, true, true])
  })

  it('combines with ranges using AND', () => {
    const rs = [row({ 'Lambda Loop': 1, MAP: 100 }), row({ 'Lambda Loop': 0, MAP: 100 }), row({ 'Lambda Loop': 1, MAP: 10 })]
    expect(evaluateVisualFilterForRows(rs, filter({ MAP: { min: 80 } }, [1]))).toEqual([true, false, false])
  })

  it('a missing / NaN Lambda Loop value fails an enabled loop row', () => {
    const r: DatalogRow = { timestamp_ms: 0 }
    expect(evaluateVisualFilterForRows([r, row({ 'Lambda Loop': NaN })], filter({}, [0, 1, 2]))).toEqual([false, false])
  })
})

describe('isVisualFilterActive / hasInvalidRange', () => {
  it('inactive when nothing enabled; active with a range or the loop row', () => {
    expect(isVisualFilterActive(emptyVisualFilter())).toBe(false)
    expect(isVisualFilterActive(filter({ MAP: {} }))).toBe(true)
    expect(isVisualFilterActive(filter({}, [1]))).toBe(true)
  })

  it('flags min > max only on enabled rows', () => {
    expect(hasInvalidRange(filter({ MAP: { min: 10, max: 5 } }))).toBe(true)
    expect(hasInvalidRange(filter({ MAP: { min: 5, max: 5 } }))).toBe(false)
    const f = emptyVisualFilter()
    f.ranges.MAP = { enabled: false, min: 10, max: 5 }
    expect(hasInvalidRange(f)).toBe(false)
  })

  it('flags an enabled loop row with no state, but not a disabled one', () => {
    expect(hasInvalidRange(filter({}, []))).toBe(true)
    expect(hasInvalidRange(filter({}, [0]))).toBe(false)
    const f = emptyVisualFilter()
    f.lambdaLoop = { enabled: false, states: [] }
    expect(hasInvalidRange(f)).toBe(false)
  })
})

describe('evaluateVisualFilter (logs)', () => {
  function log(enabled: boolean, rows: DatalogRow[]): LogEntry {
    return { hash: 'h', filename: 'f', enabled, duration_ms: 0, model: { hash: 'h', filename: 'f', rows, duration_ms: 0, signals: [] } }
  }

  it('concatenates active logs only, in order', () => {
    const logs = [
      log(true,  [row({ MAP: 100 }), row({ MAP: 10 })]),
      log(false, [row({ MAP: 100 })]),
      log(true,  [row({ MAP: 90 })]),
    ]
    expect(evaluateVisualFilter(logs, filter({ MAP: { min: 80 } }))).toEqual([true, false, true])
  })
})
