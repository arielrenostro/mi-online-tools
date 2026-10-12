import { describe, it, expect } from 'vitest'
import { sortSignals } from '@/signals/signalRegistry'
import {
  DEFAULT_FILTER, FILTER_RANGE_SIGNALS, cloneFilter, countEnabled, filterError, filtersEqual,
  isDefaultFilter, makeDefaultFilter, sanitizeFilter,
} from './filter'

describe('DEFAULT_FILTER', () => {
  it('has 9 criteria enabled and MAP/RPM/Pedal/Lambda Corr disabled', () => {
    expect(countEnabled(DEFAULT_FILTER)).toBe(9)
    for (const sig of ['MAP', 'RPM', 'Pedal', 'Lambda Corr'] as const) {
      expect(DEFAULT_FILTER.ranges[sig].enabled).toBe(false)
    }
    expect(DEFAULT_FILTER.ranges['CLT']).toEqual({ enabled: true, min: 87, max: null })
    expect(DEFAULT_FILTER.ranges['Lambda 1']).toEqual({ enabled: true, min: 0.7, max: 1.09 })
    expect(DEFAULT_FILTER.lambdaLoop).toEqual({ enabled: true, states: [1, 2] })
    expect(DEFAULT_FILTER.maxDeltaLambdaTarget).toEqual({ enabled: true, value: 0.05 })
    expect(DEFAULT_FILTER.skipClosed).toEqual({ enabled: true, n: 5 })
    expect(DEFAULT_FILTER.skipOpen).toEqual({ enabled: false, n: 10 })
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
    expect(countEnabled(f)).toBe(FILTER_RANGE_SIGNALS.length + 1 + 1 + 1 + 4)
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
    f.maxDeltaTps = { enabled: true, value: NaN }
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

const SETTLE_KEYS = ['holdPedal', 'holdMap', 'holdGear', 'stablePedal', 'stableMap'] as const

describe('settling criteria (hold-off and stability)', () => {
  it('default: descartar after Pedal/MAP step (5, 15 points) and gear change (15 points) on, Pedal stability (5, 10) on, MAP stability off', () => {
    expect(DEFAULT_FILTER.holdPedal).toEqual({ enabled: true, value: 5, n: 15 })
    expect(DEFAULT_FILTER.holdMap).toEqual({ enabled: true, value: 5, n: 15 })
    expect(DEFAULT_FILTER.holdGear).toEqual({ enabled: true, n: 15 })
    expect(DEFAULT_FILTER.stablePedal).toEqual({ enabled: true, value: 5, n: 10 })
    expect(DEFAULT_FILTER.stableMap).toEqual({ enabled: false, value: 5, n: 10 })
  })

  it('default: the TPS and MAP deltas are off, keeping their limit of 5', () => {
    expect(DEFAULT_FILTER.maxDeltaTps).toEqual({ enabled: false, value: 5 })
    expect(DEFAULT_FILTER.maxDeltaMap).toEqual({ enabled: false, value: 5 })
  })

  it('count once each when enabled', () => {
    const on = cloneFilter(DEFAULT_FILTER)
    for (const key of SETTLE_KEYS) on[key].enabled = true
    expect(countEnabled(on)).toBe(countEnabled(DEFAULT_FILTER) + 1)
    const off = cloneFilter(DEFAULT_FILTER)
    for (const key of SETTLE_KEYS) off[key].enabled = false
    expect(countEnabled(off)).toBe(countEnabled(DEFAULT_FILTER) - 4)
  })

  it('are detected by filtersEqual in every field, and the clone shares no reference', () => {
    for (const key of SETTLE_KEYS) {
      const a = cloneFilter(DEFAULT_FILTER)
      a[key].enabled = !DEFAULT_FILTER[key].enabled
      expect(filtersEqual(a, DEFAULT_FILTER)).toBe(false)
      expect(DEFAULT_FILTER[key].enabled).toBe(!a[key].enabled)
      const b = cloneFilter(DEFAULT_FILTER)
      b[key].n = 40
      expect(filtersEqual(b, DEFAULT_FILTER)).toBe(false)
    }
    for (const key of ['holdPedal', 'holdMap', 'stablePedal', 'stableMap'] as const) {
      const c = cloneFilter(DEFAULT_FILTER)
      c[key].value = 9
      expect(filtersEqual(c, DEFAULT_FILTER)).toBe(false)
    }
  })

  it('flag an invalid limit or point count only while enabled', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.holdPedal = { enabled: true, value: -1, n: 25 }
    expect(filterError(f)).toMatch(/degrau de Pedal/)
    f.holdPedal.enabled = false
    expect(filterError(f)).toBeNull()
    f.holdMap = { enabled: true, value: 5, n: 2.5 }
    expect(filterError(f)).toMatch(/degrau de MAP/)
    f.holdMap = { enabled: false, value: 5, n: 25 }
    f.holdGear = { enabled: true, n: -3 }
    expect(filterError(f)).toMatch(/troca de marcha/)
    f.holdGear = { enabled: true, n: 0 }
    expect(filterError(f)).toBeNull()
  })

  it('require a stability window of at least 2 integer points', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.stablePedal = { enabled: true, value: 5, n: 1 }
    expect(filterError(f)).toMatch(/Estabilidade do Pedal/)
    f.stablePedal = { enabled: true, value: 5, n: 2 }
    expect(filterError(f)).toBeNull()
    f.stableMap = { enabled: true, value: NaN, n: 25 }
    expect(filterError(f)).toMatch(/Estabilidade do MAP/)
  })

  it('are read as OFF, at their default limits, from a filter saved without them (same points pass as before)', () => {
    const saved = cloneFilter(DEFAULT_FILTER) as unknown as Record<string, unknown>
    for (const key of SETTLE_KEYS) delete saved[key]
    saved.skipClosed = { enabled: false, n: 7 }
    const f = sanitizeFilter(saved)
    for (const key of SETTLE_KEYS) expect(f[key]).toEqual({ ...DEFAULT_FILTER[key], enabled: false })
    expect(f.skipClosed).toEqual({ enabled: false, n: 7 })
  })

  it('are restored with enable state, limit and point count', () => {
    const f = sanitizeFilter({
      holdGear:    { enabled: true, n: 30 },
      holdPedal:   { enabled: true, value: 8, n: 12 },
      stableMap:   { enabled: true, value: 3, n: 40 },
    })
    expect(f.holdGear).toEqual({ enabled: true, n: 30 })
    expect(f.holdPedal).toEqual({ enabled: true, value: 8, n: 12 })
    expect(f.stableMap).toEqual({ enabled: true, value: 3, n: 40 })
    expect(f.holdMap).toEqual({ ...DEFAULT_FILTER.holdMap, enabled: false })
  })

  it('fall back to off, at the default limits, when the saved values are unreadable', () => {
    const f = sanitizeFilter({
      ranges: {},
      holdPedal:   { enabled: true, value: 'x', n: 10 },
      holdGear:    { enabled: true, n: 'x' },
      stableMap:   { enabled: true, value: 5, n: 1 },
      stablePedal: 'garbage',
    })
    expect(f.holdPedal).toEqual({ ...DEFAULT_FILTER.holdPedal, enabled: false })
    expect(f.holdGear).toEqual({ ...DEFAULT_FILTER.holdGear, enabled: false })
    expect(f.stableMap).toEqual({ ...DEFAULT_FILTER.stableMap, enabled: false })
    expect(f.stablePedal).toEqual({ ...DEFAULT_FILTER.stablePedal, enabled: false })
  })
})
