import { describe, it, expect, beforeEach } from 'vitest'
import { useVisualFilterStore } from './visualFilterStore'
import { emptyVisualFilter, isVisualFilterActive } from '@/utils/visualFilter'

function mapRange() {
  const f = emptyVisualFilter()
  f.ranges.MAP = { enabled: true, min: 80, max: 120 }
  return f
}

describe('visualFilterStore', () => {
  beforeEach(() => useVisualFilterStore.getState().clear())

  it('starts inactive', () => {
    expect(isVisualFilterActive(useVisualFilterStore.getState().filter)).toBe(false)
  })

  it('apply activates, clear deactivates', () => {
    useVisualFilterStore.getState().apply(mapRange())
    expect(isVisualFilterActive(useVisualFilterStore.getState().filter)).toBe(true)
    expect(useVisualFilterStore.getState().filter.ranges.MAP).toEqual({ enabled: true, min: 80, max: 120 })

    useVisualFilterStore.getState().clear()
    expect(isVisualFilterActive(useVisualFilterStore.getState().filter)).toBe(false)
  })

  it('a Lambda Loop selection alone makes the filter active', () => {
    const f = emptyVisualFilter()
    f.lambdaLoop = { enabled: true, states: [1, 2] }
    useVisualFilterStore.getState().apply(f)
    expect(isVisualFilterActive(useVisualFilterStore.getState().filter)).toBe(true)
    expect(useVisualFilterStore.getState().filter.lambdaLoop.states).toEqual([1, 2])
  })

  it('apply with nothing enabled behaves as clear (also drops stale values)', () => {
    useVisualFilterStore.getState().apply(mapRange())
    const f = emptyVisualFilter()
    f.ranges.RPM = { enabled: false, min: 1, max: 2 }
    f.lambdaLoop = { enabled: false, states: [0] }
    useVisualFilterStore.getState().apply(f)
    expect(useVisualFilterStore.getState().filter).toEqual(emptyVisualFilter())
  })
})
