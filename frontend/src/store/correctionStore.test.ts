import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/persistence/runPersistence', () => ({
  saveRun:     vi.fn(async () => {}),
  deleteRun:   vi.fn(async () => {}),
  loadAllRuns: vi.fn(async () => []),
}))
vi.mock('@/persistence/localStorage', () => ({
  lsSet:   vi.fn(),
  lsGet:   vi.fn(() => null),
  lsClear: vi.fn(),
}))

import { useCorrectionStore, isRunCompatible, selectSelectedRun, MAX_RUNS } from './correctionStore'
import { useLogStore } from './logStore'
import { useMapStore } from './mapStore'
import { useTimeStore } from './timeStore'
import { useFilterStore } from './filterStore'
import { useConstantsStore, DEFAULT_CONSTANTS } from './constantsStore'
import * as runPersistence from '@/persistence/runPersistence'
import { lsSet } from '@/persistence/localStorage'
import { cloneFilter, DEFAULT_FILTER } from '@/types/filter'
import type { MapModel } from '@/types/map'
import type { DatalogRow, LogEntry } from '@/types/datalog'

function makeMap(over: Partial<MapModel> = {}): MapModel {
  return {
    name: 'test.csv', rawLines: [],
    rpmBreakpoints: [3200, 3600],
    mapBreakpoints: [90, 80],
    cells:         [[500, 500], [500, 500]],
    ignitionCells: [[0, 0], [0, 0]],
    lambdaCells:   [[1000, 1000], [1000, 1000]],
    ...over,
  }
}

function makeRow(ts: number): DatalogRow {
  return {
    timestamp_ms: ts, 'RPM': 3200, 'MAP': 90,
    'Lambda 1': 1.0, 'Lambda Target': 1.0, 'Lambda Corr': 0, 'VE': 55,
    'CLT': 90, 'Lambda Loop': 1, 'Pedal': 0,
  }
}

function makeLog(hash = 'h'): LogEntry {
  const rows = [makeRow(0), makeRow(100)]
  return {
    hash, filename: `${hash}.csv`, enabled: true, duration_ms: 100,
    model: { hash, filename: `${hash}.csv`, rows, duration_ms: 100, signals: [] },
  }
}

function resetStores() {
  useCorrectionStore.setState({ runs: [], selectedRunId: null, hasUnseenRun: false })
  useMapStore.setState({ originalMap: null, editableMap: null })
  useLogStore.setState({ logs: [], isUploading: false, lastError: null })
  useTimeStore.setState({ cursor_ms: null, selection: null, sparklineSensor: 'RPM' })
  useFilterStore.getState().hydrate({})
  useConstantsStore.setState({ values: DEFAULT_CONSTANTS })
}

beforeEach(() => {
  resetStores()
  vi.mocked(runPersistence.saveRun).mockClear()
  vi.mocked(runPersistence.deleteRun).mockClear()
  vi.mocked(lsSet).mockClear()
})

