import { describe, it, expect } from 'vitest'
import {
  bilinearWeights, computeCorrectionCells, defaultRunName, densestClusterMode, generateCorrectionRun, toPerLogRanges,
} from './correctionGeneration'
import { DEFAULT_FILTER, filtersEqual } from '@/types/filter'
import type { DatalogRow, LogEntry } from '@/types/datalog'

// Frontend convention: mapBreakpoints descending (index 0 = highest MAP); rpmBreakpoints ascending.
const MAP_BPS = [90, 80] // descending
const RPM_BPS = [3200, 3600] // ascending

describe('bilinearWeights', () => {
  it('splits a point strictly between breakpoints on both axes into 4 weighted cells', () => {
    // RPM=3350 -> 0.375 toward 3600, 0.625 toward 3200
    // MAP=84   -> 0.4 toward 90,   0.6 toward 80
    const weights = bilinearWeights(84, 3350, MAP_BPS, RPM_BPS)
    const byCell = new Map(weights.map(w => [`${w.rowI}:${w.colJ}`, w.weight]))

    expect(byCell.get('0:0')).toBeCloseTo(0.4 * 0.625, 6)  // MAP=90(row0), RPM=3200(col0)
    expect(byCell.get('0:1')).toBeCloseTo(0.4 * 0.375, 6)  // MAP=90(row0), RPM=3600(col1)
    expect(byCell.get('1:0')).toBeCloseTo(0.6 * 0.625, 6)  // MAP=80(row1), RPM=3200(col0)
    expect(byCell.get('1:1')).toBeCloseTo(0.6 * 0.375, 6)  // MAP=80(row1), RPM=3600(col1)
    const sum = weights.reduce((s, w) => s + w.weight, 0)
    expect(sum).toBeCloseTo(1, 6)
  })

  it('splits into 2 cells when exactly on one axis breakpoint', () => {
    const weights = bilinearWeights(90, 3350, MAP_BPS, RPM_BPS) // MAP exact, RPM between
    expect(weights).toHaveLength(2)
    expect(weights.every(w => w.rowI === 0)).toBe(true)
    const sum = weights.reduce((s, w) => s + w.weight, 0)
    expect(sum).toBeCloseTo(1, 6)
  })

  it('assigns full weight to a single cell when exactly on both breakpoints', () => {
    const weights = bilinearWeights(90, 3200, MAP_BPS, RPM_BPS)
    expect(weights).toEqual([{ rowI: 0, colJ: 0, weight: 1 }])
  })

  it('returns no weights for a point outside the MAP or RPM range', () => {
    expect(bilinearWeights(200, 3350, MAP_BPS, RPM_BPS)).toEqual([])
    expect(bilinearWeights(84, 100, MAP_BPS, RPM_BPS)).toEqual([])
  })
})

function makeRow(rpm: number, mapKpa: number, veLambdaInputs: Partial<DatalogRow>, ts: number): DatalogRow {
  return {
    timestamp_ms: ts,
    'RPM': rpm, 'MAP': mapKpa,
    'Lambda 1': 1.0, 'Lambda Target': 1.0, 'Lambda Corr': 0, 'VE': 50,
    'CLT': 90, 'Lambda Loop': 1, 'Pedal': 0,
    ...veLambdaInputs,
  }
}

function makeLog(rows: DatalogRow[], hash = 'h', enabled = true, duration?: number): LogEntry {
  const d = duration ?? rows[rows.length - 1]?.timestamp_ms ?? 0
  return {
    hash, filename: `${hash}.csv`, enabled,
    duration_ms: d,
    model: { hash, filename: `${hash}.csv`, rows, duration_ms: d, signals: [] },
  }
}

describe('computeCorrectionCells', () => {
  it('aggregates weighted mean and unweighted median per cell from exact-breakpoint points', () => {
    // Two points exactly on cell (row0=MAP90, col0=RPM3200), VE Lambda = 50 and 60 respectively (weight 1 each)
    const rows = [
      makeRow(3200, 90, { 'VE': 50 }, 0),   // VE Lambda = (1-1+1+0)*50 = 50
      makeRow(3200, 90, { 'VE': 60 }, 100), // VE Lambda = 60
    ]
    const cells = computeCorrectionCells([makeLog(rows)], DEFAULT_FILTER, null, MAP_BPS, RPM_BPS)
    const cell = cells[0][0]
    expect(cell.n).toBeCloseTo(2, 6)
    expect(cell.mean).toBeCloseTo(55, 6)
    expect(cell.median).toBeCloseTo(55, 6)
    expect(cell.mode).toBeCloseTo(50, 6) // 50 and 60 are far apart: two 1-point windows, equidistant from the median -> lower
    // untouched cell has no data
    expect(cells[1][1]).toEqual({ n: 0, mean: null, median: null, mode: null })
  })

  it('excludes points outside an active time selection', () => {
    const rows = [
      makeRow(3200, 90, {}, 0),
      makeRow(3200, 90, {}, 10_000),
    ]
    const cells = computeCorrectionCells(
      [makeLog(rows)], DEFAULT_FILTER, { start_ms: 5_000, end_ms: 20_000 }, MAP_BPS, RPM_BPS,
    )
    expect(cells[0][0].n).toBeCloseTo(1, 6)
  })
})

