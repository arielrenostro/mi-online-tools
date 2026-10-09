import { describe, it, expect } from 'vitest'
import { confidenceWeightGrid, factorToPercent, formatPercentDelta, percentGrid, computeApplyChanges, computeDirectFactor, computeWeightedFactor, computeFactorGrid, rawVeToReal, snapshotHasMode } from './correctionDisplay'
import type { CorrectionCell } from '@/types/correction'
import type { CellGrid } from './correctionDisplay'

describe('rawVeToReal', () => {
  it('converts raw VE (%x10) to real percent', () => {
    expect(rawVeToReal(592)).toBeCloseTo(59.2, 6)
  })
})

describe('computeDirectFactor', () => {
  it('returns null for a cell with no data', () => {
    const cell: CorrectionCell = { n: 0, mean: null, median: null, mode: null }
    expect(computeDirectFactor(cell, 592, 'mean')).toBeNull()
  })

  it('divides the VE Lambda mean (real %) by the map value converted from raw to real', () => {
    // map cell raw = 592 -> real 59.2%; VE Lambda mean = 61.4496% -> factor ~1.0361
    const cell: CorrectionCell = { n: 10, mean: 61.4496, median: 61.4496 }
    const factor = computeDirectFactor(cell, 592, 'mean')!
    expect(factor).toBeCloseTo(61.4496 / 59.2, 6)
    // sanity: a well-matched cell should be close to 1.00, not off by 10x
    expect(factor).toBeGreaterThan(0.5)
    expect(factor).toBeLessThan(2)
  })

  it('uses the median when statMode is median', () => {
    const cell: CorrectionCell = { n: 10, mean: 50, median: 60 }
    expect(computeDirectFactor(cell, 500, 'median')).toBeCloseTo(60 / 50, 6) // 500 raw -> 50 real
  })
})

describe('computeWeightedFactor', () => {
  it('damps the direct factor toward 1.0 based on sample count', () => {
    const cell: CorrectionCell = { n: 100, mean: 65, median: 65 } // direct = 65/50 = 1.3
    const factor = computeWeightedFactor(cell, 500, 'mean')!
    const w = 100 / (100 + 100) // CONFIDENCE_CONSTANT = 100
    expect(factor).toBeCloseTo(1 + (1.3 - 1) * w, 6)
    expect(factor).toBeGreaterThan(1)
    expect(factor).toBeLessThan(1.3)
  })

  it('returns null for a cell with no data', () => {
    const cell: CorrectionCell = { n: 0, mean: null, median: null, mode: null }
    expect(computeWeightedFactor(cell, 500, 'mean')).toBeNull()
  })
})

describe('computeFactorGrid', () => {
  it('produces a grid of the same shape, with null for empty cells', () => {
    const snapshot: CellGrid = {
      cells: [
        [{ n: 10, mean: 59.2, median: 59.2 }, { n: 0, mean: null, median: null, mode: null }],
      ],
    }
    const editableMap = [[592, 592]]
    const grid = computeFactorGrid(snapshot, editableMap, 'mean', 'direct')
    expect(grid[0][0]).toBeCloseTo(1, 6) // 59.2 real == 592 raw/10 -> factor exactly 1.0
    expect(grid[0][1]).toBeNull()
  })
})

describe('mode statistic', () => {
  it('uses the mode when statMode is mode', () => {
    const cell: CorrectionCell = { n: 10, mean: 50, median: 55, mode: 60 }
    expect(computeDirectFactor(cell, 500, 'mode')).toBeCloseTo(60 / 50, 6)
  })

  it('treats a missing mode (older snapshot) as unavailable, not as a crash', () => {
    const cell: CorrectionCell = { n: 10, mean: 50, median: 55 }
    expect(computeDirectFactor(cell, 500, 'mode')).toBeNull()
    expect(computeWeightedFactor(cell, 500, 'mode')).toBeNull()
    expect(computeDirectFactor(cell, 500, 'median')).toBeCloseTo(55 / 50, 6)
  })

  it('snapshotHasMode is false when any cell with data lacks a mode', () => {
    const snap = (cells: CorrectionCell[][]) => ({ cells } as CellGrid)
    const empty: CorrectionCell = { n: 0, mean: null, median: null }
    expect(snapshotHasMode(snap([[{ n: 3, mean: 1, median: 1, mode: 1 }, empty]]))).toBe(true)
    expect(snapshotHasMode(snap([[{ n: 3, mean: 1, median: 1 }, empty]]))).toBe(false)
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

describe('the same run against another map with the same breakpoints', () => {
  it('derives the factors from that map\'s values, with no regeneration', () => {
    const run: CellGrid = { cells: [[{ n: 10, mean: 60, median: 60, mode: 60 }]] }
    expect(computeFactorGrid(run, [[500]], 'mean', 'direct')[0][0]).toBeCloseTo(60 / 50, 6)
    expect(computeFactorGrid(run, [[600]], 'mean', 'direct')[0][0]).toBeCloseTo(1, 6)
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
  const cell: CorrectionCell = { n: 100, mean: 65, median: 65 } // direct = 65 / 50 = 1.3 on a 500 raw cell

  it('uses w = n / (n + k): a cell with n = k applies half of the correction', () => {
    expect(computeWeightedFactor(cell, 500, 'mean', 100)).toBeCloseTo(1 + 0.3 * 0.5, 9)
  })

  it('a smaller k trusts the samples more, a larger k trusts them less', () => {
    const small = computeWeightedFactor(cell, 500, 'mean', 10)!
    const large = computeWeightedFactor(cell, 500, 'mean', 1000)!
    expect(small).toBeGreaterThan(computeWeightedFactor(cell, 500, 'mean', 100)!)
    expect(large).toBeLessThan(computeWeightedFactor(cell, 500, 'mean', 100)!)
  })

  it('k = 0 makes the weighted factor equal to the direct one', () => {
    expect(computeWeightedFactor(cell, 500, 'mean', 0)).toBeCloseTo(computeDirectFactor(cell, 500, 'mean')!, 9)
  })

  it('defaults to k = 100 when none is given', () => {
    expect(computeWeightedFactor(cell, 500, 'mean')).toBeCloseTo(computeWeightedFactor(cell, 500, 'mean', 100)!, 9)
  })

  it('computeFactorGrid passes k to the weighted grid but never to the direct one', () => {
    const run: CellGrid = { cells: [[cell]] }
    const w100 = computeFactorGrid(run, [[500]], 'mean', 'weighted', 100)[0][0]!
    const w10  = computeFactorGrid(run, [[500]], 'mean', 'weighted', 10)[0][0]!
    expect(w10).toBeGreaterThan(w100)
    expect(computeFactorGrid(run, [[500]], 'mean', 'direct', 10)[0][0]).toBeCloseTo(1.3, 9)
  })
})

describe('confidenceWeightGrid', () => {
  const cells: CorrectionCell[][] = [[
    { n: 100, mean: 60, median: 60 },
    { n: 0, mean: null, median: null, mode: null },
    { n: 300, mean: 60, median: 60 },
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
    const direct   = computeDirectFactor(cell, 500, 'mean')!
    const weighted = computeWeightedFactor(cell, 500, 'mean', 100)!
    expect(weighted).toBeCloseTo(1 + (direct - 1) * confidenceWeightGrid(cells, 100)[0][0]!, 9)
  })
})