describe('generate', () => {
  it('does nothing when there is no map', () => {
    useLogStore.setState({ logs: [makeLog()] })
    expect(useCorrectionStore.getState().generate()).toBeNull()
    expect(useCorrectionStore.getState().runs).toEqual([])
  })

  it('does nothing when no point qualifies', () => {
    useMapStore.setState({ originalMap: makeMap() })
    expect(useCorrectionStore.getState().generate()).toBeNull()
  })

  it('creates a run from the active logs, selection and applied filter, selects it and flags it as unseen', () => {
    useMapStore.setState({ originalMap: makeMap() })
    useLogStore.setState({ logs: [makeLog()] })

    const run = useCorrectionStore.getState().generate()!

    const s = useCorrectionStore.getState()
    expect(s.runs).toHaveLength(1)
    expect(s.selectedRunId).toBe(run.id)
    expect(s.hasUnseenRun).toBe(true)
    expect(run.cells[0][0].n).toBeCloseTo(2, 6)
    expect(run.recipe.logs.map(l => l.filename)).toEqual(['h.csv'])
    expect(run.breakpoints).toEqual({ map: [90, 80], rpm: [3200, 3600] })
    expect(runPersistence.saveRun).toHaveBeenCalledWith(run)
    expect(lsSet).toHaveBeenCalledWith('miot:correction-selected-run', run.id)
  })

  it('uses the applied filter: a MAP range excluding every point yields no run', () => {
    useMapStore.setState({ originalMap: makeMap() })
    useLogStore.setState({ logs: [makeLog()] })
    const f = cloneFilter(DEFAULT_FILTER)
    f.ranges['MAP'] = { enabled: true, min: 200, max: null }
    useFilterStore.getState().apply(f)
    expect(useCorrectionStore.getState().generate()).toBeNull()
  })

  it('uses the time selection: points outside it are left out', () => {
    useMapStore.setState({ originalMap: makeMap() })
    useLogStore.setState({ logs: [makeLog()] })
    useTimeStore.setState({ selection: { start_ms: 50, end_ms: 200 } })
    const run = useCorrectionStore.getState().generate()!
    expect(run.cells[0][0].n).toBeCloseTo(1, 6)
    expect(run.recipe.logs[0].range).toEqual({ start_ms: 50, end_ms: 100 })
  })

  it('ignores the time selection when useTimeSelection is false and records every log in full', () => {
    useMapStore.setState({ originalMap: makeMap() })
    useLogStore.setState({ logs: [makeLog()] })
    useTimeStore.setState({ selection: { start_ms: 50, end_ms: 200 } })
    const run = useCorrectionStore.getState().generate({ useTimeSelection: false })!
    expect(run.cells[0][0].n).toBeCloseTo(2, 6)
    expect(run.recipe.logs[0].range).toBe('full')
  })

  it('keeps at most MAX_RUNS, dropping the oldest from the history and from storage', () => {
    useMapStore.setState({ originalMap: makeMap() })
    useLogStore.setState({ logs: [makeLog()] })
    const ids: string[] = []
    for (let i = 0; i < MAX_RUNS + 2; i++) ids.push(useCorrectionStore.getState().generate()!.id)

    const runs = useCorrectionStore.getState().runs
    expect(runs).toHaveLength(MAX_RUNS)
    expect(runs[0].id).toBe(ids[ids.length - 1])
    expect(runs.some(r => r.id === ids[0])).toBe(false)
    expect(runPersistence.deleteRun).toHaveBeenCalledWith(ids[0])
    expect(runPersistence.deleteRun).toHaveBeenCalledWith(ids[1])
  })

  it('gives the run the default date-and-time name', () => {
    useMapStore.setState({ originalMap: makeMap() })
    useLogStore.setState({ logs: [makeLog()] })
    const run = useCorrectionStore.getState().generate()!
    expect(run.name).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
  })
})

describe('runs are never invalidated by ambient changes', () => {
  function generated() {
    useMapStore.setState({ originalMap: makeMap() })
    useLogStore.setState({ logs: [makeLog()] })
    return useCorrectionStore.getState().generate()!
  }

  it('changing logs, the filter, the time selection or the constants leaves the run untouched', async () => {
    const run = generated()
    const before = useCorrectionStore.getState().runs

    await useLogStore.getState().removeLog('h')
    useTimeStore.getState().setSelection(10, 90)
    useTimeStore.getState().clearSelection()
    const f = cloneFilter(DEFAULT_FILTER)
    f.ranges['MAP'] = { enabled: true, min: 1, max: 2 }
    useFilterStore.getState().apply(f)
    useConstantsStore.getState().set({ bsfc: 0.7 })

    const after = useCorrectionStore.getState()
    expect(after.runs).toBe(before)
    expect(after.runs[0]).toBe(run)
    expect(after.selectedRunId).toBe(run.id)
  })

  it('clearing or replacing the map does not delete any run', () => {
    const run = generated()
    useMapStore.setState({ originalMap: makeMap({ mapBreakpoints: [100, 70] }) })
    expect(useCorrectionStore.getState().runs).toEqual([run])
    useMapStore.setState({ originalMap: null })
    expect(useCorrectionStore.getState().runs).toEqual([run])
  })
})

describe('isRunCompatible', () => {
  it('requires identical MAP and RPM breakpoints', () => {
    useMapStore.setState({ originalMap: makeMap() })
    useLogStore.setState({ logs: [makeLog()] })
    const run = useCorrectionStore.getState().generate()!
    expect(isRunCompatible(run, makeMap())).toBe(true)
    expect(isRunCompatible(run, makeMap({ rpmBreakpoints: [3200, 3700] }))).toBe(false)
    expect(isRunCompatible(run, makeMap({ mapBreakpoints: [90, 75] }))).toBe(false)
    expect(isRunCompatible(run, null)).toBe(false)
  })
})

