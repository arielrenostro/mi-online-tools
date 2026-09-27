import { describe, it, expect } from 'vitest'
import { computeTableCellWidth, STICKY_COL_PX, DIVIDER_PX } from './mapTableWidth'

describe('computeTableCellWidth', () => {
  it('splits the (1 - ratio) fraction of the container, minus divider and sticky column, across the columns', () => {
    const containerWidth = 1200
    const ratio = 0.5
    const nCols = 16
    const expected = ((containerWidth * (1 - ratio) - DIVIDER_PX) - STICKY_COL_PX) / nCols
    expect(computeTableCellWidth(containerWidth, nCols, ratio)).toBeCloseTo(expected, 6)
  })

  it('gives two callers the exact same width when given the same inputs (the point of sharing this function)', () => {
    const a = computeTableCellWidth(1400, 16, 0.5)
    const b = computeTableCellWidth(1400, 16, 0.5)
    expect(a).toBe(b)
  })

  it('clamps to a minimum of 24px', () => {
    expect(computeTableCellWidth(300, 16, 0.5)).toBe(24)
  })

  it('returns undefined when there is not enough room for the sticky column', () => {
    expect(computeTableCellWidth(50, 16, 0.5)).toBeUndefined()
  })

  it('returns undefined for zero columns', () => {
    expect(computeTableCellWidth(1200, 0, 0.5)).toBeUndefined()
  })
})
