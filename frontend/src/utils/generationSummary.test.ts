import { describe, it, expect } from 'vitest'
import { countQualifyingPoints, generateBlockReason } from './generationSummary'
import type { DatalogRow, LogEntry } from '@/types/datalog'

function log(hash: string, tss: number[], duration: number, enabled = true): LogEntry {
  const rows: DatalogRow[] = tss.map(timestamp_ms => ({ timestamp_ms }))
  return { hash, filename: hash, enabled, duration_ms: duration, model: { hash, filename: hash, rows, duration_ms: duration, signals: [] } }
}

describe('countQualifyingPoints', () => {
  const logs = [log('a', [0, 100, 200], 300), log('off', [0, 100], 200, false), log('b', [0, 100], 200)]
  // active rows: a0 a100 a200 | b0(=300) b100(=400); mask in that order
  const mask = [true, false, true, true, true]

  it('counts the points passing the filter when there is no selection', () => {
    expect(countQualifyingPoints(logs, mask, null)).toBe(4)
  })

  it('keeps only points inside the selection on the concatenated timeline', () => {
    expect(countQualifyingPoints(logs, mask, { start_ms: 150, end_ms: 350 })).toBe(2) // a200, b0
  })

  it('skips inactive logs without shifting the offsets', () => {
    expect(countQualifyingPoints(logs, mask, { start_ms: 350, end_ms: 450 })).toBe(1) // b100 only
  })

  it('is zero for an empty mask', () => {
    expect(countQualifyingPoints([], [], null)).toBe(0)
  })
})

describe('generateBlockReason', () => {
  it('prioritises the missing map, then missing points, otherwise allows generating', () => {
    expect(generateBlockReason(false, 10)).toBe('no-map')
    expect(generateBlockReason(false, 0)).toBe('no-map')
    expect(generateBlockReason(true, 0)).toBe('no-points')
    expect(generateBlockReason(true, 1)).toBeNull()
  })
})
