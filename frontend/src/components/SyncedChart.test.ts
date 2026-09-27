import { describe, it, expect } from 'vitest'
import { computeRuns } from './SyncedChart'

describe('computeRuns', () => {
  it('returns one run covering everything when the mask never changes', () => {
    expect(computeRuns([true, true, true])).toEqual([{ start: 0, end: 2, pass: true }])
  })

  it('splits into runs at every value change', () => {
    const mask = [true, true, false, false, false, true, false]
    expect(computeRuns(mask)).toEqual([
      { start: 0, end: 1, pass: true },
      { start: 2, end: 4, pass: false },
      { start: 5, end: 5, pass: true },
      { start: 6, end: 6, pass: false },
    ])
  })

  it('returns an empty array for an empty mask', () => {
    expect(computeRuns([])).toEqual([])
  })

  it('handles a single-element mask', () => {
    expect(computeRuns([false])).toEqual([{ start: 0, end: 0, pass: false }])
  })
})