describe('toPerLogRanges', () => {
  const a = makeLog([makeRow(3200, 90, {}, 0)], 'a', true, 1000)
  const b = makeLog([makeRow(3200, 90, {}, 0)], 'b', true, 2000)
  const off = makeLog([makeRow(3200, 90, {}, 0)], 'off', false, 500)

  it('marks every active log "full" when there is no selection, skipping inactive logs', () => {
    expect(toPerLogRanges(null, [a, off, b]).map(r => [r.filename, r.range])).toEqual([['a.csv', 'full'], ['b.csv', 'full']])
  })

  it('splits a selection spanning two logs into one interval per log, in each log\'s own ms', () => {
    // timeline: a = [0,1000], b = [1000,3000]; selection 600..1500
    const r = toPerLogRanges({ start_ms: 600, end_ms: 1500 }, [a, b])
    expect(r[0].range).toEqual({ start_ms: 600, end_ms: 1000 })
    expect(r[1].range).toEqual({ start_ms: 0, end_ms: 500 })
  })

  it('marks a log outside the selection "unused" and one fully covered "full"', () => {
    const r = toPerLogRanges({ start_ms: 1000, end_ms: 3000 }, [a, b])
    expect(r[0].range).toBe('unused')
    expect(r[1].range).toBe('full')
  })

  it('an inactive log between active ones does not shift the offsets', () => {
    const r = toPerLogRanges({ start_ms: 1000, end_ms: 1500 }, [a, off, b])
    expect(r.map(x => x.filename)).toEqual(['a.csv', 'b.csv'])
    expect(r[1].range).toEqual({ start_ms: 0, end_ms: 500 })
  })
})

describe('generateCorrectionRun', () => {
  it('builds a self-contained run: cells, breakpoints, default name and recipe', () => {
    const rows = [makeRow(3200, 90, {}, 0)]
    const run = generateCorrectionRun([makeLog(rows, 'log')], DEFAULT_FILTER, null, MAP_BPS, RPM_BPS, new Date(2026, 9, 8, 14, 32).getTime())
    expect(run.name).toBe('08/10/2026 14:32')
    expect(run.breakpoints).toEqual({ map: MAP_BPS, rpm: RPM_BPS })
    expect(run.cells[0][0].n).toBeCloseTo(1, 6)
    expect(run.recipe.logs).toEqual([{ hash: 'log', filename: 'log.csv', range: 'full' }])
    expect(filtersEqual(run.recipe.filter!, DEFAULT_FILTER)).toBe(true)
    expect(run.id).toMatch(/^run-/)
  })

  it('does not alias the caller\'s breakpoints arrays or filter', () => {
    const maps = [90, 80]
    const run = generateCorrectionRun([makeLog([makeRow(3200, 90, {}, 0)])], DEFAULT_FILTER, null, maps, RPM_BPS)
    maps[0] = 0
    expect(run.breakpoints.map[0]).toBe(90)
    expect(run.recipe.filter).not.toBe(DEFAULT_FILTER)
  })

  it('reordering the logs afterwards cannot change an already generated run', () => {
    const la = makeLog([makeRow(3200, 90, {}, 0)], 'a', true, 1000)
    const lb = makeLog([makeRow(3200, 90, {}, 0)], 'b', true, 1000)
    const run = generateCorrectionRun([la, lb], DEFAULT_FILTER, { start_ms: 0, end_ms: 500 }, MAP_BPS, RPM_BPS)
    const before = JSON.stringify(run)
    toPerLogRanges({ start_ms: 0, end_ms: 500 }, [lb, la]) // a later re-ordering is a different computation
    expect(JSON.stringify(run)).toBe(before)
    expect(run.recipe.logs.map(l => l.range)).toEqual([{ start_ms: 0, end_ms: 500 }, 'unused'])
  })
})

describe('defaultRunName', () => {
  it('pads day, month, hour and minute', () => {
    expect(defaultRunName(new Date(2026, 0, 3, 4, 5).getTime())).toBe('03/01/2026 04:05')
  })
})

describe('densestClusterMode', () => {
  it('returns the mean of the densest +-0.5 cluster, not of the whole set', () => {
    expect(densestClusterMode([58.1, 59.0, 59.2, 59.3, 59.4, 59.6, 61.5, 64.0])).toBeCloseTo(59.3, 6)
  })

  it('breaks a tie by the window closest to the median', () => {
    expect(densestClusterMode([10, 10.1, 15, 20, 20.1])).toBeCloseTo(10.05, 6)
  })

  it('returns the single value when there is one point', () => {
    expect(densestClusterMode([42.5])).toBe(42.5)
  })
})
