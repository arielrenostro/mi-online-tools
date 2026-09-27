import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { CorrectionFilterConfig, CorrectionSnapshot } from '@/types/correction'
import { DEFAULT_CORRECTION_FILTERS, filtersEqual } from '@/types/correction'
import { generateCorrectionSnapshot } from '@/utils/correctionGeneration'
import * as correctionPersistence from '@/persistence/correctionPersistence'
import { lsSet } from '@/persistence/localStorage'
import { useLogStore } from './logStore'
import { useTimeStore } from './timeStore'
import { useMapStore } from './mapStore'

interface CorrectionState {
  /** Last applied filters — what Dashboard/Charts/Data and "Gerar" actually use. */
  filters:            CorrectionFilterConfig
  /** In-progress edits in the filter panel, not yet applied. */
  draftFilters:       CorrectionFilterConfig
  showFilteredPoints: boolean
  snapshot:           CorrectionSnapshot | null
  isStale:            boolean
}
interface CorrectionActions {
  setDraftFilters(partial: Partial<CorrectionFilterConfig>): void
  applyFilters(): void
  isFiltersDirty(): boolean
  setShowFilteredPoints(value: boolean): void
  generate(): void
  markStale(): void
  clear(): void
  hydrateFilters(filters: CorrectionFilterConfig): void
  hydrateShowFilteredPoints(value: boolean): void
  hydrateSnapshot(entry: { snapshot: CorrectionSnapshot }): void
}

export const useCorrectionStore = create<CorrectionState & CorrectionActions>()(
  subscribeWithSelector((set, get) => ({
    filters:            DEFAULT_CORRECTION_FILTERS,
    draftFilters:       DEFAULT_CORRECTION_FILTERS,
    showFilteredPoints: true,
    snapshot:           null,
    isStale:            false,

    setDraftFilters(partial) {
      set({ draftFilters: { ...get().draftFilters, ...partial } })
    },

    applyFilters() {
      const { draftFilters, filters, snapshot } = get()
      if (filtersEqual(draftFilters, filters)) return
      set({ filters: draftFilters })
      lsSet('miot:correction-filters', draftFilters)
      if (snapshot) set({ isStale: true })
    },

    isFiltersDirty() {
      const { draftFilters, filters } = get()
      return !filtersEqual(draftFilters, filters)
    },

    setShowFilteredPoints(value) {
      set({ showFilteredPoints: value })
      lsSet('miot:correction-show-filtered', value)
    },

    generate() {
      const { originalMap } = useMapStore.getState()
      if (!originalMap) return
      const logs          = useLogStore.getState().logs
      const timeSelection = useTimeStore.getState().selection
      const { filters }   = get()

      const snapshot = generateCorrectionSnapshot(
        logs, filters, timeSelection,
        originalMap.mapBreakpoints, originalMap.rpmBreakpoints,
      )
      set({ snapshot, isStale: false })
      correctionPersistence.saveSnapshot(snapshot).catch(() => { /* non-fatal */ })
    },

    markStale() {
      if (get().snapshot) set({ isStale: true })
    },

    clear() {
      set({ snapshot: null, isStale: false })
      correctionPersistence.clearSnapshot().catch(() => { /* non-fatal */ })
    },

    hydrateFilters(filters)          { set({ filters, draftFilters: filters }) },
    hydrateShowFilteredPoints(value) { set({ showFilteredPoints: value }) },
    hydrateSnapshot(entry)           { set({ snapshot: entry.snapshot }) },
  }))
)
