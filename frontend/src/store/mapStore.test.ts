import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/persistence/mapPersistence', () => ({
  saveMap:             vi.fn(async () => {}),
  updateEditableCells: vi.fn(async () => {}),
  updateIgnitionCells: vi.fn(async () => {}),
  updateLambdaCells:   vi.fn(async () => {}),
  loadMap:             vi.fn(async () => undefined),
  clearMap:            vi.fn(async () => {}),
}))

import { useMapStore } from './mapStore'
import type { MapModel } from '@/types/map'

function makeMap(): MapModel {
  return {
    name:           'test.csv',
    rawLines:       [],
    rpmBreakpoints: [1000, 2000, 3000],
    mapBreakpoints: [40, 20],
    cells:          [[100, 150, 200], [300, 350, 400]],
    ignitionCells:  [[10, 15, 20], [30, 35, 40]],
    lambdaCells:    [[900, 950, 1000], [1000, 1050, 1100]],
  }
}

function resetStore(map: MapModel) {
  useMapStore.setState({
    originalMap: map,
    editableMap: map.cells.map(r => [...r]),
    isDirty: false, isLoading: false, lastError: null,
    history: [], future: [],
    editableIgnitionMap: map.ignitionCells.map(r => [...r]),
    isDirtyIgnition: false, historyIgnition: [], futureIgnition: [],
    editableLambdaMap: map.lambdaCells.map(r => [...r]),
    isDirtyLambda: false, historyLambda: [], futureLambda: [],
  })
}

beforeEach(() => {
  resetStore(makeMap())
})

describe('updateCell (VE)', () => {
  it('updates the target cell', () => {
    useMapStore.getState().updateCell(0, 1, 500)
    expect(useMapStore.getState().editableMap![0][1]).toBe(500)
  })

  it('clamps to the VE valid range [100, 9999]', () => {
    useMapStore.getState().updateCell(0, 0, 50)
    expect(useMapStore.getState().editableMap![0][0]).toBe(100)

    useMapStore.getState().updateCell(0, 0, 20000)
    expect(useMapStore.getState().editableMap![0][0]).toBe(9999)
  })

  it('rounds fractional values to the nearest integer', () => {
    useMapStore.getState().updateCell(0, 0, 123.6)
    expect(useMapStore.getState().editableMap![0][0]).toBe(124)
  })

  it('marks isDirty once a value differs from the original', () => {
    expect(useMapStore.getState().isDirty).toBe(false)
    useMapStore.getState().updateCell(0, 0, 999)
    expect(useMapStore.getState().isDirty).toBe(true)
  })

  it('records exactly one undo entry and clears the redo stack', () => {
    useMapStore.getState().updateCell(0, 0, 999)
    expect(useMapStore.getState().history.length).toBe(1)
    expect(useMapStore.getState().future.length).toBe(0)
  })

  it('clears the redo stack once a new edit is made after an undo', () => {
    useMapStore.getState().updateCell(0, 0, 999)
    useMapStore.getState().undo()
    expect(useMapStore.getState().future.length).toBe(1)

    useMapStore.getState().updateCell(0, 0, 555)
    expect(useMapStore.getState().future.length).toBe(0)
  })
})

describe('bulkUpdateCells (VE)', () => {
  it('applies every change, clamping each cell independently', () => {
    useMapStore.getState().bulkUpdateCells([
      { row: 0, col: 0, value: 50 },
      { row: 0, col: 1, value: 20000 },
      { row: 1, col: 2, value: 500 },
    ])
    const map = useMapStore.getState().editableMap!
    expect(map[0][0]).toBe(100)
    expect(map[0][1]).toBe(9999)
    expect(map[1][2]).toBe(500)
  })

  it('records the whole batch as a single undo entry', () => {
    useMapStore.getState().bulkUpdateCells([
      { row: 0, col: 0, value: 500 },
      { row: 0, col: 1, value: 600 },
    ])
    expect(useMapStore.getState().history.length).toBe(1)
  })
})