describe('rename', () => {
  it('stores the new name and persists it', () => {
    useMapStore.setState({ originalMap: makeMap() })
    useLogStore.setState({ logs: [makeLog()] })
    const run = useCorrectionStore.getState().generate()!
    useCorrectionStore.getState().rename(run.id, '  Pós-troca de bico ')
    expect(useCorrectionStore.getState().runs[0].name).toBe('Pós-troca de bico')
    expect(runPersistence.saveRun).toHaveBeenLastCalledWith(expect.objectContaining({ id: run.id, name: 'Pós-troca de bico' }))
  })

  it('an empty name goes back to the default date-and-time name', () => {
    useMapStore.setState({ originalMap: makeMap() })
    useLogStore.setState({ logs: [makeLog()] })
    const run = useCorrectionStore.getState().generate()!
    const original = run.name
    useCorrectionStore.getState().rename(run.id, 'Outro')
    useCorrectionStore.getState().rename(run.id, '   ')
    expect(useCorrectionStore.getState().runs[0].name).toBe(original)
  })
})

describe('remove / select', () => {
  function threeRuns() {
    useMapStore.setState({ originalMap: makeMap() })
    useLogStore.setState({ logs: [makeLog()] })
    const g = () => useCorrectionStore.getState().generate()!
    return [g(), g(), g()] // oldest → newest; history order is newest first
  }

  it('deleting a non-selected run keeps the selection', () => {
    const [a, b, c] = threeRuns()
    useCorrectionStore.getState().remove(a.id)
    expect(useCorrectionStore.getState().runs.map(r => r.id)).toEqual([c.id, b.id])
    expect(useCorrectionStore.getState().selectedRunId).toBe(c.id)
    expect(runPersistence.deleteRun).toHaveBeenCalledWith(a.id)
  })

  it('deleting the selected run selects the most recent remaining compatible run', () => {
    const [, b, c] = threeRuns()
    useCorrectionStore.getState().remove(c.id)
    expect(useCorrectionStore.getState().selectedRunId).toBe(b.id)
  })

  it('deleting the selected run with only incompatible runs left selects none', () => {
    const [a, b, c] = threeRuns()
    // an older, incompatible run
    useCorrectionStore.setState({ runs: [c, { ...b, breakpoints: { map: [1], rpm: [1] } }, { ...a, breakpoints: { map: [1], rpm: [1] } }] })
    useCorrectionStore.getState().remove(c.id)
    expect(useCorrectionStore.getState().selectedRunId).toBeNull()
  })

  it('select ignores an unknown id and accepts null', () => {
    const [a] = threeRuns()
    useCorrectionStore.getState().select('nope')
    expect(useCorrectionStore.getState().selectedRunId).not.toBe('nope')
    useCorrectionStore.getState().select(a.id)
    expect(selectSelectedRun(useCorrectionStore.getState())?.id).toBe(a.id)
    useCorrectionStore.getState().select(null)
    expect(useCorrectionStore.getState().selectedRunId).toBeNull()
  })
})

describe('markSeen / hydrate', () => {
  it('markSeen clears the unseen flag', () => {
    useCorrectionStore.setState({ hasUnseenRun: true })
    useCorrectionStore.getState().markSeen()
    expect(useCorrectionStore.getState().hasUnseenRun).toBe(false)
  })

  it('hydrate sorts newest first, caps at MAX_RUNS and falls back to the newest when the saved selection is gone', () => {
    useMapStore.setState({ originalMap: makeMap() })
    useLogStore.setState({ logs: [makeLog()] })
    const mk = (createdAt: number) => ({ ...useCorrectionStore.getState().generate()!, createdAt, id: `r${createdAt}` })
    const runs = [mk(1), mk(3), mk(2)]
    useCorrectionStore.setState({ runs: [], selectedRunId: null, hasUnseenRun: false })
    useCorrectionStore.getState().hydrate({ runs, selectedRunId: 'missing' })
    const s = useCorrectionStore.getState()
    expect(s.runs.map(r => r.createdAt)).toEqual([3, 2, 1])
    expect(s.selectedRunId).toBe('r3')
    expect(s.hasUnseenRun).toBe(false)
  })
})
