import { describe, it, expect } from 'vitest'
import { confidenceWeightGrid, factorToPercent, formatPercentDelta, percentGrid, computeApplyChanges, computeDirectFactor, computeWeightedFactor, computeFactorGrid } from './correctionDisplay'
import type { CorrectionCell } from '@/types/correction'

describe('computeDirectFactor', () => {
  it('returns null for a cell with no data', () => {
    const cell: CorrectionCell = { n: 0, mean: null, median: null, mode: null }
    expect(computeDirectFactor(cell, 'mean')).toBeNull()
  })

  it('is the selected statistic itself: the cell already holds a ratio against the loaded map', () => {
    const cell: CorrectionCell = { n: 10, mean: 1.036, median: 1.02, mode: 1.01 }
    expect(computeDirectFactor(cell, 'mean')).toBe(1.036)
    expect(computeDirectFactor(cell, 'median')).toBe(1.02)
    expect(computeDirectFactor(cell, 'mode')).toBe(1.01)
  })

  it('a cell exactly as the map needs it is a factor of 1.0', () => {
    expect(computeDirectFactor({ n: 5, mean: 1, median: 1, mode: 1 }, 'mean')).toBe(1)
  })

  it('treats a missing mode as unavailable, not as a crash', () => {
    const cell: CorrectionCell = { n: 10, mean: 1.01, median: 1.02 }
    expect(computeDirectFactor(cell, 'mode')).toBeNull()
    expect(computeWeightedFactor(cell, 'mode')).toBeNull()
  })
})

describe('computeWeightedFactor', () => {
  it('damps the direct factor toward 1.0 based on sample count', () => {
    const cell: CorrectionCell = { n: 100, mean: 1.3, median: 1.3 }
    const factor = computeWeightedFactor(cell, 'mean')!
    const w = 100 / (100 + 100) // default k = 100
    expect(factor).toBeCloseTo(1 + 0.3 * w, 9)
    expect(factor).toBeGreaterThan(1)
    expect(factor).toBeLessThan(1.3)
  })

  it('returns null for a cell with no data', () => {
    const cell: CorrectionCell = { n: 0, mean: null, median: null, mode: null }
    expect(computeWeightedFactor(cell, 'mean')).toBeNull()
  })
})

describe('computeFactorGrid', () => {
  it('produces a grid of the same shape, with null for empty cells', () => {
    const cells: CorrectionCell[][] = [
      [{ n: 10, mean: 1.1, median: 1.1 }, { n: 0, mean: null, median: null, mode: null }],
    ]
    const grid = computeFactorGrid(cells, 'mean', 'direct')
    expect(grid[0][0]).toBeCloseTo(1.1, 9)
    expect(grid[0][1]).toBeNull()
  })

  it('switching the statistic recomputes the whole grid', () => {
    const cells: CorrectionCell[][] = [[{ n: 10, mean: 1.1, median: 0.9, mode: 1.0 }]]
    expect(computeFactorGrid(cells, 'median', 'direct')[0][0]).toBe(0.9)
    expect(computeFactorGrid(cells, 'mode', 'direct')[0][0]).toBe(1.0)
  })
})

describe('computeApplyChanges', () => {
  it('turns each factor into current × factor (rounded), skipping cells without data', () => {
    const grid = [[1.1, null], [0.5, 1]]
    expect(computeApplyChanges(grid, [[500, 500], [501, 400]])).toEqual([
      { row: 0, col: 0, value: 550 },
      { row: 1, col: 0, value: 251 }, // 250.5 rounds to 251
      { row: 1, col: 1, value: 400 },
    ])
  })
})

