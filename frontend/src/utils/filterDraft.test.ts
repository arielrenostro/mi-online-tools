import { describe, it, expect } from 'vitest'
import { draftErrors, draftToFilter, parseBound, toDraft } from './filterDraft'
import { DEFAULT_FILTER, cloneFilter, filtersEqual } from '@/types/filter'

describe('toDraft / draftToFilter', () => {
  it('round-trips the default filter', () => {
    expect(filtersEqual(draftToFilter(toDraft(DEFAULT_FILTER)), DEFAULT_FILTER)).toBe(true)
  })

  it('accepts a decimal comma and empty bounds', () => {
    const d = toDraft(DEFAULT_FILTER)
    d.ranges['MAP'] = { enabled: true, min: '80,5', max: '' }
    const f = draftToFilter(d)
    expect(f.ranges['MAP']).toEqual({ enabled: true, min: 80.5, max: null })
  })

  it('starts a new range empty and round-trips it with a decimal comma', () => {
    const d = toDraft(DEFAULT_FILTER)
    expect(d.ranges['Inj. Pulse']).toEqual({ enabled: false, min: '', max: '' })
    d.ranges['Inj. Pulse'] = { enabled: true, min: '2,5', max: '12' }
    expect(draftToFilter(d).ranges['Inj. Pulse']).toEqual({ enabled: true, min: 2.5, max: 12 })
  })

  it('sorts the Lambda Loop states', () => {
    const d = toDraft(DEFAULT_FILTER)
    d.lambdaLoop.states = [2, 0, 1]
    expect(draftToFilter(d).lambdaLoop.states).toEqual([0, 1, 2])
  })
})

describe('parseBound', () => {
  it('distinguishes empty (open), a number and garbage', () => {
    expect(parseBound('')).toBeNull()
    expect(parseBound('  ')).toBeNull()
    expect(parseBound('-3.5')).toBe(-3.5)
    expect(parseBound('abc')).toBeUndefined()
  })
})

