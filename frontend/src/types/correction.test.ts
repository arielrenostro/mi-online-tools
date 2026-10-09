import { describe, it, expect } from 'vitest'
import { breakpointsEqual } from './correction'

const bp = { map: [90, 80], rpm: [3200, 3600] }

describe('breakpointsEqual', () => {
  it('is true for identical MAP and RPM breakpoints', () => {
    expect(breakpointsEqual(bp, { map: [90, 80], rpm: [3200, 3600] })).toBe(true)
  })
  it('is false when an RPM breakpoint differs', () => {
    expect(breakpointsEqual(bp, { map: [90, 80], rpm: [3200, 3700] })).toBe(false)
  })
  it('is false when a MAP breakpoint differs', () => {
    expect(breakpointsEqual(bp, { map: [90, 75], rpm: [3200, 3600] })).toBe(false)
  })
  it('is false when the sizes differ', () => {
    expect(breakpointsEqual(bp, { map: [90], rpm: [3200, 3600] })).toBe(false)
  })
})
