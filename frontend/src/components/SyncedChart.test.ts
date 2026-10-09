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

  describe('Y axis range', () => {
    type YOpt = { yAxis: { min: number; max: number }[] }
    const two = rows.map(r => ({ ...r, MAP: 100 }))

    it('uses the default range of each signal when there is no override', () => {
      const o = buildOption(['RPM', 'MAP'], two, mask, true) as YOpt
      expect(o.yAxis.map(a => [a.min, a.max])).toEqual([[0, 7000], [0, 200]])
    })

    it('uses an override for that signal only', () => {
      const o = buildOption(['RPM', 'MAP'], two, mask, true, undefined, { MAP: { min: 0, max: 400 } }) as YOpt
      expect(o.yAxis.map(a => [a.min, a.max])).toEqual([[0, 7000], [0, 400]])
    })

    it('does not change the series data', () => {
      const a = buildOption(['MAP'], two, mask, true) as Opt
      const b = buildOption(['MAP'], two, mask, true, undefined, { MAP: { min: 0, max: 400 } }) as Opt
      expect(b.series).toEqual(a.series)
    })
  })
})

describe('buildOption — right-side Y axes', () => {
  const rows: DatalogRow[] = [{ timestamp_ms: 0, RPM: 1000, MAP: 100, Pedal: 10, 'Lambda 1': 1 }]
  const mask = [true]
  type Opt = { grid: { right: number }; yAxis: { position: string; offset: number; axisLabel: { margin: number } }[] }
  const build = (signals: string[]) => buildOption(signals, rows, mask, true) as Opt

  it('puts the first signal on the left and the rest on the right, the first right axis flush with the plot', () => {
    const o = build(['RPM', 'MAP', 'Pedal', 'Lambda 1'])
    expect(o.yAxis.map(a => a.position)).toEqual(['left', 'right', 'right', 'right'])
    expect(o.yAxis[1].offset).toBe(0)
    expect(o.yAxis[2].offset).toBeGreaterThan(0)
    expect(o.yAxis[3].offset).toBeGreaterThan(o.yAxis[2].offset)
  })

  it('reserves just enough on the right for the stacked axes', () => {
    expect(build(['RPM']).grid.right).toBe(20)
    const two = build(['RPM', 'MAP']).grid.right
    const four = build(['RPM', 'MAP', 'Pedal', 'Lambda 1']).grid.right
    expect(two).toBeLessThan(60)
    expect(four).toBeGreaterThan(two)
  })

  it('takes the shared margins when given, so every panel lines up', () => {
    const o = buildOption(['RPM'], rows, mask, true, undefined, undefined, { left: 40, right: 90 }) as Opt & { grid: { left: number } }
    expect(o.grid.left).toBe(40)
    expect(o.grid.right).toBe(90)
  })

  it('sizes the left margin to the first signal\'s labels, with no fixed padding', () => {
    const left = (buildOption(['RPM'], rows, mask, true) as { grid: { left: number } }).grid.left
    expect(left).toBeLessThan(52)
  })

  it('uses a tight gap between each axis line and its labels', () => {
    expect(build(['RPM', 'MAP']).yAxis.every(a => a.axisLabel.margin === 4)).toBe(true)
  })
})
