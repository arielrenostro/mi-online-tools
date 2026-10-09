import { describe, it, expect } from 'vitest'
import { windowFor, windowCovers, nextWindow, windowRows, MAX_OVERSIZE } from './chartWindow'
import type { DatalogRow } from '@/types/datalog'

const domain = { start_ms: 0, end_ms: 10_000 }
const mkRows = (n: number): DatalogRow[] => Array.from({ length: n }, (_, i) => ({ timestamp_ms: i * 100 }))

describe('windowFor', () => {
  it('pads the visible range by one width on each side', () => {
    expect(windowFor({ start_ms: 4000, end_ms: 5000 }, domain)).toEqual({ start_ms: 3000, end_ms: 6000 })
  })

  it('clamps to the domain', () => {
    expect(windowFor({ start_ms: 0, end_ms: 2000 }, domain)).toEqual({ start_ms: 0, end_ms: 4000 })
    expect(windowFor({ start_ms: 9000, end_ms: 10_000 }, domain)).toEqual({ start_ms: 8000, end_ms: 10_000 })
  })

  it('is the whole domain when the visible range is the whole domain', () => {
    expect(windowFor(domain, domain)).toEqual(domain)
  })
})

describe('windowCovers', () => {
  const visible = { start_ms: 4000, end_ms: 5000 }

  it('is false without a loaded window', () => {
    expect(windowCovers(null, visible, domain)).toBe(false)
  })

  it('is true while the visible range stays inside the loaded window', () => {
    const loaded = windowFor(visible, domain)
    expect(windowCovers(loaded, { start_ms: 4300, end_ms: 5300 }, domain)).toBe(true)
  })

  it('is false once the visible range leaves the loaded window', () => {
    const loaded = windowFor(visible, domain)
    expect(windowCovers(loaded, { start_ms: 5500, end_ms: 6500 }, domain)).toBe(false)
  })

  it('treats the domain edge as reached', () => {
    const loaded = windowFor({ start_ms: 0, end_ms: 1000 }, domain)
    expect(windowCovers(loaded, { start_ms: 0, end_ms: 1200 }, domain)).toBe(true)
  })

  it('is false when the loaded window is much wider than needed (zoomed in)', () => {
    const wide = windowFor(domain, domain)
    const zoomed = { start_ms: 4000, end_ms: 4500 }
    expect(width(wide) > MAX_OVERSIZE * width(windowFor(zoomed, domain))).toBe(true)
    expect(windowCovers(wide, zoomed, domain)).toBe(false)
  })

  it('keeps the full-domain window for the unzoomed overview', () => {
    expect(windowCovers(domain, domain, domain)).toBe(true)
  })
})

function width(w: { start_ms: number; end_ms: number }) { return w.end_ms - w.start_ms }

describe('nextWindow', () => {
  it('returns the same window while it still covers the visible range', () => {
    const w1 = nextWindow(null, { start_ms: 4000, end_ms: 5000 }, domain)
    const w2 = nextWindow(w1, { start_ms: 4200, end_ms: 5200 }, domain)
    expect(w2).toBe(w1)
  })

  it('builds a new window when the range moves away', () => {
    const w1 = nextWindow(null, { start_ms: 1000, end_ms: 2000 }, domain)
    const w2 = nextWindow(w1, { start_ms: 7000, end_ms: 8000 }, domain)
    expect(w2).not.toBe(w1)
    expect(w2).toEqual({ start_ms: 6000, end_ms: 9000 })
  })
})

describe('windowRows', () => {
  const rows = mkRows(101) // 0..10000 ms
  const mask = rows.map((_, i) => i % 2 === 0)

  it('returns the same arrays without a window', () => {
    const r = windowRows(rows, mask, null)
    expect(r.rows).toBe(rows)
    expect(r.mask).toBe(mask)
  })

  it('slices rows and mask together, with one extra row on each side', () => {
    const r = windowRows(rows, mask, { start_ms: 3000, end_ms: 5000 })
    expect(r.rows[0].timestamp_ms).toBe(2900)
    expect(r.rows[r.rows.length - 1].timestamp_ms).toBe(5100)
    expect(r.mask).toHaveLength(r.rows.length)
    r.rows.forEach((row, i) => expect(r.mask[i]).toBe((row.timestamp_ms / 100) % 2 === 0))
  })

  it('clamps at both ends of the log', () => {
    const r = windowRows(rows, mask, { start_ms: -500, end_ms: 400 })
    expect(r.rows[0].timestamp_ms).toBe(0)
    expect(r.rows[r.rows.length - 1].timestamp_ms).toBe(500)
    const e = windowRows(rows, mask, { start_ms: 9800, end_ms: 20_000 })
    expect(e.rows[e.rows.length - 1].timestamp_ms).toBe(10_000)
  })

  it('returns the original arrays when the window covers the whole log', () => {
    const r = windowRows(rows, mask, { start_ms: 0, end_ms: 10_000 })
    expect(r.rows).toBe(rows)
    expect(r.mask).toBe(mask)
  })

  it('handles an empty log', () => {
    const r = windowRows([], [], { start_ms: 0, end_ms: 1 })
    expect(r.rows).toEqual([])
  })
})

describe('re-windowing while panning and zooming', () => {
  const big = { start_ms: 0, end_ms: 7_200_000 } // 2h

  it('a window built for a range is stable for that same range (no rebuild loop)', () => {
    const visible = { start_ms: 3_000_000, end_ms: 3_600_000 }
    const w = nextWindow(null, visible, big)
    expect(nextWindow(w, visible, big)).toBe(w)
  })

  it('a steady pan across the log rebuilds only a handful of times', () => {
    const width = 600_000 // 10 min visible
    const step = width / 20 // many small wheel/drag events
    let win = null as ReturnType<typeof nextWindow> | null
    let rebuilds = 0
    for (let start = 0; start + width <= big.end_ms; start += step) {
      const next = nextWindow(win, { start_ms: start, end_ms: start + width }, big)
      if (next !== win) rebuilds++
      win = next
    }
    // 2h / 10min = 12 screens panned in 20 events each (240 events): about one rebuild per screen
    // panned (the margin is one width), not one per event
    expect(rebuilds).toBeLessThanOrEqual(13)
  })

  it('zooming in from the overview rebuilds to a smaller window', () => {
    const overview = nextWindow(null, big, big)
    expect(overview).toEqual(big)
    const zoomed = nextWindow(overview, { start_ms: 3_000_000, end_ms: 3_300_000 }, big)
    expect(zoomed.end_ms - zoomed.start_ms).toBeLessThan((big.end_ms - big.start_ms) / 2)
  })

  it('zooming out keeps the window until the range outgrows it', () => {
    const w = nextWindow(null, { start_ms: 3_000_000, end_ms: 3_300_000 }, big)
    expect(nextWindow(w, { start_ms: 2_950_000, end_ms: 3_350_000 }, big)).toBe(w)
    expect(nextWindow(w, { start_ms: 2_000_000, end_ms: 4_000_000 }, big)).not.toBe(w)
  })
})
