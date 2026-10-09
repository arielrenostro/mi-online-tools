import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/persistence/mapPersistence', () => ({
  saveMap:             vi.fn(async () => {}),
  updateEditableCells: vi.fn(async () => {}),
  updateIgnitionCells: vi.fn(async () => {}),
  updateLambdaCells:   vi.fn(async () => {}),
  loadMap:             vi.fn(async () => undefined),
  clearMap:            vi.fn(async () => {}),
}))

vi.mock('@/parsers/mapParser', () => ({
  parseMapClient: vi.fn(),
}))

import { useMapStore } from './mapStore'
import { useCorrectionStore } from './correctionStore'
import { useFilterStore } from './filterStore'
import { useLogStore } from './logStore'
import * as mapPersistence from '@/persistence/mapPersistence'
import { parseMapClient } from '@/parsers/mapParser'
import { computeApplyChanges, computeFactorGrid } from '@/utils/correctionDisplay'
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

describe('applying a correction run to the map', () => {
  // Map cells are raw VE (%×10); the run holds VE Lambda in real %: 10 → 100 raw.
  const run = {
    cells: [
      [{ n: 50, mean: 20, median: 20, mode: 20 }, { n: 0, mean: null, median: null, mode: null }, { n: 50, mean: 30, median: 30, mode: 30 }],
      [{ n: 0, mean: null, median: null, mode: null }, { n: 0, mean: null, median: null, mode: null }, { n: 0, mean: null, median: null, mode: null }],
    ],
  }

  it('multiplies the cells with data by the selected factor, in one undo step, leaving the others alone', () => {
    const grid = computeFactorGrid(run, useMapStore.getState().editableMap!, 'mean', 'direct')
    useMapStore.getState().bulkUpdateCells(computeApplyChanges(grid, useMapStore.getState().editableMap!))
    const map = useMapStore.getState().editableMap!
    expect(map[0][0]).toBe(200) // 100 raw (10%) × (20 / 10) = 200
    expect(map[0][2]).toBe(300) // 200 raw (20%) × (30 / 20) = 300
    expect(map[0][1]).toBe(150) // no data → unchanged
    expect(map[1]).toEqual([300, 350, 400])
    expect(useMapStore.getState().history.length).toBe(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().editableMap![0][0]).toBe(100)
  })

  it('a run with no data produces no changes', () => {
    const empty = { cells: run.cells.map(r => r.map(() => ({ n: 0, mean: null, median: null, mode: null }))) }
    const grid = computeFactorGrid(empty, useMapStore.getState().editableMap!, 'mean', 'direct')
    expect(computeApplyChanges(grid, useMapStore.getState().editableMap!)).toEqual([])
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

describe('clear (Remover mapa)', () => {
  it('zera mapa, tabelas editáveis, flags, históricos e erro', async () => {
    useMapStore.getState().updateCell(0, 0, 999)
    useMapStore.getState().updateIgnitionCell(0, 0, 50)
    useMapStore.getState().updateLambdaCell(0, 0, 1500)
    useMapStore.setState({ lastError: 'x' })

    await useMapStore.getState().clear()

    const s = useMapStore.getState()
    expect(s.originalMap).toBeNull()
    expect(s.editableMap).toBeNull()
    expect(s.editableIgnitionMap).toBeNull()
    expect(s.editableLambdaMap).toBeNull()
    expect([s.isDirty, s.isDirtyIgnition, s.isDirtyLambda]).toEqual([false, false, false])
    expect([s.history, s.historyIgnition, s.historyLambda].every(h => h.length === 0)).toBe(true)
    expect([s.future, s.futureIgnition, s.futureLambda].every(h => h.length === 0)).toBe(true)
    expect(s.lastError).toBeNull()
  })

  it('apaga a cópia persistida do mapa', async () => {
    vi.mocked(mapPersistence.clearMap).mockClear()
    await useMapStore.getState().clear()
    expect(mapPersistence.clearMap).toHaveBeenCalledTimes(1)
  })

  it('não altera logs, filtro nem runs de correção', async () => {
    const run = { id: 'r1' } as never
    useCorrectionStore.setState({ runs: [run], selectedRunId: 'r1' })
    const logs = useLogStore.getState().logs
    const filter = useFilterStore.getState().filter

    await useMapStore.getState().clear()

    expect(useCorrectionStore.getState().runs).toEqual([run])
    expect(useCorrectionStore.getState().selectedRunId).toBe('r1')
    expect(useLogStore.getState().logs).toBe(logs)
    expect(useFilterStore.getState().filter).toBe(filter)
    useCorrectionStore.setState({ runs: [], selectedRunId: null })
  })
})

describe('loadMap (Importar mapa)', () => {
  const file = new File(['x'], 'novo.csv')

  it('arquivo inválido mantém o mapa anterior e preenche lastError', async () => {
    vi.mocked(parseMapClient).mockRejectedValueOnce(new Error('CSV inválido'))
    useMapStore.getState().updateCell(0, 0, 999)

    await useMapStore.getState().loadMap(file)

    const s = useMapStore.getState()
    expect(s.lastError).toBe('CSV inválido')
    expect(s.isLoading).toBe(false)
    expect(s.originalMap!.name).toBe('test.csv')
    expect(s.editableMap![0][0]).toBe(999)
  })

  it('importação bem-sucedida troca o mapa, descarta edições e limpa lastError', async () => {
    useMapStore.getState().updateCell(0, 0, 999)
    useMapStore.setState({ lastError: 'antigo' })
    vi.mocked(parseMapClient).mockResolvedValueOnce({ ...makeMap(), name: 'novo.csv' })

    await useMapStore.getState().loadMap(file)

    const s = useMapStore.getState()
    expect(s.originalMap!.name).toBe('novo.csv')
    expect(s.editableMap![0][0]).toBe(100)
    expect(s.isDirty).toBe(false)
    expect(s.history).toEqual([])
    expect(s.lastError).toBeNull()
  })
})
