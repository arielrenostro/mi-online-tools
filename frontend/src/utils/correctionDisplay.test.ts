import { describe, it, expect } from 'vitest'
import { computeDirectFactor, computeWeightedFactor, computeFactorGrid, rawVeToReal } from './correctionDisplay'
import type { CorrectionCell, CorrectionSnapshot } from '@/types/correction'

describe('rawVeToReal', () => {
  it('converts raw VE (%x10) to real percent', () => {
    expect(rawVeToReal(592)).toBeCloseTo(59.2, 6)
  })
})

describe('computeDirectFactor', () => {
  it('returns null for a cell with no data', () => {
    const cell: CorrectionCell = { n: 0, mean: null, median: null }
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
    const cell: CorrectionCell = { n: 0, mean: null, median: null }
    expect(computeWeightedFactor(cell, 500, 'mean')).toBeNull()
  })
})

describe('computeFactorGrid', () => {
  it('produces a grid of the same shape, with null for empty cells', () => {
    const snapshot: CorrectionSnapshot = {
      cells: [
        [{ n: 10, mean: 59.2, median: 59.2 }, { n: 0, mean: null, median: null }],
      ],
      generatedAt: 0,
      provenance: { logFilenames: [], timeRange: null, filters: {} as never },
    }
    const editableMap = [[592, 592]]
    const grid = computeFactorGrid(snapshot, editableMap, 'mean', 'direct')
    expect(grid[0][0]).toBeCloseTo(1, 6) // 59.2 real == 592 raw/10 -> factor exactly 1.0
    expect(grid[0][1]).toBeNull()
  })
})
