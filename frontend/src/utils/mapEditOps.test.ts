import { describe, it, expect } from 'vitest'
import {
  selectionRect, isSingleCell, interpolateHorizontal, interpolateVertical,
  bulkAdjustChanges, scaleChanges, clearRangeChanges, toTsv, pasteChanges,
  type Cells,
} from './mapEditOps'

const grid: Cells = [
  [100, 200, 300, 400],
  [10,  20,  30,  40],
  [null, 5,  null, 9],
]

describe('selectionRect', () => {
  it('returns null without selection', () => {
    expect(selectionRect(null)).toBeNull()
  })
  it('normalizes a reversed range', () => {
    expect(selectionRect({ anchor: { r: 2, c: 3 }, selEnd: { r: 0, c: 1 } }))
      .toEqual({ r0: 0, r1: 2, c0: 1, c1: 3 })
  })
  it('uses the anchor alone when selEnd is null', () => {
    const sr = selectionRect({ anchor: { r: 1, c: 2 }, selEnd: null })
    expect(sr).toEqual({ r0: 1, r1: 1, c0: 2, c1: 2 })
    expect(isSingleCell(sr)).toBe(true)
  })
})

describe('interpolate', () => {
  it('horizontal fills interior columns and keeps the edges', () => {
    expect(interpolateHorizontal(grid, { r0: 0, r1: 0, c0: 0, c1: 3 })).toEqual([
      { row: 0, col: 1, value: 200 },
      { row: 0, col: 2, value: 300 },
    ])
  })
  it('horizontal is a no-op below 3 columns', () => {
    expect(interpolateHorizontal(grid, { r0: 0, r1: 1, c0: 0, c1: 1 })).toEqual([])
  })
  it('vertical skips a column with a non-numeric edge', () => {
    const out = interpolateVertical(grid, { r0: 0, r1: 2, c0: 0, c1: 1 })
    expect(out).toEqual([{ row: 1, col: 1, value: 102.5 }])
  })
})

describe('bulkAdjustChanges', () => {
  const sr = { r0: 0, r1: 1, c0: 0, c1: 1 }
  it('fixed sets every numeric cell', () => {
    expect(bulkAdjustChanges(grid, sr, 'fixed', 50).map(c => c.value)).toEqual([50, 50, 50, 50])
  })
  it('add applies a delta', () => {
    expect(bulkAdjustChanges(grid, sr, 'add', 5).map(c => c.value)).toEqual([105, 205, 15, 25])
  })
  it('pct uses each cell\'s own value', () => {
    expect(bulkAdjustChanges(grid, sr, 'pct', 10).map(c => c.value)).toEqual([110, 220, 11, 22].map(v => expect.closeTo(v, 6)))
  })
  it('skips non-numeric cells', () => {
    expect(bulkAdjustChanges(grid, { r0: 2, r1: 2, c0: 0, c1: 1 }, 'fixed', 1)).toEqual([
      { row: 2, col: 1, value: 1 },
    ])
  })
})

describe('scale / clear', () => {
  it('scaleChanges multiplies by the factor', () => {
    const [ch] = scaleChanges(grid, { r0: 0, r1: 0, c0: 0, c1: 0 }, 1.01)
    expect(ch.value).toBeCloseTo(101)
  })
  it('clearRangeChanges zeroes numeric cells only', () => {
    expect(clearRangeChanges(grid, { r0: 2, r1: 2, c0: 0, c1: 3 })).toEqual([
      { row: 2, col: 1, value: 0 },
      { row: 2, col: 3, value: 0 },
    ])
  })
})

describe('clipboard', () => {
  it('toTsv keeps on-screen order and blanks nulls', () => {
    expect(toTsv(grid, { r0: 1, r1: 2, c0: 0, c1: 2 })).toBe('10\t20\t30\n\t5\t')
  })
  it('pasteChanges clips to the grid and ignores non-numbers', () => {
    expect(pasteChanges('1\t2\nx\t4', { r: 1, c: 3 }, 3, 4)).toEqual([
      { row: 1, col: 3, value: 1 },
    ])
  })
})
