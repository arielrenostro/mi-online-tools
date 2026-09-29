import { describe, it, expect } from 'vitest'
import { bilinearWeights, densestClusterMode, generateCorrectionSnapshot } from './correctionGeneration'
import { DEFAULT_CORRECTION_FILTERS } from '@/types/correction'
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

describe('generateCorrectionSnapshot', () => {
  function makeRow(rpm: number, mapKpa: number, veLambdaInputs: Partial<DatalogRow>, ts: number): DatalogRow {
    return {
      timestamp_ms: ts,
      'RPM': rpm, 'MAP': mapKpa,
      'Lambda 1': 1.0, 'Lambda Target': 1.0, 'Lambda Corr': 0, 'VE': 50,
      'CLT': 90, 'Lambda Loop': 1, 'Pedal': 0,
      ...veLambdaInputs,
    }
  }

  function makeLog(rows: DatalogRow[]): LogEntry {
    return {
      hash: 'h', filename: 'log.csv', enabled: true,
      duration_ms: rows[rows.length - 1]?.timestamp_ms ?? 0,
      model: { hash: 'h', filename: 'log.csv', rows, duration_ms: 0, signals: [] },
    }
  }

  it('aggregates weighted mean and unweighted median per cell from exact-breakpoint points', () => {
    // Two points exactly on cell (row0=MAP90, col0=RPM3200), VE Lambda = 50 and 60 respectively (weight 1 each)
    const rows = [
      makeRow(3200, 90, { 'VE': 50 }, 0),   // VE Lambda = (1-1+1+0)*50 = 50
      makeRow(3200, 90, { 'VE': 60 }, 100), // VE Lambda = 60
    ]
    const snapshot = generateCorrectionSnapshot(
      [makeLog(rows)], DEFAULT_CORRECTION_FILTERS, null, MAP_BPS, RPM_BPS,
    )
    const cell = snapshot.cells[0][0]
    expect(cell.n).toBeCloseTo(2, 6)
    expect(cell.mean).toBeCloseTo(55, 6)
    expect(cell.median).toBeCloseTo(55, 6)
    expect(cell.mode).toBeCloseTo(50, 6) // 50 and 60 are far apart: two 1-point windows, equidistant from the median -> lower
    // untouched cell has no data
    expect(snapshot.cells[1][1]).toEqual({ n: 0, mean: null, median: null, mode: null })
  })

  it('excludes points outside an active time selection', () => {
    const rows = [
      makeRow(3200, 90, {}, 0),
      makeRow(3200, 90, {}, 10_000),
    ]
    const snapshot = generateCorrectionSnapshot(
      [makeLog(rows)], DEFAULT_CORRECTION_FILTERS,
      { start_ms: 5_000, end_ms: 20_000 },
      MAP_BPS, RPM_BPS,
    )
    expect(snapshot.cells[0][0].n).toBeCloseTo(1, 6)
  })

  it('records provenance from the active logs, time range, and filters used', () => {
    const rows = [makeRow(3200, 90, {}, 0)]
    const snapshot = generateCorrectionSnapshot(
      [makeLog(rows)], DEFAULT_CORRECTION_FILTERS, null, MAP_BPS, RPM_BPS,
    )
    expect(snapshot.provenance.logFilenames).toEqual(['log.csv'])
    expect(snapshot.provenance.timeRange).toBeNull()
    expect(snapshot.provenance.filters).toEqual(DEFAULT_CORRECTION_FILTERS)
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
