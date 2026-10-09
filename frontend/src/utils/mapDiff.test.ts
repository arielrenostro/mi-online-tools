import { describe, it, expect } from 'vitest'
import { diffPercent, formatCellDiffTitle } from './mapDiff'

describe('diffPercent', () => {
  it('is the change relative to the original, in percent', () => {
    expect(diffPercent(500, 525)).toBeCloseTo(5, 9)
    expect(diffPercent(500, 475)).toBeCloseTo(-5, 9)
    expect(diffPercent(200, 200)).toBe(0)
  })

  it('has no base when the original is zero and the value changed, and is 0 when both are zero', () => {
    expect(diffPercent(0, 3)).toBeNull()
    expect(diffPercent(0, 0)).toBe(0)
  })

  it('uses the magnitude of the original so the sign always follows the direction of the change', () => {
    expect(diffPercent(-10, -5)).toBeCloseTo(50, 9)
    expect(diffPercent(-10, -15)).toBeCloseTo(-50, 9)
  })
})

describe('formatCellDiffTitle', () => {
  const fmt = (v: number) => String(v)

  it('lists the original, the current value and the signed percentage', () => {
    expect(formatCellDiffTitle(560, 588, fmt)).toBe('Original: 560\nAtual: 588\nDiferença: +5.0%')
    expect(formatCellDiffTitle(560, 532, fmt)).toBe('Original: 560\nAtual: 532\nDiferença: -5.0%')
  })

  it('shows 0.0% for an untouched cell', () => {
    expect(formatCellDiffTitle(560, 560, fmt)).toBe('Original: 560\nAtual: 560\nDiferença: 0.0%')
  })

  it('shows a dash when there is no base for the percentage', () => {
    expect(formatCellDiffTitle(0, 4, fmt)).toBe('Original: 0\nAtual: 4\nDiferença: —')
  })

  it('formats the values with the table\'s own formatter', () => {
    expect(formatCellDiffTitle(0.95, 1, v => v.toFixed(3))).toBe('Original: 0.950\nAtual: 1.000\nDiferença: +5.3%')
  })
})
