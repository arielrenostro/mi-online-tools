import { create } from 'zustand'
import { emptyVisualFilter, isVisualFilterActive, type VisualFilterConfig } from '@/utils/visualFilter'

/**
 * Filtro visual — só destaque de exibição, só de sessão (memória). Propositalmente
 * fora de `correctionStore` e sem persistência: nunca alimenta `generate()` e
 * não sobrevive a um reload.
 */
interface VisualFilterState {
  filter: VisualFilterConfig
}
interface VisualFilterActions {
  /** Aplicar sem nada habilitado (nem range, nem Lambda Loop) equivale a `clear()`. */
  apply(filter: VisualFilterConfig): void
  clear(): void
}

export const useVisualFilterStore = create<VisualFilterState & VisualFilterActions>()((set) => ({
  filter: emptyVisualFilter(),

  apply(filter) {
    if (!isVisualFilterActive(filter)) { set({ filter: emptyVisualFilter() }); return }
    set({ filter })
  },

  clear() {
    set({ filter: emptyVisualFilter() })
  },
}))
