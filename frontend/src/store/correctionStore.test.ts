import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/persistence/correctionPersistence', () => ({
  saveSnapshot:  vi.fn(async () => {}),
  loadSnapshot:  vi.fn(async () => undefined),
  clearSnapshot: vi.fn(async () => {}),
}))

import { useCorrectionStore } from './correctionStore'
import { useLogStore } from './logStore'
import { useMapStore } from './mapStore'
import { useTimeStore } from './timeStore'
import { DEFAULT_CORRECTION_FILTERS } from '@/types/correction'
import type { MapModel } from '@/types/map'
import type { DatalogRow, LogEntry } from '@/types/datalog'

function makeMap(): MapModel {
  return {
    name: 'test.csv', rawLines: [],
    rpmBreakpoints: [3200, 3600],
    mapBreakpoints: [90, 80],
    cells:         [[500, 500], [500, 500]],
    ignitionCells: [[0, 0], [0, 0]],
    lambdaCells:   [[1000, 1000], [1000, 1000]],
  }
}

function makeRow(ts: number): DatalogRow {
  return {
    timestamp_ms: ts, 'RPM': 3200, 'MAP': 90,
    'Lambda 1': 1.0, 'Lambda Target': 1.0, 'Lambda Corr': 0, 'VE': 55,
    'CLT': 90, 'Lambda Loop': 1, 'Pedal': 0,
  }
}

function makeLog(): LogEntry {
  const rows = [makeRow(0), makeRow(100)]
  return {
    hash: 'h', filename: 'log.csv', enabled: true, duration_ms: 100,
    model: { hash: 'h', filename: 'log.csv', rows, duration_ms: 100, signals: [] },
  }
}

beforeEach(() => {
  useCorrectionStore.setState({ filters: DEFAULT_CORRECTION_FILTERS, draftFilters: DEFAULT_CORRECTION_FILTERS, showFilteredPoints: true, snapshot: null, isStale: false })
  useMapStore.setState({ originalMap: null, editableMap: null })
  useLogStore.setState({ logs: [], isUploading: false, lastError: null })
  useTimeStore.setState({ cursor_ms: null, selection: null, sparklineSensor: 'RPM' })
})

describe('generate', () => {
  it('does nothing when there is no map', () => {
    useLogStore.setState({ logs: [makeLog()] })
    useCorrectionStore.getState().generate()
    expect(useCorrectionStore.getState().snapshot).toBeNull()
  })

  it('reads active logs, time selection, and filters to populate a snapshot', () => {
    useMapStore.setState({ originalMap: makeMap() })
    useLogStore.setState({ logs: [makeLog()] })

    useCorrectionStore.getState().generate()

    const { snapshot, isStale } = useCorrectionStore.getState()
    expect(snapshot).not.toBeNull()
    expect(isStale).toBe(false)
    expect(snapshot!.cells[0][0].n).toBeCloseTo(2, 6)
    expect(snapshot!.provenance.logFilenames).toEqual(['log.csv'])
  })
})

describe('markStale / applyFilters', () => {
  it('marks an existing snapshot as stale, and is a no-op with no snapshot', () => {
    useCorrectionStore.getState().markStale()
    expect(useCorrectionStore.getState().isStale).toBe(false)

    useMapStore.setState({ originalMap: makeMap() })
    useLogStore.setState({ logs: [makeLog()] })
    useCorrectionStore.getState().generate()

    useCorrectionStore.getState().setDraftFilters({ minClt: 50 })
    expect(useCorrectionStore.getState().isStale).toBe(false) // draft edits alone don't touch staleness
    useCorrectionStore.getState().applyFilters()
    expect(useCorrectionStore.getState().isStale).toBe(true)
  })
})

describe('draft filters and isFiltersDirty', () => {
  it('does not affect the applied filters until applyFilters is called', () => {
    useCorrectionStore.getState().setDraftFilters({ minClt: 50 })
    expect(useCorrectionStore.getState().isFiltersDirty()).toBe(true)
    expect(useCorrectionStore.getState().filters.minClt).toBe(DEFAULT_CORRECTION_FILTERS.minClt)

    useCorrectionStore.getState().applyFilters()
    expect(useCorrectionStore.getState().isFiltersDirty()).toBe(false)
    expect(useCorrectionStore.getState().filters.minClt).toBe(50)
  })

  it('hydrating filters resets both applied and draft to the same value', () => {
    useCorrectionStore.getState().setDraftFilters({ minClt: 999 })
    useCorrectionStore.getState().hydrateFilters(DEFAULT_CORRECTION_FILTERS)
    expect(useCorrectionStore.getState().isFiltersDirty()).toBe(false)
  })
})

describe('clear', () => {
  it('removes the snapshot and clears staleness', () => {
    useMapStore.setState({ originalMap: makeMap() })
    useLogStore.setState({ logs: [makeLog()] })
    useCorrectionStore.getState().generate()

    useCorrectionStore.getState().clear()
    expect(useCorrectionStore.getState().snapshot).toBeNull()
    expect(useCorrectionStore.getState().isStale).toBe(false)
  })
})
