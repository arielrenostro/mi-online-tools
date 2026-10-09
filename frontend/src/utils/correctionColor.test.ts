import { describe, it, expect } from 'vitest'
import { confidenceOpacity, correctionColor, fadeToNeutral, NEUTRAL_CELL_COLOR, CORRECTION_COLOR_STOPS, CORRECTION_LIMIT_PCT, MIN_CONFIDENCE_OPACITY } from './correctionColor'

const stop = (pct: number) => CORRECTION_COLOR_STOPS.find(s => s.pct === pct)!.color
const brightness = (c: number[]) => (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000

describe('correctionColor', () => {
  it('hits the anchor colors exactly at 0, 2, 5, 10 and 15 points', () => {
    for (const pct of [0, 2, 5, 10, 15]) expect(correctionColor(pct)).toEqual(stop(pct))
  })

  it('is symmetric: +5% and -5% have the same color', () => {
    expect(correctionColor(-5)).toEqual(correctionColor(5))
    expect(correctionColor(-12.3)).toEqual(correctionColor(12.3))
  })

  it('5% is already a warning (yellow), 10% is strong (red) and 15% is the limit (darkest)', () => {
    expect(correctionColor(5)).toEqual([234, 179, 8])
    expect(correctionColor(10)).toEqual([239, 68, 68])
    const limit = correctionColor(CORRECTION_LIMIT_PCT)
    expect(brightness(limit)).toBeLessThan(brightness(correctionColor(10)))
  })

  it('stops getting darker past the 15% limit', () => {
    expect(correctionColor(15)).toEqual(correctionColor(40))
    expect(correctionColor(-30)).toEqual(correctionColor(15))
  })

  it('interpolates between anchors (7.5% sits between yellow and red)', () => {
    const c = correctionColor(7.5)
    expect(c[0]).toBeGreaterThan(234)
    expect(c[0]).toBeLessThan(240)
    expect(c[1]).toBeLessThan(179)
    expect(c[1]).toBeGreaterThan(68)
  })

  it('a tiny correction stays cool (close to blue)', () => {
    const c = correctionColor(0.2)
    expect(c[2]).toBeGreaterThan(200)
  })
})

describe('confidenceOpacity', () => {
  it('goes from the minimum (no confidence) to fully opaque (full confidence)', () => {
    expect(confidenceOpacity(0)).toBeCloseTo(MIN_CONFIDENCE_OPACITY, 9)
    expect(confidenceOpacity(1)).toBe(1)
  })

  it('grows with the confidence and is half-way up at w = 0.5', () => {
    expect(confidenceOpacity(0.25)).toBeLessThan(confidenceOpacity(0.5))
    expect(confidenceOpacity(0.5)).toBeLessThan(confidenceOpacity(0.9))
    expect(confidenceOpacity(0.5)).toBeCloseTo((MIN_CONFIDENCE_OPACITY + 1) / 2, 9)
  })

  it('clamps out-of-range weights', () => {
    expect(confidenceOpacity(-1)).toBeCloseTo(MIN_CONFIDENCE_OPACITY, 9)
    expect(confidenceOpacity(5)).toBe(1)
  })
})

describe('fadeToNeutral', () => {
  it('opacity 1 keeps the color, opacity 0 is the neutral empty-cell color', () => {
    expect(fadeToNeutral([239, 68, 68], 1)).toEqual([239, 68, 68])
    expect(fadeToNeutral([239, 68, 68], 0)).toEqual(NEUTRAL_CELL_COLOR)
  })

  it('never goes darker than the darker of the color and the neutral (no black holes)', () => {
    const maroon = correctionColor(15)
    const lum = (c: number[]) => (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000
    for (const o of [0.2, 0.4, 0.6, 0.8, 1]) {
      expect(lum(fadeToNeutral(maroon, o))).toBeGreaterThanOrEqual(Math.min(lum(maroon), lum(NEUTRAL_CELL_COLOR)) - 1)
    }
  })

  it('low-confidence cells of very different colors end up close to each other', () => {
    const a = fadeToNeutral(correctionColor(15), 0.2)
    const b = fadeToNeutral(correctionColor(5), 0.2)
    const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
    const rawDist = Math.hypot(...correctionColor(15).map((v, i) => v - correctionColor(5)[i]))
    expect(dist).toBeLessThan(rawDist / 3)
  })
})