describe('undo/redo (VE)', () => {
  it('undo reverts the most recent change', () => {
    useMapStore.getState().updateCell(0, 0, 999)
    useMapStore.getState().undo()
    expect(useMapStore.getState().editableMap![0][0]).toBe(100)
  })

  it('redo re-applies an undone change', () => {
    useMapStore.getState().updateCell(0, 0, 999)
    useMapStore.getState().undo()
    useMapStore.getState().redo()
    expect(useMapStore.getState().editableMap![0][0]).toBe(999)
  })

  it('undo is a no-op when there is no history', () => {
    useMapStore.getState().undo()
    expect(useMapStore.getState().editableMap).toEqual(makeMap().cells)
  })

  it('redo is a no-op when there is nothing to redo', () => {
    useMapStore.getState().updateCell(0, 0, 999)
    useMapStore.getState().redo()
    expect(useMapStore.getState().editableMap![0][0]).toBe(999)
  })

  it('undo/redo recompute isDirty against the original map', () => {
    useMapStore.getState().updateCell(0, 0, 999)
    expect(useMapStore.getState().isDirty).toBe(true)
    useMapStore.getState().undo()
    expect(useMapStore.getState().isDirty).toBe(false)
    useMapStore.getState().redo()
    expect(useMapStore.getState().isDirty).toBe(true)
  })

  it('caps history at the 50 most recent actions', () => {
    for (let i = 0; i < 60; i++) {
      useMapStore.getState().updateCell(0, 0, 100 + i)
    }
    expect(useMapStore.getState().history.length).toBe(50)
  })
})

describe('resetEditable', () => {
  it('reverts to the original map, clears isDirty, and records one undo entry', () => {
    useMapStore.getState().updateCell(0, 0, 999)
    useMapStore.getState().resetEditable()

    expect(useMapStore.getState().editableMap).toEqual(makeMap().cells)
    expect(useMapStore.getState().isDirty).toBe(false)
    expect(useMapStore.getState().history.length).toBe(2)
  })
})

describe('applyTuningOutput', () => {
  it('replaces the editable map and records one undo entry', () => {
    const suggested = [[111, 151, 201], [301, 351, 401]]
    useMapStore.getState().applyTuningOutput(suggested)

    expect(useMapStore.getState().editableMap).toEqual(suggested)
    expect(useMapStore.getState().history.length).toBe(1)
  })
})

describe('hydrate', () => {
  it('computes isDirty by comparing each editable map against the original', () => {
    const model = makeMap()
    useMapStore.getState().hydrate({
      originalModel: model,
      editableCells: model.cells.map(r => [...r]),
      editableIgnitionCells: model.ignitionCells.map(r => [...r]),
      editableLambdaCells: [[1, 2, 3], [4, 5, 6]],
    })
    const s = useMapStore.getState()
    expect(s.isDirty).toBe(false)
    expect(s.isDirtyIgnition).toBe(false)
    expect(s.isDirtyLambda).toBe(true)
  })
})

describe('Ignition/Lambda parity', () => {
  it('updateIgnitionCell clamps to [0, 100]', () => {
    useMapStore.getState().updateIgnitionCell(0, 0, -5)
    expect(useMapStore.getState().editableIgnitionMap![0][0]).toBe(0)

    useMapStore.getState().updateIgnitionCell(0, 0, 500)
    expect(useMapStore.getState().editableIgnitionMap![0][0]).toBe(100)
  })

  it('updateLambdaCell clamps to [0, 2000]', () => {
    useMapStore.getState().updateLambdaCell(0, 0, -5)
    expect(useMapStore.getState().editableLambdaMap![0][0]).toBe(0)

    useMapStore.getState().updateLambdaCell(0, 0, 5000)
    expect(useMapStore.getState().editableLambdaMap![0][0]).toBe(2000)
  })

  it('keeps VE, Ignition, and Lambda undo histories independent', () => {
    useMapStore.getState().updateCell(0, 0, 999)
    useMapStore.getState().updateIgnitionCell(0, 0, 50)

    expect(useMapStore.getState().history.length).toBe(1)
    expect(useMapStore.getState().historyIgnition.length).toBe(1)
    expect(useMapStore.getState().historyLambda.length).toBe(0)

    useMapStore.getState().undoIgnition()
    expect(useMapStore.getState().editableIgnitionMap![0][0]).toBe(10)
    expect(useMapStore.getState().editableMap![0][0]).toBe(999) // VE untouched by Ignition undo
  })
})
