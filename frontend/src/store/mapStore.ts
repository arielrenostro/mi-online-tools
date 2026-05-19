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
}
interface MapActions {
  loadMap(file: File): Promise<void>
  resetEditable(): void
  updateCell(row: number, col: number, value: number): void
  bulkUpdateCells(changes: { row: number; col: number; value: number }[]): void
  applyTuningOutput(suggested: number[][]): void
  clear(): Promise<void>
  hydrate(data: { originalModel: MapModel; editableCells: number[][] }): void
  undo(): void
  redo(): void
}

const initial: MapState = {
  originalMap: null, editableMap: null,
  isDirty: false, isLoading: false, lastError: null,
  history: [], future: [],
}

const _saveDebounced = debounce(async (cells: number[][]) => {
  try { await mapPersistence.updateEditableCells(cells) } catch { /* non-fatal */ }
}, 300)

function snap(m: number[][]): number[][] { return m.map(r => [...r]) }

function pushHistory(history: number[][][], current: number[][]): number[][][] {
  const next = [...history, snap(current)]
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
}

export const useMapStore = create<MapState & MapActions>()(
  subscribeWithSelector((set, get) => ({
    ...initial,

    async loadMap(file) {
      set({ isLoading: true, lastError: null })
      try {
        const model         = await parseMapClient(file)
        const editableCells = snap(model.cells)
        set({ originalMap: model, editableMap: editableCells, isDirty: false, isLoading: false, history: [], future: [] })
        await mapPersistence.saveMap(model, editableCells, file)
        const { useTuningStore } = await import('./tuningStore')
        useTuningStore.getState().clearOutput()
      } catch (err) {
        set({ isLoading: false, lastError: err instanceof Error ? err.message : 'Erro ao parsear mapa.' })
      }
    },

    resetEditable() {
      const { originalMap, editableMap, history } = get()
      if (!originalMap || !editableMap) return
      const fresh = snap(originalMap.cells)
      set({ editableMap: fresh, isDirty: false, history: pushHistory(history, editableMap), future: [] })
      _saveDebounced(fresh)
    },

    updateCell(row, col, value) {
      const { editableMap, originalMap, history } = get()
      if (!editableMap || !originalMap) return
      const clamped = Math.max(100, Math.min(9999, Math.round(value)))
      const newMap  = editableMap.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? clamped : c)) : r
      )
      set({ editableMap: newMap, isDirty: !deepEqual(newMap, originalMap.cells), history: pushHistory(history, editableMap), future: [] })
      _saveDebounced(newMap)
    },

    bulkUpdateCells(changes) {
      const { editableMap, originalMap, history } = get()
      if (!editableMap || !originalMap) return
      const newMap = snap(editableMap)
      for (const { row, col, value } of changes) {
        newMap[row][col] = Math.max(100, Math.min(9999, Math.round(value)))
      }
      set({ editableMap: newMap, isDirty: !deepEqual(newMap, originalMap.cells), history: pushHistory(history, editableMap), future: [] })
      _saveDebounced(newMap)
    },

    applyTuningOutput(suggested) {
      const { originalMap, editableMap, history } = get()
      if (!originalMap) return
      const newMap     = snap(suggested)
      const newHistory = editableMap ? pushHistory(history, editableMap) : history
      set({ editableMap: newMap, isDirty: !deepEqual(newMap, originalMap.cells), history: newHistory, future: [] })
      _saveDebounced(newMap)
    },

    undo() {
      const { history, editableMap, originalMap, future } = get()
      if (!history.length || !editableMap || !originalMap) return
      const prev      = history[history.length - 1]
      const newFuture = [snap(editableMap), ...future].slice(0, MAX_HISTORY)
      set({ editableMap: prev, isDirty: !deepEqual(prev, originalMap.cells), history: history.slice(0, -1), future: newFuture })
      _saveDebounced(prev)
    },

    redo() {
      const { future, editableMap, originalMap, history } = get()
      if (!future.length || !editableMap || !originalMap) return
      const next = future[0]
      set({ editableMap: next, isDirty: !deepEqual(next, originalMap.cells), history: pushHistory(history, editableMap), future: future.slice(1) })
      _saveDebounced(next)
    },

    async clear() {
      set(initial)
      await mapPersistence.clearMap()
      const { useTuningStore } = await import('./tuningStore')
      useTuningStore.getState().clearOutput()
    },

    hydrate({ originalModel, editableCells }) {
      set({ originalMap: originalModel, editableMap: editableCells, isDirty: !deepEqual(editableCells, originalModel.cells), isLoading: false, lastError: null, history: [], future: [] })
    },
  }))
)
