import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { cloneFilter, makeDefaultFilter, sanitizeFilter, filtersEqual, type FilterConfig } from '@/types/filter'
import { lsSet } from '@/persistence/localStorage'

export const FILTER_STORAGE_KEY        = 'miot:correction-filter'
export const SHOW_FILTERED_STORAGE_KEY = 'miot:correction-show-filtered'

/**
 * Filtro único do Datalog — a MESMA máscara destaca pontos no Dashboard/Gráficos/Dados e escolhe os
 * pontos de um run de correção. O rascunho de edição vive no `FilterModal` (estado local), não aqui.
 */
interface FilterState {
  /** Filtro aplicado. */
  filter:             FilterConfig
  /** Pontos filtrados ficam esmaecidos (true) ou somem (false). Vale na hora, sem "Aplicar". */
  showFilteredPoints: boolean
}
interface FilterActions {
  apply(filter: FilterConfig): void
  reset(): void
  setShowFilteredPoints(value: boolean): void
  hydrate(data: { filter?: unknown; showFilteredPoints?: unknown }): void
}

export const useFilterStore = create<FilterState & FilterActions>()(
  subscribeWithSelector((set, get) => ({
    filter:             makeDefaultFilter(),
    showFilteredPoints: true,

    apply(filter) {
      if (filtersEqual(filter, get().filter)) return
      const next = cloneFilter(filter)
      set({ filter: next })
      lsSet(FILTER_STORAGE_KEY, next)
    },

    reset() {
      const next = makeDefaultFilter()
      set({ filter: next })
      lsSet(FILTER_STORAGE_KEY, next)
    },

    setShowFilteredPoints(value) {
      set({ showFilteredPoints: value })
      lsSet(SHOW_FILTERED_STORAGE_KEY, value)
    },

    hydrate({ filter, showFilteredPoints }) {
      set({
        filter:             sanitizeFilter(filter),
        showFilteredPoints: typeof showFilteredPoints === 'boolean' ? showFilteredPoints : true,
      })
    },
  }))
)
