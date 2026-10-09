import { describe, it, expect } from 'vitest'
import { sortSignals } from '@/signals/signalRegistry'
import {
  DEFAULT_FILTER, FILTER_RANGE_SIGNALS, cloneFilter, countEnabled, filterError, filtersEqual,
  isDefaultFilter, makeDefaultFilter, sanitizeFilter,
} from './filter'

describe('DEFAULT_FILTER', () => {
  it('has 8 criteria enabled and MAP/RPM/Pedal/Lambda Corr disabled', () => {
    expect(countEnabled(DEFAULT_FILTER)).toBe(8)
    for (const sig of ['MAP', 'RPM', 'Pedal', 'Lambda Corr'] as const) {
      expect(DEFAULT_FILTER.ranges[sig].enabled).toBe(false)
    }
    expect(DEFAULT_FILTER.ranges['CLT']).toEqual({ enabled: true, min: 85, max: null })
    expect(DEFAULT_FILTER.ranges['Lambda 1']).toEqual({ enabled: true, min: 0.6, max: 1.1 })
    expect(DEFAULT_FILTER.lambdaLoop).toEqual({ enabled: true, states: [1, 2] })
    expect(DEFAULT_FILTER.skipClosed.n).toBe(5)
    expect(DEFAULT_FILTER.skipOpen.n).toBe(10)
  })

  it('has the seven IAT/battery/injection/target/boost ranges off and empty', () => {
    for (const sig of ['Batt Volt.', 'Inj. DT', 'Inj. Utiliz.', 'Inj. Pulse', 'Lambda Target', 'Boost', 'IAT'] as const) {
      expect(FILTER_RANGE_SIGNALS).toContain(sig)
      expect(DEFAULT_FILTER.ranges[sig]).toEqual({ enabled: false, min: null, max: null })
    }
  })

  it('has the "before" skips off, with the same counts as the "after" ones', () => {
    expect(DEFAULT_FILTER.skipBeforeClosed).toEqual({ enabled: false, n: 5 })
    expect(DEFAULT_FILTER.skipBeforeOpen).toEqual({ enabled: false, n: 10 })
  })

  it('is valid and counts as the default', () => {
    expect(filterError(DEFAULT_FILTER)).toBeNull()
    expect(isDefaultFilter(makeDefaultFilter())).toBe(true)
  })
})

describe('FILTER_RANGE_SIGNALS', () => {
  it('follows the signal order of the Gráficos sidebar', () => {
    expect([...FILTER_RANGE_SIGNALS]).toEqual(sortSignals(FILTER_RANGE_SIGNALS))
  })
})

describe('filtersEqual / cloneFilter', () => {
  it('ignores the order of the Lambda Loop states', () => {
    const a = cloneFilter(DEFAULT_FILTER)
    const b = cloneFilter(DEFAULT_FILTER)
    b.lambdaLoop.states = [2, 1]
    expect(filtersEqual(a, b)).toBe(true)
  })

  it('detects a changed bound and does not share references with the clone', () => {
    const a = cloneFilter(DEFAULT_FILTER)
    a.ranges['MAP'].enabled = true
    expect(filtersEqual(a, DEFAULT_FILTER)).toBe(false)
    expect(DEFAULT_FILTER.ranges['MAP'].enabled).toBe(false)
  })

  it('tells apart a changed "before" skip and does not share its reference', () => {
    const a = cloneFilter(DEFAULT_FILTER)
    a.skipBeforeClosed.enabled = true
    expect(filtersEqual(a, DEFAULT_FILTER)).toBe(false)
    expect(DEFAULT_FILTER.skipBeforeClosed.enabled).toBe(false)
  })
})

describe('countEnabled', () => {
  it('counts each range as one criterion', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    for (const sig of FILTER_RANGE_SIGNALS) f.ranges[sig].enabled = true
    expect(countEnabled(f)).toBe(FILTER_RANGE_SIGNALS.length + 1 + 3 + 2)
  })

  it('counts the "before" skips once enabled', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.skipBeforeClosed.enabled = true
    f.skipBeforeOpen.enabled = true
    expect(countEnabled(f)).toBe(countEnabled(DEFAULT_FILTER) + 2)
  })
})

