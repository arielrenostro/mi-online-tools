import { describe, it, expect, beforeEach, vi } from 'vitest'

const ls = new Map<string, unknown>()
vi.mock('./localStorage', () => ({
  lsGet:   vi.fn((k: string) => (ls.has(k) ? ls.get(k) : null)),
  lsSet:   vi.fn((k: string, v: unknown) => { ls.set(k, v) }),
  lsClear: vi.fn((k: string) => { ls.delete(k) }),
}))
vi.mock('./runPersistence', () => ({
  saveRun:     vi.fn(async () => {}),
  deleteRun:   vi.fn(async () => {}),
  loadAllRuns: vi.fn(async () => []),
}))
vi.mock('./legacySnapshotPersistence', () => ({
  loadLegacySnapshot:  vi.fn(async () => undefined),
  clearLegacySnapshot: vi.fn(async () => {}),
}))
vi.mock('./mapPersistence', () => ({
  loadMap: vi.fn(async () => undefined),
}))
vi.mock('./logPersistence', () => ({
  loadAllLogs: vi.fn(async () => []),
  saveLog:     vi.fn(async () => {}),
}))

import { restoreCorrection, restoreSession } from './sessionRestorer'
import * as runPersistence from './runPersistence'
import * as legacy from './legacySnapshotPersistence'
import * as mapPersistence from './mapPersistence'
import { useCorrectionStore } from '@/store/correctionStore'
import { useFilterStore } from '@/store/filterStore'
import { useCorrectionSettingsStore, DEFAULT_CORRECTION_SETTINGS } from '@/store/correctionSettingsStore'
import { useMapStore } from '@/store/mapStore'
import { cloneFilter, DEFAULT_FILTER, filtersEqual } from '@/types/filter'
import type { CorrectionRun } from '@/types/correction'
import type { MapModel } from '@/types/map'

const MAP: MapModel = {
  name: 'm.csv', rawLines: [], rpmBreakpoints: [3200, 3600], mapBreakpoints: [90, 80],
  cells: [[500, 500], [500, 500]], ignitionCells: [], lambdaCells: [],
}

const LEGACY_FILTERS = {
  lambdaLoop: [1, 2], minClt: 70, minLambda: 0.7, maxLambda: 1.2,
  maxDeltaTps: 5, maxDeltaMap: 5, maxDeltaLambdaTarget: 0.03, skipFirstClosedLoop: 0, skipFirstOpenLoop: 10,
}

const LEGACY_SNAPSHOT = {
  cells: [[{ n: 3, mean: 55, median: 55 }, { n: 0, mean: null, median: null, mode: null }], [{ n: 0, mean: null, median: null, mode: null }, { n: 0, mean: null, median: null, mode: null }]],
  generatedAt: Date.UTC(2026, 0, 2, 12, 0),
  provenance: { logFilenames: ['a.csv', 'b.csv'], timeRange: { start_ms: 1000, end_ms: 5000 }, filters: LEGACY_FILTERS },
}

function aRun(id: string, createdAt: number): CorrectionRun {
  return { id, name: id, createdAt, breakpoints: { map: [90, 80], rpm: [3200, 3600] }, cells: [], recipe: { logs: [], filter: null } }
}

beforeEach(() => {
  ls.clear()
  vi.clearAllMocks()
  vi.mocked(runPersistence.loadAllRuns).mockResolvedValue([])
  vi.mocked(legacy.loadLegacySnapshot).mockResolvedValue(undefined)
  vi.mocked(mapPersistence.loadMap).mockResolvedValue(undefined)
  useCorrectionStore.setState({ runs: [], selectedRunId: null, hasUnseenRun: false })
  useFilterStore.getState().hydrate({})
  useMapStore.setState({ originalMap: null, editableMap: null })
  useCorrectionSettingsStore.setState({ values: DEFAULT_CORRECTION_SETTINGS })
})

