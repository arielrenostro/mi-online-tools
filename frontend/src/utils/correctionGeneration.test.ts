import { describe, it, expect } from 'vitest'
import {
  bilinearWeights, collectSamples, deriveCells, defaultRunName, densestClusterMode, generateCorrectionRun, toPerLogRanges,
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

/** Rows spaced 1 s apart so the ΔMAP/ΔTPS windows never see more than one point. */
function spacedRows(points: { rpm: number; map: number; ve: number }[]): DatalogRow[] {
  return points.map((p, i) => makeRow(p.rpm, p.map, { 'VE': p.ve }, i * 1000))
}

describe('collectSamples', () => {
  it('keeps [MAP, RPM, VE Lambda] of every qualifying point inside the map range', () => {
    const rows = [
      makeRow(3200, 90, { 'VE': 50 }, 0),
      makeRow(3350, 85, { 'VE': 60, 'Lambda Corr': 10 }, 1000), // VE Lambda = (1-1+1+0.1)*60 = 66
    ]
    const samples = collectSamples([makeLog(rows)], DEFAULT_FILTER, null, MAP_BPS, RPM_BPS)
    expect(Array.from(samples)).toEqual([90, 3200, 50, 85, 3350, expect.closeTo(66, 6)])
  })

  it('drops points outside the map range, filtered out, or without a finite VE Lambda', () => {
    const rows = [
      makeRow(3200, 90, {}, 0),
      makeRow(3200, 200, {}, 1000),                       // MAP out of range
      makeRow(100, 90, {}, 2000),                         // RPM out of range
      makeRow(3200, 90, { 'CLT': 20 }, 3000),             // fails the default filter (CLT >= 85)
      makeRow(3200, 90, { 'VE': NaN }, 4000),             // VE Lambda is NaN
    ]
    expect(collectSamples([makeLog(rows)], DEFAULT_FILTER, null, MAP_BPS, RPM_BPS)).toHaveLength(3)
  })

  it('excludes points outside an active time selection', () => {
    const rows = [makeRow(3200, 90, {}, 0), makeRow(3200, 90, {}, 10_000)]
    const samples = collectSamples([makeLog(rows)], DEFAULT_FILTER, { start_ms: 5_000, end_ms: 20_000 }, MAP_BPS, RPM_BPS)
    expect(samples).toHaveLength(3)
  })
})

describe('deriveCells', () => {
  // VE map (raw, %x10): 60% at MAP 90, 50% at MAP 80, same for both RPMs. VE grows with MAP.
  const SLOPED = [[600, 600], [500, 500]]

  function runOf(points: { rpm: number; map: number; ve: number }[]) {
    return generateCorrectionRun([makeLog(spacedRows(points))], DEFAULT_FILTER, null, MAP_BPS, RPM_BPS)
  }

  it('compares each point with the map interpolated AT the point, so the slope of the map does not leak in', () => {
    // Both points need 2% less VE than the map gives where they are (58 and 52), but their absolute
    // VE Lambda differs by 10%. Both land (partly) in the MAP 80 cell.
    const run = runOf([
      { rpm: 3200, map: 88, ve: 0.98 * 58 },
      { rpm: 3200, map: 82, ve: 0.98 * 52 },
    ])
    const cells = deriveCells(run, SLOPED)
    const cell = cells[1][0] // MAP 80, RPM 3200
    expect(cell.n).toBeCloseTo(0.2 + 0.8, 6)
    expect(cell.mean).toBeCloseTo(0.98, 6)
    expect(cell.median).toBeCloseTo(0.98, 6)
    expect(cell.mode).toBeCloseTo(0.98, 6)
  })

  it('the old absolute-average method would have called that cell +4% (regression for the sloped-map bias)', () => {
    const run = runOf([
      { rpm: 3200, map: 88, ve: 0.98 * 58 },
      { rpm: 3200, map: 82, ve: 0.98 * 52 },
    ])
    const s = run.samples!
    const abs = (0.2 * s[2] + 0.8 * s[5]) / 1.0 // weighted mean of absolute VE Lambda in the MAP 80 cell
    expect(abs / 50 - 1).toBeGreaterThan(0.04)
    expect(deriveCells(run, SLOPED)[1][0].mean! - 1).toBeCloseTo(-0.02, 6)
  })

  it('reproduces the real-log case: many points on the steep side no longer inflate the cell', () => {
    // MAP breakpoints 50/40/30; VE map 56% / 50% / 46%; every point needs 1% less than the map gives there.
    const MAPS = [50, 40, 30], RPMS = [800, 1200]
    const map = [[560, 560], [500, 500], [460, 460]]
    const pts = [
      ...Array.from({ length: 20 }, () => ({ rpm: 800, map: 48, ve: 0.99 * (0.8 * 56 + 0.2 * 50) })),
      ...Array.from({ length: 4 },  () => ({ rpm: 800, map: 40, ve: 0.99 * 50 })),
    ]
    const run = generateCorrectionRun([makeLog(spacedRows(pts))], DEFAULT_FILTER, null, MAPS, RPMS)
    const cell = deriveCells(run, map)[1][0]
    expect(cell.mean! - 1).toBeCloseTo(-0.01, 6)
  })

  it('a single point gives mean = median = mode = its ratio', () => {
    const run = runOf([{ rpm: 3200, map: 90, ve: 63 }]) // map there is 60% -> ratio 1.05
    const cell = deriveCells(run, SLOPED)[0][0]
    expect(cell.n).toBeCloseTo(1, 6)
    expect(cell.mean).toBeCloseTo(1.05, 6)
    expect(cell.median).toBeCloseTo(1.05, 6)
    expect(cell.mode).toBeCloseTo(1.05, 6)
  })

  it('mean is weighted by the bilinear weights, median and mode are not', () => {
    // Cell (MAP 90, RPM 3200): one exact point (weight 1, ratio 1.00) and one at MAP 88 (weight 0.8, ratio 1.10)
    const run = runOf([
      { rpm: 3200, map: 90, ve: 60 },
      { rpm: 3200, map: 88, ve: 1.10 * 58 },
    ])
    const cell = deriveCells(run, SLOPED)[0][0]
    expect(cell.n).toBeCloseTo(1.8, 6)
    expect(cell.mean).toBeCloseTo((1 * 1.0 + 0.8 * 1.10) / 1.8, 6)
    expect(cell.median).toBeCloseTo(1.05, 6)
  })

  it('a cell no point touches has no data', () => {
    const run = runOf([{ rpm: 3200, map: 90, ve: 60 }])
    expect(deriveCells(run, SLOPED)[1][1]).toEqual({ n: 0, mean: null, median: null, mode: null })
  })

  it('follows the map: editing the map changes the ratios with no regeneration', () => {
    const run = runOf([{ rpm: 3200, map: 90, ve: 60 }])
    expect(deriveCells(run, SLOPED)[0][0].mean).toBeCloseTo(1.0, 6)
    expect(deriveCells(run, [[500, 600], [500, 500]])[0][0].mean).toBeCloseTo(1.2, 6)
  })

  it('discards a point whose interpolated map value is not positive, and does not count it in n', () => {
    const run = runOf([
      { rpm: 3200, map: 90, ve: 60 },
      { rpm: 3200, map: 80, ve: 50 },
    ])
    const cells = deriveCells(run, [[600, 600], [0, 0]]) // MAP 80 row zeroed
    expect(cells[1][0]).toEqual({ n: 0, mean: null, median: null, mode: null })
    expect(cells[0][0].n).toBeCloseTo(1, 6)
  })

  it('a run without samples has no cells to derive', () => {
    const run = { ...runOf([{ rpm: 3200, map: 90, ve: 60 }]), samples: null }
    expect(deriveCells(run, SLOPED).every(row => row.every(c => c.n === 0))).toBe(true)
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
  it('builds a self-contained run: samples, breakpoints, default name and recipe', () => {
    const rows = [makeRow(3200, 90, {}, 0)]
    const run = generateCorrectionRun([makeLog(rows, 'log')], DEFAULT_FILTER, null, MAP_BPS, RPM_BPS, new Date(2026, 9, 8, 14, 32).getTime())
    expect(run.name).toBe('08/10/2026 14:32')
    expect(run.breakpoints).toEqual({ map: MAP_BPS, rpm: RPM_BPS })
    expect(Array.from(run.samples!)).toEqual([90, 3200, 50])
    expect(run.cells).toBeUndefined()
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
  it('returns the mean of the densest +-0.005 cluster, not of the whole set', () => {
    expect(densestClusterMode([0.981, 0.990, 0.992, 0.993, 0.994, 0.996, 1.015, 1.040])).toBeCloseTo(0.993, 6)
  })

  it('breaks a tie by the window closest to the median', () => {
    expect(densestClusterMode([1.000, 1.001, 1.05, 1.10, 1.101])).toBeCloseTo(1.0005, 6)
  })

  it('returns the single value when there is one point', () => {
    expect(densestClusterMode([1.025])).toBe(1.025)
  })
})
