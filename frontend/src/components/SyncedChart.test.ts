import { describe, it, expect } from 'vitest'
import { computeRuns, buildOption } from './SyncedChart'
import { windowRows } from '@/utils/chartWindow'
import type { DatalogRow } from '@/types/datalog'

describe('computeRuns', () => {
  it('returns one run covering everything when the mask never changes', () => {
    expect(computeRuns([true, true, true])).toEqual([{ start: 0, end: 2, pass: true }])
  })

  it('splits into runs at every value change', () => {
    const mask = [true, true, false, false, false, true, false]
    expect(computeRuns(mask)).toEqual([
      { start: 0, end: 1, pass: true },
      { start: 2, end: 4, pass: false },
      { start: 5, end: 5, pass: true },
      { start: 6, end: 6, pass: false },
    ])
  })

  it('returns an empty array for an empty mask', () => {
    expect(computeRuns([])).toEqual([])
  })

  it('handles a single-element mask', () => {
    expect(computeRuns([false])).toEqual([{ start: 0, end: 0, pass: false }])
  })
})

describe('buildOption', () => {
  const rows: DatalogRow[] = Array.from({ length: 101 }, (_, i) => ({ timestamp_ms: i * 100, RPM: 1000 + i }))
  const mask = rows.map(() => true)
  type Opt = { xAxis: { min: unknown; max: unknown }; series: { data: number[][] }[] }
  const pointCount = (o: Opt) => o.series.reduce((n, s) => n + s.data.length, 0)

  it('draws every point of the log it receives, with the axis following the data by default', () => {
    const o = buildOption(['RPM'], rows, mask, true) as Opt
    expect(pointCount(o)).toBe(rows.length)
    expect(o.xAxis.min).toBe('dataMin')
    expect(o.xAxis.max).toBe('dataMax')
  })

  it('keeps the time axis on the whole log when only a window of it is drawn', () => {
    const w = windowRows(rows, mask, { start_ms: 4000, end_ms: 6000 })
    const o = buildOption(['RPM'], w.rows, w.mask, true, { xDomain: [0, 10_000] }) as Opt
    expect(o.xAxis.min).toBe(0)
    expect(o.xAxis.max).toBe(10_000)
    expect(pointCount(o)).toBe(w.rows.length)
    expect(pointCount(o)).toBeLessThan(rows.length)
    o.series.forEach(s => s.data.forEach(([t]) => {
      expect(t).toBeGreaterThanOrEqual(3900)
      expect(t).toBeLessThanOrEqual(6100)
    }))
  })

  it('keeps each point of a windowed log with its own pass/fail state', () => {
    const m = rows.map((_, i) => i % 10 < 5)
    const w = windowRows(rows, m, { start_ms: 4000, end_ms: 6000 })
    const full = buildOption(['RPM'], rows, m, true) as Opt
    const win = buildOption(['RPM'], w.rows, w.mask, true, { xDomain: [0, 10_000] }) as Opt
    // every point drawn in the window is drawn at the same value in the full chart
    const fullValues = new Map(full.series.flatMap(s => s.data).map(([t, v]) => [t, v]))
    win.series.forEach(s => s.data.forEach(([t, v]) => expect(fullValues.get(t)).toBe(v)))
  })
})