describe('restoreCorrection — runs', () => {
  it('restores the saved history and the selected run', async () => {
    vi.mocked(runPersistence.loadAllRuns).mockResolvedValue([aRun('a', 1), aRun('b', 2)])
    ls.set('miot:correction-selected-run', 'a')
    await restoreCorrection()
    const s = useCorrectionStore.getState()
    expect(s.runs.map(r => r.id)).toEqual(['b', 'a'])
    expect(s.selectedRunId).toBe('a')
  })

  it('an unreadable run store leaves the history empty without throwing', async () => {
    vi.mocked(runPersistence.loadAllRuns).mockRejectedValue(new Error('boom'))
    await expect(restoreCorrection()).resolves.toBeUndefined()
    expect(useCorrectionStore.getState().runs).toEqual([])
  })
})

describe('restoreCorrection — migrating the former single snapshot', () => {
  it('turns it into the first run, selected, with the map breakpoints, then deletes the old one', async () => {
    useMapStore.setState({ originalMap: MAP })
    vi.mocked(legacy.loadLegacySnapshot).mockResolvedValue(LEGACY_SNAPSHOT)

    await restoreCorrection()

    const s = useCorrectionStore.getState()
    expect(s.runs).toHaveLength(1)
    const run = s.runs[0]
    expect(s.selectedRunId).toBe(run.id)
    expect(run.breakpoints).toEqual({ map: [90, 80], rpm: [3200, 3600] })
    expect(run.cells).toEqual(LEGACY_SNAPSHOT.cells)
    expect(run.createdAt).toBe(LEGACY_SNAPSHOT.generatedAt)
    expect(run.recipe.logs.map(l => [l.filename, l.hash])).toEqual([['a.csv', null], ['b.csv', null]])
    expect(run.recipe.globalTimeRange).toEqual({ start_ms: 1000, end_ms: 5000 })
    expect(run.recipe.filter!.ranges['CLT']).toEqual({ enabled: true, min: 70, max: null })
    expect(runPersistence.saveRun).toHaveBeenCalledWith(run)
    expect(legacy.clearLegacySnapshot).toHaveBeenCalledTimes(1)
  })

  it('does not delete the old snapshot when saving the run fails', async () => {
    useMapStore.setState({ originalMap: MAP })
    vi.mocked(legacy.loadLegacySnapshot).mockResolvedValue(LEGACY_SNAPSHOT)
    vi.mocked(runPersistence.saveRun).mockRejectedValueOnce(new Error('disk full'))
    await restoreCorrection()
    expect(legacy.clearLegacySnapshot).not.toHaveBeenCalled()
    expect(useCorrectionStore.getState().runs).toEqual([])
  })

  it('without a restored map the old snapshot is dropped (its breakpoints are unknown)', async () => {
    vi.mocked(legacy.loadLegacySnapshot).mockResolvedValue(LEGACY_SNAPSHOT)
    await restoreCorrection()
    expect(useCorrectionStore.getState().runs).toEqual([])
    expect(runPersistence.saveRun).not.toHaveBeenCalled()
    expect(legacy.clearLegacySnapshot).toHaveBeenCalledTimes(1)
  })

  it('without an old snapshot the history stays empty', async () => {
    useMapStore.setState({ originalMap: MAP })
    await restoreCorrection()
    expect(useCorrectionStore.getState().runs).toEqual([])
    expect(runPersistence.saveRun).not.toHaveBeenCalled()
  })

  it('restoring again does not duplicate the migrated run', async () => {
    useMapStore.setState({ originalMap: MAP })
    vi.mocked(legacy.loadLegacySnapshot).mockResolvedValueOnce(LEGACY_SNAPSHOT).mockResolvedValue(undefined)
    let saved: CorrectionRun[] = []
    vi.mocked(runPersistence.saveRun).mockImplementation(async r => { saved = [r] })
    vi.mocked(runPersistence.loadAllRuns).mockImplementation(async () => saved)

    await restoreCorrection()
    useCorrectionStore.setState({ runs: [], selectedRunId: null })
    await restoreCorrection()

    expect(useCorrectionStore.getState().runs).toHaveLength(1)
    expect(runPersistence.saveRun).toHaveBeenCalledTimes(1)
  })

  it('when runs already exist an old snapshot left behind is just cleared', async () => {
    useMapStore.setState({ originalMap: MAP })
    vi.mocked(runPersistence.loadAllRuns).mockResolvedValue([aRun('a', 1)])
    vi.mocked(legacy.loadLegacySnapshot).mockResolvedValue(LEGACY_SNAPSHOT)
    await restoreCorrection()
    expect(useCorrectionStore.getState().runs.map(r => r.id)).toEqual(['a'])
    expect(runPersistence.saveRun).not.toHaveBeenCalled()
    expect(legacy.clearLegacySnapshot).toHaveBeenCalledTimes(1)
  })
})

