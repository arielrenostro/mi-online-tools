import { describe, it, expect } from 'vitest'
import { rightAxisWidth, rightAxisLayout, panelMargins, sharedMargins } from './chartAxisLayout'

describe('rightAxisWidth', () => {
  it('grows with the widest label of the range', () => {
    expect(rightAxisWidth({ min: 0, max: 30 })).toBeLessThan(rightAxisWidth({ min: 0, max: 10000 }))
    expect(rightAxisWidth({ min: -30, max: 30 })).toBe(rightAxisWidth({ min: 0, max: 100 }))
  })

  it('counts the decimal point and sign', () => {
    expect(rightAxisWidth({ min: 0.7, max: 1.3 })).toBe(rightAxisWidth({ min: -30, max: 30 }))
  })

  it('assumes a wide label when the range is unknown', () => {
    expect(rightAxisWidth(undefined)).toBe(rightAxisWidth({ min: 0, max: 10000 }))
  })
})

describe('rightAxisLayout', () => {
  const small = { min: 0, max: 100 }

  it('reserves only the x-label overhang when there is no right axis', () => {
    expect(rightAxisLayout([])).toEqual({ offsets: [], gridRight: 20 })
  })

  it('puts a single right axis flush with the plot and reserves its own width', () => {
    const l = rightAxisLayout([small])
    expect(l.offsets).toEqual([0])
    expect(l.gridRight).toBe(rightAxisWidth(small) + 4)
  })

  it('stacks the next axis right after the previous one\'s labels, plus a small gap', () => {
    const wide = { min: 0, max: 10000 }
    const l = rightAxisLayout([small, wide, small])
    expect(l.offsets[0]).toBe(0)
    expect(l.offsets[1]).toBe(rightAxisWidth(small) + 6)
    expect(l.offsets[2]).toBe(l.offsets[1] + rightAxisWidth(wide) + 6)
    expect(l.gridRight).toBe(l.offsets[2] + rightAxisWidth(small) + 4)
  })
})

describe('panelMargins / sharedMargins', () => {
  const small = { min: 0, max: 100 }
  const wide = { min: 0, max: 10000 }

  it('left = first signal\'s axis, right = the stacked axes of the others', () => {
    const m = panelMargins([wide, small, small])
    expect(m.left).toBe(rightAxisWidth(wide) + 4)
    expect(m.right).toBe(rightAxisLayout([small, small]).gridRight)
  })

  it('a single-signal panel keeps only the x-label overhang on the right', () => {
    expect(panelMargins([small]).right).toBe(20)
  })

  it('takes the largest margin of each side across panels', () => {
    const m = sharedMargins([[small], [wide, small, small], [small, wide]])!
    expect(m.left).toBe(panelMargins([wide]).left)
    expect(m.right).toBe(panelMargins([small, small, small]).right)
  })

  it('ignores empty panels and returns nothing when none has a signal', () => {
    expect(sharedMargins([[], [small]])).toEqual(panelMargins([small]))
    expect(sharedMargins([[], []])).toBeUndefined()
  })
})