describe('filterError', () => {
  it('flags an inverted range only while it is enabled', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.ranges['MAP'] = { enabled: true, min: 120, max: 80 }
    expect(filterError(f)).toMatch(/MAP/)
    f.ranges['MAP'].enabled = false
    expect(filterError(f)).toBeNull()
  })

  it('flags an inverted range on a new signal only while it is enabled', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.ranges['Boost'] = { enabled: true, min: 200, max: 100 }
    expect(filterError(f)).toMatch(/Boost/)
    f.ranges['Boost'].enabled = false
    expect(filterError(f)).toBeNull()
  })

  it('flags Lambda Loop enabled with no state', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.lambdaLoop.states = []
    expect(filterError(f)).toMatch(/Lambda Loop/)
    f.lambdaLoop.enabled = false
    expect(filterError(f)).toBeNull()
  })

  it('flags a non-finite or negative limit', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.maxDeltaTps.value = NaN
    expect(filterError(f)).toMatch(/Delta TPS/)
  })

  it('flags an invalid "before" skip count only while enabled', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.skipBeforeClosed = { enabled: true, n: 2.5 }
    expect(filterError(f)).toMatch(/antes de Closed Loop/)
    f.skipBeforeClosed = { enabled: false, n: -1 }
    expect(filterError(f)).toBeNull()
    f.skipBeforeOpen = { enabled: true, n: -1 }
    expect(filterError(f)).toMatch(/antes de Open Loop/)
  })
})

describe('sanitizeFilter', () => {
  it('falls back to the default for unreadable input without throwing', () => {
    for (const bad of [null, undefined, 'x', 42, [], {}]) {
      expect(filtersEqual(sanitizeFilter(bad), DEFAULT_FILTER)).toBe(true)
    }
  })

  it('keeps valid fields and defaults the missing ones', () => {
    const f = sanitizeFilter({ ranges: { MAP: { enabled: true, min: 80, max: 120 } }, skipOpen: { enabled: false, n: 3 } })
    expect(f.ranges['MAP']).toEqual({ enabled: true, min: 80, max: 120 })
    expect(f.skipOpen).toEqual({ enabled: false, n: 3 })
    expect(f.ranges['CLT']).toEqual(DEFAULT_FILTER.ranges['CLT'])
  })

  it('reads a filter saved without the "before" skips as having them off', () => {
    const saved = cloneFilter(DEFAULT_FILTER) as unknown as Record<string, unknown>
    delete saved.skipBeforeClosed
    delete saved.skipBeforeOpen
    saved.skipClosed = { enabled: false, n: 7 }
    const f = sanitizeFilter(saved)
    expect(f.skipBeforeClosed).toEqual({ enabled: false, n: 5 })
    expect(f.skipBeforeOpen).toEqual({ enabled: false, n: 10 })
    expect(f.skipClosed).toEqual({ enabled: false, n: 7 })
  })

  it('keeps saved "before" skips and drops invalid ones to the default', () => {
    const f = sanitizeFilter({ skipBeforeClosed: { enabled: true, n: 3 }, skipBeforeOpen: { enabled: true, n: 'x' } })
    expect(f.skipBeforeClosed).toEqual({ enabled: true, n: 3 })
    expect(f.skipBeforeOpen).toEqual({ enabled: false, n: 10 })
  })

  it('reads a filter saved without the new ranges as having them off and empty', () => {
    const saved = cloneFilter(DEFAULT_FILTER) as unknown as { ranges: Record<string, unknown> }
    for (const sig of ['Batt Volt.', 'Inj. DT', 'Inj. Utiliz.', 'Inj. Pulse', 'Lambda Target', 'Boost', 'IAT'] as const) delete saved.ranges[sig]
    saved.ranges['MAP'] = { enabled: true, min: 80, max: 120 }
    const f = sanitizeFilter(saved)
    expect(f.ranges['MAP']).toEqual({ enabled: true, min: 80, max: 120 })
    for (const sig of ['Batt Volt.', 'Inj. DT', 'Inj. Utiliz.', 'Inj. Pulse', 'Lambda Target', 'Boost', 'IAT'] as const) expect(f.ranges[sig]).toEqual({ enabled: false, min: null, max: null })
    expect(f.ranges['CLT']).toEqual(DEFAULT_FILTER.ranges['CLT'])
  })

  it('restores a saved new range with its enable state and bounds', () => {
    const f = sanitizeFilter({ ranges: { Boost: { enabled: true, min: 120, max: null } } })
    expect(f.ranges['Boost']).toEqual({ enabled: true, min: 120, max: null })
  })

  it('drops invalid Lambda Loop states', () => {
    const f = sanitizeFilter({ lambdaLoop: { enabled: true, states: [2, 7, 'a', 0] } })
    expect(f.lambdaLoop.states).toEqual([0, 2])
  })
})
