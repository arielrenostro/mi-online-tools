import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { MapModel } from '@/types/map'
import type { TuningOutput } from '@/types/tuning'
import { parseMapClient }    from '@/parsers/mapParser'
import * as mapPersistence   from '@/persistence/mapPersistence'
import { deepEqual }         from '@/utils/deepEqual'
import { debounce }          from '@/utils/debounce'

const MAX_HISTORY = 50

interface MapState {
  originalMap: MapModel | null
  editableMap: number[][] | null
  isDirty:     boolean
  isLoading:   boolean
  lastError:   string | null
  history:     number[][][]
  future:      number[][][]

  editableIgnitionMap: number[][] | null
  isDirtyIgnition:     boolean
  historyIgnition:     number[][][]
  futureIgnition:      number[][][]

  editableLambdaMap:   number[][] | null
  isDirtyLambda:       boolean
  historyLambda:       number[][][]
  futureLambda:        number[][][]
}

interface MapActions {
  loadMap(file: File): Promise<void>
  resetEditable(): void
  updateCell(row: number, col: number, value: number): void
  bulkUpdateCells(changes: { row: number; col: number; value: number }[]): void
  applyTuningOutput(suggested: number[][]): void
  clear(): Promise<void>
  hydrate(data: {
    originalModel:         MapModel
    editableCells:         number[][]
    editableIgnitionCells: number[][]
    editableLambdaCells:   number[][]
  }): void
  undo(): void
  redo(): void

  updateIgnitionCell(row: number, col: number, value: number): void
  bulkUpdateIgnitionCells(changes: { row: number; col: number; value: number }[]): void
  resetIgnition(): void
  undoIgnition(): void
  redoIgnition(): void

  updateLambdaCell(row: number, col: number, value: number): void
  bulkUpdateLambdaCells(changes: { row: number; col: number; value: number }[]): void
  resetLambda(): void
  undoLambda(): void
  redoLambda(): void
}

const initial: MapState = {
  originalMap: null, editableMap: null,
  isDirty: false, isLoading: false, lastError: null,
  history: [], future: [],
  editableIgnitionMap: null, isDirtyIgnition: false, historyIgnition: [], futureIgnition: [],
  editableLambdaMap:   null, isDirtyLambda:   false, historyLambda:   [], futureLambda:   [],
}

const _saveVeDebounced = debounce(async (cells: number[][]) => {
  try { await mapPersistence.updateEditableCells(cells) } catch { /* non-fatal */ }
}, 300)

const _saveIgnitionDebounced = debounce(async (cells: number[][]) => {
  try { await mapPersistence.updateIgnitionCells(cells) } catch { /* non-fatal */ }
}, 300)

const _saveLambdaDebounced = debounce(async (cells: number[][]) => {
  try { await mapPersistence.updateLambdaCells(cells) } catch { /* non-fatal */ }
}, 300)

function snap(m: number[][]): number[][] { return m.map(r => [...r]) }

function pushHistory(history: number[][][], current: number[][]): number[][][] {
  const next = [...history, snap(current)]
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
}

function clampVe(v: number)       { return Math.max(100,  Math.min(9999, Math.round(v))) }
function clampIgnition(v: number) { return Math.max(0,    Math.min(100,  Math.round(v))) }
function clampLambda(v: number)   { return Math.max(0,    Math.min(2000, Math.round(v))) }

