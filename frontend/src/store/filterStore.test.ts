import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/persistence/localStorage', () => ({
  lsSet:   vi.fn(),
  lsGet:   vi.fn(() => null),
  lsClear: vi.fn(),
}))

import { useFilterStore } from './filterStore'
import { lsSet } from '@/persistence/localStorage'
import { cloneFilter, DEFAULT_FILTER, filtersEqual } from '@/types/filter'

beforeEach(() => {
  useFilterStore.getState().hydrate({})
  vi.mocked(lsSet).mockClear()
})

describe('filterStore', () => {
  it('starts with the default filter and "mostrar pontos filtrados" on', () => {
    const s = useFilterStore.getState()
    expect(filtersEqual(s.filter, DEFAULT_FILTER)).toBe(true)
    expect(s.showFilteredPoints).toBe(true)
  })

  it('apply stores a copy and persists it', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.ranges['MAP'] = { enabled: true, min: 80, max: 120 }
    useFilterStore.getState().apply(f)
    expect(useFilterStore.getState().filter.ranges['MAP']).toEqual({ enabled: true, min: 80, max: 120 })
    expect(useFilterStore.getState().filter).not.toBe(f)
    expect(lsSet).toHaveBeenCalledWith('miot:correction-filter', expect.objectContaining({ ranges: expect.anything() }))
  })

  it('apply with an identical filter changes nothing and does not persist', () => {
    useFilterStore.getState().apply(cloneFilter(DEFAULT_FILTER))
    expect(lsSet).not.toHaveBeenCalled()
  })

  it('reset restores the default and persists it', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.skipOpen = { enabled: false, n: 1 }
    useFilterStore.getState().apply(f)
    vi.mocked(lsSet).mockClear()
    useFilterStore.getState().reset()
    expect(filtersEqual(useFilterStore.getState().filter, DEFAULT_FILTER)).toBe(true)
    expect(lsSet).toHaveBeenCalledWith('miot:correction-filter', expect.anything())
  })

  it('setShowFilteredPoints takes effect immediately and persists', () => {
    useFilterStore.getState().setShowFilteredPoints(false)
    expect(useFilterStore.getState().showFilteredPoints).toBe(false)
    expect(lsSet).toHaveBeenCalledWith('miot:correction-show-filtered', false)
  })

  it('hydrate with a filter saved without the "before" skips turns them off and keeps the rest', () => {
    const saved = cloneFilter(DEFAULT_FILTER) as unknown as Record<string, unknown>
    delete saved.skipBeforeClosed
    delete saved.skipBeforeOpen
    saved.skipOpen = { enabled: false, n: 4 }
    useFilterStore.getState().hydrate({ filter: saved, showFilteredPoints: true })
    const f = useFilterStore.getState().filter
    expect(f.skipBeforeClosed.enabled).toBe(false)
    expect(f.skipBeforeOpen.enabled).toBe(false)
    expect(f.skipOpen).toEqual({ enabled: false, n: 4 })
  })

  it('hydrate with unreadable data falls back to the default without throwing', () => {
    expect(() => useFilterStore.getState().hydrate({ filter: 'garbage', showFilteredPoints: 'x' })).not.toThrow()
    const s = useFilterStore.getState()
    expect(filtersEqual(s.filter, DEFAULT_FILTER)).toBe(true)
    expect(s.showFilteredPoints).toBe(true)
  })

  it('hydrate restores a saved filter and toggle', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.ranges['RPM'] = { enabled: true, min: 3000, max: null }
    useFilterStore.getState().hydrate({ filter: f, showFilteredPoints: false })
    expect(useFilterStore.getState().filter.ranges['RPM']).toEqual({ enabled: true, min: 3000, max: null })
    expect(useFilterStore.getState().showFilteredPoints).toBe(false)
  })
})