describe('percent display', () => {
  it('1.05 is +5% and 0.95 is -5%', () => {
    expect(factorToPercent(1.05)).toBeCloseTo(5, 9)
    expect(factorToPercent(0.95)).toBeCloseTo(-5, 9)
    expect(factorToPercent(1)).toBe(0)
    expect(factorToPercent(null)).toBeNull()
  })

  it('formats with sign and one decimal', () => {
    expect(formatPercentDelta(5)).toBe('+5.0%')
    expect(formatPercentDelta(-5)).toBe('-5.0%')
    expect(formatPercentDelta(12.34)).toBe('+12.3%')
    expect(formatPercentDelta(-0.04)).toBe('0.0%')
    expect(formatPercentDelta(0)).toBe('0.0%')
    expect(formatPercentDelta(null)).toBe('—')
  })

  it('converts a whole grid, keeping empty cells empty', () => {
    const g = percentGrid([[1.1, null], [0.9, 1]])
    expect(g[0][0]).toBeCloseTo(10, 9)
    expect(g[0][1]).toBeNull()
    expect(g[1][0]).toBeCloseTo(-10, 9)
    expect(g[1][1]).toBe(0)
  })
})

describe('weighted factor with a custom confidence constant k', () => {
  const cell: CorrectionCell = { n: 100, mean: 1.3, median: 1.3 }

  it('uses w = n / (n + k): a cell with n = k applies half of the correction', () => {
    expect(computeWeightedFactor(cell, 'mean', 100)).toBeCloseTo(1 + 0.3 * 0.5, 9)
  })

  it('a smaller k trusts the samples more, a larger k trusts them less', () => {
    const small = computeWeightedFactor(cell, 'mean', 10)!
    const large = computeWeightedFactor(cell, 'mean', 1000)!
    expect(small).toBeGreaterThan(computeWeightedFactor(cell, 'mean', 100)!)
    expect(large).toBeLessThan(computeWeightedFactor(cell, 'mean', 100)!)
  })

  it('k = 0 makes the weighted factor equal to the direct one', () => {
    expect(computeWeightedFactor(cell, 'mean', 0)).toBeCloseTo(computeDirectFactor(cell, 'mean')!, 9)
  })

  it('defaults to k = 100 when none is given', () => {
    expect(computeWeightedFactor(cell, 'mean')).toBeCloseTo(computeWeightedFactor(cell, 'mean', 100)!, 9)
  })

  it('computeFactorGrid passes k to the weighted grid but never to the direct one', () => {
    const w100 = computeFactorGrid([[cell]], 'mean', 'weighted', 100)[0][0]!
    const w10  = computeFactorGrid([[cell]], 'mean', 'weighted', 10)[0][0]!
    expect(w10).toBeGreaterThan(w100)
    expect(computeFactorGrid([[cell]], 'mean', 'direct', 10)[0][0]).toBeCloseTo(1.3, 9)
  })
})

describe('confidenceWeightGrid', () => {
  const cells: CorrectionCell[][] = [[
    { n: 100, mean: 1.1, median: 1.1 },
    { n: 0, mean: null, median: null, mode: null },
    { n: 300, mean: 1.1, median: 1.1 },
  ]]

  it('is n / (n + k): half at n = k, approaching 1 with many samples, null without data', () => {
    const g = confidenceWeightGrid(cells, 100)
    expect(g[0][0]).toBeCloseTo(0.5, 9)
    expect(g[0][1]).toBeNull()
    expect(g[0][2]).toBeCloseTo(0.75, 9)
  })

  it('follows k: the same n is less trusted with a larger k', () => {
    expect(confidenceWeightGrid(cells, 300)[0][0]!).toBeLessThan(confidenceWeightGrid(cells, 100)[0][0]!)
  })

  it('defaults to k = 100 and is the same weight the Weighted factor uses', () => {
    expect(confidenceWeightGrid(cells)[0][0]).toBeCloseTo(0.5, 9)
    const cell = cells[0][0]
    const direct   = computeDirectFactor(cell, 'mean')!
    const weighted = computeWeightedFactor(cell, 'mean', 100)!
    expect(weighted).toBeCloseTo(1 + (direct - 1) * confidenceWeightGrid(cells, 100)[0][0]!, 9)
  })
})