export const useMapStore = create<MapState & MapActions>()(
  subscribeWithSelector((set, get) => ({
    ...initial,

    async loadMap(file) {
      set({ isLoading: true, lastError: null })
      try {
        const model              = await parseMapClient(file)
        const editableCells      = snap(model.cells)
        const editableIgnition   = snap(model.ignitionCells)
        const editableLambda     = snap(model.lambdaCells)
        set({
          originalMap: model,
          editableMap:         editableCells,
          editableIgnitionMap: editableIgnition,
          editableLambdaMap:   editableLambda,
          isDirty:         false,
          isDirtyIgnition: false,
          isDirtyLambda:   false,
          isLoading: false,
          history: [], future: [],
          historyIgnition: [], futureIgnition: [],
          historyLambda:   [], futureLambda:   [],
        })
        await mapPersistence.saveMap(model, editableCells, file)
        const { useTuningStore } = await import('./tuningStore')
        useTuningStore.getState().clearOutput()
      } catch (err) {
        set({ isLoading: false, lastError: err instanceof Error ? err.message : 'Erro ao parsear mapa.' })
      }
    },

    // ── VE ───────────────────────────────────────────────────────────────────

    resetEditable() {
      const { originalMap, editableMap, history } = get()
      if (!originalMap || !editableMap) return
      const fresh = snap(originalMap.cells)
      set({ editableMap: fresh, isDirty: false, history: pushHistory(history, editableMap), future: [] })
      _saveVeDebounced(fresh)
    },

    updateCell(row, col, value) {
      const { editableMap, originalMap, history } = get()
      if (!editableMap || !originalMap) return
      const clamped = clampVe(value)
      const newMap  = editableMap.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? clamped : c)) : r
      )
      set({ editableMap: newMap, isDirty: !deepEqual(newMap, originalMap.cells), history: pushHistory(history, editableMap), future: [] })
      _saveVeDebounced(newMap)
    },

    bulkUpdateCells(changes) {
      const { editableMap, originalMap, history } = get()
      if (!editableMap || !originalMap) return
      const newMap = snap(editableMap)
      for (const { row, col, value } of changes) {
        newMap[row][col] = clampVe(value)
      }
      set({ editableMap: newMap, isDirty: !deepEqual(newMap, originalMap.cells), history: pushHistory(history, editableMap), future: [] })
      _saveVeDebounced(newMap)
    },

    applyTuningOutput(suggested) {
      const { originalMap, editableMap, history } = get()
      if (!originalMap) return
      const newMap     = snap(suggested)
      const newHistory = editableMap ? pushHistory(history, editableMap) : history
      set({ editableMap: newMap, isDirty: !deepEqual(newMap, originalMap.cells), history: newHistory, future: [] })
      _saveVeDebounced(newMap)
    },

    undo() {
      const { history, editableMap, originalMap, future } = get()
      if (!history.length || !editableMap || !originalMap) return
      const prev      = history[history.length - 1]
      const newFuture = [snap(editableMap), ...future].slice(0, MAX_HISTORY)
      set({ editableMap: prev, isDirty: !deepEqual(prev, originalMap.cells), history: history.slice(0, -1), future: newFuture })
      _saveVeDebounced(prev)
    },

    redo() {
      const { future, editableMap, originalMap, history } = get()
      if (!future.length || !editableMap || !originalMap) return
      const next = future[0]
      set({ editableMap: next, isDirty: !deepEqual(next, originalMap.cells), history: pushHistory(history, editableMap), future: future.slice(1) })
      _saveVeDebounced(next)
    },

    // ── Ignition ─────────────────────────────────────────────────────────────

    updateIgnitionCell(row, col, value) {
      const { editableIgnitionMap, originalMap, historyIgnition } = get()
      if (!editableIgnitionMap || !originalMap) return
      const clamped = clampIgnition(value)
      const newMap  = editableIgnitionMap.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? clamped : c)) : r
      )
      set({ editableIgnitionMap: newMap, isDirtyIgnition: !deepEqual(newMap, originalMap.ignitionCells), historyIgnition: pushHistory(historyIgnition, editableIgnitionMap), futureIgnition: [] })
      _saveIgnitionDebounced(newMap)
    },

    bulkUpdateIgnitionCells(changes) {
      const { editableIgnitionMap, originalMap, historyIgnition } = get()
      if (!editableIgnitionMap || !originalMap) return
      const newMap = snap(editableIgnitionMap)
      for (const { row, col, value } of changes) {
        newMap[row][col] = clampIgnition(value)
      }
      set({ editableIgnitionMap: newMap, isDirtyIgnition: !deepEqual(newMap, originalMap.ignitionCells), historyIgnition: pushHistory(historyIgnition, editableIgnitionMap), futureIgnition: [] })
      _saveIgnitionDebounced(newMap)
    },

    resetIgnition() {
      const { originalMap, editableIgnitionMap, historyIgnition } = get()
      if (!originalMap || !editableIgnitionMap) return
      const fresh = snap(originalMap.ignitionCells)
      set({ editableIgnitionMap: fresh, isDirtyIgnition: false, historyIgnition: pushHistory(historyIgnition, editableIgnitionMap), futureIgnition: [] })
      _saveIgnitionDebounced(fresh)
    },

    undoIgnition() {
      const { historyIgnition, editableIgnitionMap, originalMap, futureIgnition } = get()
      if (!historyIgnition.length || !editableIgnitionMap || !originalMap) return
      const prev      = historyIgnition[historyIgnition.length - 1]
      const newFuture = [snap(editableIgnitionMap), ...futureIgnition].slice(0, MAX_HISTORY)
      set({ editableIgnitionMap: prev, isDirtyIgnition: !deepEqual(prev, originalMap.ignitionCells), historyIgnition: historyIgnition.slice(0, -1), futureIgnition: newFuture })
      _saveIgnitionDebounced(prev)
    },

    redoIgnition() {
      const { futureIgnition, editableIgnitionMap, originalMap, historyIgnition } = get()
      if (!futureIgnition.length || !editableIgnitionMap || !originalMap) return
      const next = futureIgnition[0]
      set({ editableIgnitionMap: next, isDirtyIgnition: !deepEqual(next, originalMap.ignitionCells), historyIgnition: pushHistory(historyIgnition, editableIgnitionMap), futureIgnition: futureIgnition.slice(1) })
      _saveIgnitionDebounced(next)
    },

    // ── Lambda ───────────────────────────────────────────────────────────────

    updateLambdaCell(row, col, value) {
      const { editableLambdaMap, originalMap, historyLambda } = get()
      if (!editableLambdaMap || !originalMap) return
      const clamped = clampLambda(value)
      const newMap  = editableLambdaMap.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? clamped : c)) : r
      )
      set({ editableLambdaMap: newMap, isDirtyLambda: !deepEqual(newMap, originalMap.lambdaCells), historyLambda: pushHistory(historyLambda, editableLambdaMap), futureLambda: [] })
      _saveLambdaDebounced(newMap)
    },

    bulkUpdateLambdaCells(changes) {
      const { editableLambdaMap, originalMap, historyLambda } = get()
      if (!editableLambdaMap || !originalMap) return
      const newMap = snap(editableLambdaMap)
      for (const { row, col, value } of changes) {
        newMap[row][col] = clampLambda(value)
      }
      set({ editableLambdaMap: newMap, isDirtyLambda: !deepEqual(newMap, originalMap.lambdaCells), historyLambda: pushHistory(historyLambda, editableLambdaMap), futureLambda: [] })
      _saveLambdaDebounced(newMap)
    },

    resetLambda() {
      const { originalMap, editableLambdaMap, historyLambda } = get()
      if (!originalMap || !editableLambdaMap) return
      const fresh = snap(originalMap.lambdaCells)
      set({ editableLambdaMap: fresh, isDirtyLambda: false, historyLambda: pushHistory(historyLambda, editableLambdaMap), futureLambda: [] })
      _saveLambdaDebounced(fresh)
    },

    undoLambda() {
      const { historyLambda, editableLambdaMap, originalMap, futureLambda } = get()
      if (!historyLambda.length || !editableLambdaMap || !originalMap) return
      const prev      = historyLambda[historyLambda.length - 1]
      const newFuture = [snap(editableLambdaMap), ...futureLambda].slice(0, MAX_HISTORY)
      set({ editableLambdaMap: prev, isDirtyLambda: !deepEqual(prev, originalMap.lambdaCells), historyLambda: historyLambda.slice(0, -1), futureLambda: newFuture })
      _saveLambdaDebounced(prev)
    },

    redoLambda() {
      const { futureLambda, editableLambdaMap, originalMap, historyLambda } = get()
      if (!futureLambda.length || !editableLambdaMap || !originalMap) return
      const next = futureLambda[0]
      set({ editableLambdaMap: next, isDirtyLambda: !deepEqual(next, originalMap.lambdaCells), historyLambda: pushHistory(historyLambda, editableLambdaMap), futureLambda: futureLambda.slice(1) })
      _saveLambdaDebounced(next)
    },

    // ── General ──────────────────────────────────────────────────────────────

    async clear() {
      set(initial)
      await mapPersistence.clearMap()
      const { useTuningStore } = await import('./tuningStore')
      useTuningStore.getState().clearOutput()
    },

    hydrate({ originalModel, editableCells, editableIgnitionCells, editableLambdaCells }) {
      set({
        originalMap:         originalModel,
        editableMap:         editableCells,
        isDirty:             !deepEqual(editableCells, originalModel.cells),
        editableIgnitionMap: editableIgnitionCells,
        isDirtyIgnition:     !deepEqual(editableIgnitionCells, originalModel.ignitionCells),
        editableLambdaMap:   editableLambdaCells,
        isDirtyLambda:       !deepEqual(editableLambdaCells, originalModel.lambdaCells),
        isLoading: false, lastError: null,
        history: [], future: [],
        historyIgnition: [], futureIgnition: [],
        historyLambda:   [], futureLambda:   [],
      })
    },
  }))
)