describe('restoreCorrection — filter', () => {
  it('restores the saved filter and the visibility toggle', async () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.ranges['MAP'] = { enabled: true, min: 80, max: 120 }
    ls.set('miot:correction-filter', f)
    ls.set('miot:correction-show-filtered', false)
    await restoreCorrection()
    expect(useFilterStore.getState().filter.ranges['MAP']).toEqual({ enabled: true, min: 80, max: 120 })
    expect(useFilterStore.getState().showFilteredPoints).toBe(false)
  })

  it('restores a filter saved without the "before" skips with them off and the rest intact', async () => {
    const saved = cloneFilter(DEFAULT_FILTER) as unknown as Record<string, unknown>
    delete saved.skipBeforeClosed
    delete saved.skipBeforeOpen
    saved.ranges = { ...(saved.ranges as object), MAP: { enabled: true, min: 80, max: 120 } }
    ls.set('miot:correction-filter', saved)
    await restoreCorrection()
    const f = useFilterStore.getState().filter
    expect(f.skipBeforeClosed.enabled).toBe(false)
    expect(f.skipBeforeOpen.enabled).toBe(false)
    expect(f.ranges['MAP']).toEqual({ enabled: true, min: 80, max: 120 })
    expect(f.skipClosed).toEqual(DEFAULT_FILTER.skipClosed)
  })

  it('converts a filter saved in the old format, writes the new key and removes the old one', async () => {
    ls.set('miot:correction-filters', LEGACY_FILTERS)
    await restoreCorrection()
    const f = useFilterStore.getState().filter
    expect(f.ranges['CLT']).toEqual({ enabled: true, min: 70, max: null })
    expect(f.ranges['Lambda 1']).toEqual({ enabled: true, min: 0.7, max: 1.2 })
    expect(f.skipClosed.enabled).toBe(false)
    expect(f.ranges['MAP'].enabled).toBe(false)
    expect(ls.has('miot:correction-filters')).toBe(false)
    expect(ls.get('miot:correction-filter')).toBeDefined()
  })

  it('an unreadable filter falls back to the default without an error', async () => {
    ls.set('miot:correction-filter', 'garbage')
    await expect(restoreCorrection()).resolves.toBeUndefined()
    expect(filtersEqual(useFilterStore.getState().filter, DEFAULT_FILTER)).toBe(true)
  })
})

describe('restoreSession — ordering', () => {
  it('migrates the old snapshot with the breakpoints of the map restored in the same session', async () => {
    vi.mocked(mapPersistence.loadMap).mockResolvedValue({
      originalModel: MAP, editableCells: null, editableIgnitionCells: null, editableLambdaCells: null,
      csvBlob: new Blob(['']), savedAt: 0,
    })
    vi.mocked(legacy.loadLegacySnapshot).mockResolvedValue(LEGACY_SNAPSHOT)

    await restoreSession()

    const runs = useCorrectionStore.getState().runs
    expect(runs).toHaveLength(1)
    expect(runs[0].breakpoints.map).toEqual([90, 80])
  })
})

describe('restoreSession — correction settings', () => {
  it('restores the saved confidence constant k', async () => {
    ls.set('miot:correction-settings', { confidenceK: 35 })
    await restoreSession()
    expect(useCorrectionSettingsStore.getState().values.confidenceK).toBe(35)
  })

  it('keeps the default k when nothing or garbage was saved', async () => {
    await restoreSession()
    expect(useCorrectionSettingsStore.getState().values.confidenceK).toBe(100)
    ls.set('miot:correction-settings', { confidenceK: 'abc' })
    await restoreSession()
    expect(useCorrectionSettingsStore.getState().values.confidenceK).toBe(100)
  })
})
