import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { CorrectionRun } from '@/types/correction'
import { breakpointsEqual } from '@/types/correction'
import type { MapModel } from '@/types/map'
import { defaultRunName, generateCorrectionRun } from '@/utils/correctionGeneration'
import * as runPersistence from '@/persistence/runPersistence'
import { lsSet } from '@/persistence/localStorage'
import { useLogStore } from './logStore'
import { useTimeStore } from './timeStore'
import { useMapStore } from './mapStore'
import { useFilterStore } from './filterStore'

export const MAX_RUNS = 10
export const SELECTED_RUN_STORAGE_KEY = 'miot:correction-selected-run'

interface CorrectionState {
  /** Histórico, do mais novo para o mais antigo (no máximo `MAX_RUNS`). */
  runs:          CorrectionRun[]
  selectedRunId: string | null
  /** Há um run gerado que o usuário ainda não viu na aba VE (acende o indicador do Mapa na TopBar). */
  hasUnseenRun:  boolean
}
interface CorrectionActions {
  /**
   * Cria um run a partir do filtro aplicado e dos logs ativos; null se não há mapa ou ponto qualificado.
   * `useTimeSelection` (padrão true) decide se o intervalo selecionado na TimeRail limita os pontos.
   */
  generate(options?: { useTimeSelection?: boolean }): CorrectionRun | null
  select(id: string | null): void
  rename(id: string, name: string): void
  remove(id: string): void
  markSeen(): void
  hydrate(data: { runs: CorrectionRun[]; selectedRunId: string | null }): void
}

/** O run só vale para um mapa com exatamente os mesmos breakpoints. */
export function isRunCompatible(run: CorrectionRun, map: Pick<MapModel, 'mapBreakpoints' | 'rpmBreakpoints'> | null): boolean {
  return map !== null && breakpointsEqual(run.breakpoints, { map: map.mapBreakpoints, rpm: map.rpmBreakpoints })
}

export const selectSelectedRun = (s: CorrectionState): CorrectionRun | null =>
  s.runs.find(r => r.id === s.selectedRunId) ?? null

function persistSelected(id: string | null) {
  lsSet(SELECTED_RUN_STORAGE_KEY, id)
}

export const useCorrectionStore = create<CorrectionState & CorrectionActions>()(
  subscribeWithSelector((set, get) => ({
    runs:          [],
    selectedRunId: null,
    hasUnseenRun:  false,

    generate({ useTimeSelection = true } = {}) {
      const { originalMap } = useMapStore.getState()
      if (!originalMap) return null

      const run = generateCorrectionRun(
        useLogStore.getState().logs,
        useFilterStore.getState().filter,
        useTimeSelection ? useTimeStore.getState().selection : null,
        originalMap.mapBreakpoints,
        originalMap.rpmBreakpoints,
      )
      if (!run.cells.some(row => row.some(c => c.n > 0))) return null

      const all      = [run, ...get().runs]
      const kept     = all.slice(0, MAX_RUNS)
      const dropped  = all.slice(MAX_RUNS)
      set({ runs: kept, selectedRunId: run.id, hasUnseenRun: true })
      persistSelected(run.id)
      runPersistence.saveRun(run).catch(() => { /* non-fatal */ })
      for (const old of dropped) runPersistence.deleteRun(old.id).catch(() => { /* non-fatal */ })
      return run
    },

    select(id) {
      if (id !== null && !get().runs.some(r => r.id === id)) return
      set({ selectedRunId: id })
      persistSelected(id)
    },

    rename(id, name) {
      const run = get().runs.find(r => r.id === id)
      if (!run) return
      const trimmed = name.trim()
      const next = { ...run, name: trimmed === '' ? defaultRunName(run.createdAt) : trimmed }
      set({ runs: get().runs.map(r => (r.id === id ? next : r)) })
      runPersistence.saveRun(next).catch(() => { /* non-fatal */ })
    },

    remove(id) {
      const { runs, selectedRunId } = get()
      if (!runs.some(r => r.id === id)) return
      const remaining = runs.filter(r => r.id !== id)
      let nextSelected = selectedRunId
      if (selectedRunId === id) {
        const map = useMapStore.getState().originalMap
        nextSelected = remaining.find(r => isRunCompatible(r, map))?.id ?? null
      }
      set({ runs: remaining, selectedRunId: nextSelected })
      if (nextSelected !== selectedRunId) persistSelected(nextSelected)
      runPersistence.deleteRun(id).catch(() => { /* non-fatal */ })
    },

    markSeen() {
      if (get().hasUnseenRun) set({ hasUnseenRun: false })
    },

    hydrate({ runs, selectedRunId }) {
      const sorted = [...runs].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_RUNS)
      set({
        runs: sorted,
        selectedRunId: sorted.some(r => r.id === selectedRunId) ? selectedRunId : (sorted[0]?.id ?? null),
      })
    },
  }))
)
