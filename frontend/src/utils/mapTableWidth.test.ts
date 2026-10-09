import { describe, it, expect } from 'vitest'
import { computeTableCellWidth, computePairCellWidth, STICKY_COL_PX, DIVIDER_PX, PAIR_FIXED_PX, PAIR_SLACK_PX } from './mapTableWidth'

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

describe('computePairCellWidth', () => {
  const GAP = 16

  it('two tables plus the gap never exceed the container, for any ratio and width', () => {
    for (const width of [700, 900, 1200, 1460, 1900, 2600]) {
      for (const ratio of [0.15, 0.3, 0.5, 0.75]) {
        const cw = computePairCellWidth(width, 6, GAP, ratio)
        if (cw === undefined) continue
        const total = 2 * (PAIR_FIXED_PX + cw * 6) + GAP
        // below the 24px/cell floor the pair is allowed to scroll; otherwise it must fit
        if (cw > 24) expect(total).toBeLessThanOrEqual(width + 1e-6)
      }
    }
  })

  it('keeps the width of the map table above when two of them fit with room to spare', () => {
    const width = 1460
    const cw = computePairCellWidth(width, 6, GAP, 0.6)! // map table takes 40%: two fit easily
    expect(PAIR_FIXED_PX + cw * 6).toBeCloseTo(width * 0.4 - DIVIDER_PX, 6)
  })

  it('at the default 50/50 split stays within a couple of pixels of the map table above', () => {
    const width = 1460
    const cw = computePairCellWidth(width, 6, GAP, 0.5)!
    expect(Math.abs(PAIR_FIXED_PX + cw * 6 - (width * 0.5 - DIVIDER_PX))).toBeLessThanOrEqual(PAIR_SLACK_PX / 2)
  })

  it('shrinks to half the space left after the gap when the map table is wider than that', () => {
    const width = 1460
    const cw = computePairCellWidth(width, 6, GAP, 0.2)! // map table would take 80% of the width
    expect(PAIR_FIXED_PX + cw * 6).toBeCloseTo((width - GAP - PAIR_SLACK_PX) / 2, 6)
  })

  it('clamps to 24px per cell and returns undefined without room or columns', () => {
    expect(computePairCellWidth(400, 16, GAP, 0.5)).toBe(24)
    expect(computePairCellWidth(100, 6, GAP, 0.5)).toBeUndefined()
    expect(computePairCellWidth(1200, 0, GAP, 0.5)).toBeUndefined()
  })
})