describe('draftErrors', () => {
  it('is empty for the default filter', () => {
    expect(draftErrors(toDraft(DEFAULT_FILTER))).toEqual({})
  })

  it('flags an inverted range and a non-numeric range, but only when enabled', () => {
    const d = toDraft(DEFAULT_FILTER)
    d.ranges['MAP'] = { enabled: true, min: '120', max: '80' }
    d.ranges['RPM'] = { enabled: true, min: 'x', max: '' }
    expect(draftErrors(d)['range:MAP']).toMatch(/Mínimo/)
    expect(draftErrors(d)['range:RPM']).toMatch(/inválido/)
    d.ranges['MAP'].enabled = false
    d.ranges['RPM'].enabled = false
    expect(draftErrors(d)).toEqual({})
  })

  it('flags an inverted and a non-numeric new range, but only when enabled', () => {
    const d = toDraft(DEFAULT_FILTER)
    d.ranges['Inj. Utiliz.'] = { enabled: true, min: '90', max: '50' }
    d.ranges['Boost'] = { enabled: true, min: 'x', max: '' }
    expect(draftErrors(d)['range:Inj. Utiliz.']).toMatch(/Mínimo/)
    expect(draftErrors(d)['range:Boost']).toMatch(/inválido/)
    d.ranges['Inj. Utiliz.'].enabled = false
    d.ranges['Boost'].enabled = false
    expect(draftErrors(d)).toEqual({})
  })

  it('flags Lambda Loop enabled without states', () => {
    const d = toDraft(DEFAULT_FILTER)
    d.lambdaLoop.states = []
    expect(draftErrors(d).lambdaLoop).toBeDefined()
    d.lambdaLoop.enabled = false
    expect(draftErrors(d).lambdaLoop).toBeUndefined()
  })

  it('flags empty / negative limits and non-integer skips only while enabled', () => {
    const d = toDraft(DEFAULT_FILTER)
    d.maxDeltaTps = { enabled: true, text: '' }
    d.maxDeltaMap = { enabled: true, text: '-1' }
    d.skipClosed.text = '2.5'
    const e = draftErrors(d)
    expect(e.maxDeltaTps).toBeDefined()
    expect(e.maxDeltaMap).toBeDefined()
    expect(e.skipClosed).toBeDefined()
    d.maxDeltaTps.enabled = false
    expect(draftErrors(d).maxDeltaTps).toBeUndefined()
  })

  it('flags an invalid "before" skip count only while enabled', () => {
    const d = toDraft(DEFAULT_FILTER)
    d.skipBeforeClosed = { enabled: true, text: '2.5' }
    d.skipBeforeOpen = { enabled: true, text: '' }
    const e = draftErrors(d)
    expect(e.skipBeforeClosed).toBeDefined()
    expect(e.skipBeforeOpen).toBeDefined()
    d.skipBeforeClosed.enabled = false
    d.skipBeforeOpen.enabled = false
    expect(draftErrors(d)).toEqual({})
  })

  it('round-trips the "before" skips through toDraft / draftToFilter', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.skipBeforeClosed = { enabled: true, n: 3 }
    f.skipBeforeOpen = { enabled: false, n: 7 }
    expect(draftToFilter(toDraft(f))).toEqual(f)
  })

  it('starts the settling criteria with the default limits and point counts as text', () => {
    const d = toDraft(DEFAULT_FILTER)
    expect(d.holdPedal).toEqual({ enabled: true, valueText: '5', nText: '15' })
    expect(d.holdGear).toEqual({ enabled: true, nText: '15' })
    expect(d.stablePedal).toEqual({ enabled: true, valueText: '5', nText: '10' })
    expect(d.stableMap).toEqual({ enabled: false, valueText: '5', nText: '10' })
  })

  it('round-trips the settling criteria, including a decimal comma in the limit', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.holdPedal = { enabled: true, value: 7.5, n: 12 }
    f.holdGear = { enabled: true, n: 30 }
    f.stablePedal = { enabled: false, value: 3, n: 40 }
    expect(draftToFilter(toDraft(f))).toEqual(f)
    const d = toDraft(DEFAULT_FILTER)
    d.holdMap = { enabled: true, valueText: '2,5', nText: '10' }
    expect(draftToFilter(d).holdMap).toEqual({ enabled: true, value: 2.5, n: 10 })
  })

  it('flags an invalid settling limit or point count only while enabled', () => {
    const d = toDraft(DEFAULT_FILTER)
    d.holdPedal = { enabled: true, valueText: '-1', nText: '25' }
    d.holdMap = { enabled: true, valueText: '5', nText: '2.5' }
    d.holdGear = { enabled: true, nText: '' }
    d.stablePedal = { enabled: true, valueText: 'x', nText: '25' }
    d.stableMap = { enabled: true, valueText: '5', nText: '1' }
    const e = draftErrors(d)
    for (const key of ['holdPedal', 'holdMap', 'holdGear', 'stablePedal', 'stableMap'] as const) expect(e[key]).toBeDefined()
    for (const key of ['holdPedal', 'holdMap', 'holdGear', 'stablePedal', 'stableMap'] as const) d[key].enabled = false
    expect(draftErrors(d)).toEqual({})
  })

  it('accepts zero points in a hold-off but needs at least 2 in a stability window', () => {
    const d = toDraft(DEFAULT_FILTER)
    d.holdGear = { enabled: true, nText: '0' }
    d.stableMap = { enabled: true, valueText: '5', nText: '2' }
    expect(draftErrors(d)).toEqual({})
    d.stableMap.nText = '1'
    expect(draftErrors(d).stableMap).toMatch(/2/)
  })

  it('a disabled settling criterion with garbage text keeps the default in the filter', () => {
    const d = toDraft(DEFAULT_FILTER)
    d.holdPedal = { enabled: false, valueText: 'oops', nText: '' }
    expect(draftToFilter(d).holdPedal).toEqual({ ...DEFAULT_FILTER.holdPedal, enabled: false })
  })

  it('a disabled criterion with garbage text keeps the default value in the filter', () => {
    const d = toDraft(DEFAULT_FILTER)
    d.maxDeltaTps = { enabled: false, text: 'oops' }
    expect(draftToFilter(d).maxDeltaTps).toEqual({ enabled: false, value: 5 })
  })
})
