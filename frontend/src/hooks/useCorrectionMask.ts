import { useMemo } from 'react'
import { useLogStore } from '@/store/logStore'
import { useCorrectionStore } from '@/store/correctionStore'
import { useVisualFilterStore } from '@/store/visualFilterStore'
import { evaluateCorrectionFilters } from '@/utils/correctionFilters'
import { evaluateVisualFilter, isVisualFilterActive } from '@/utils/visualFilter'

/**
 * Boolean mask, in the same order as `selectAllRows`/`flattenActiveRows`
 * (active logs, each log's rows in order, concatenated), of which points
 * currently pass the active highlight criterion: the visual filter while one
 * is active (replacing the correction filters, not combined with them),
 * otherwise the applied VE correction filters.
 *
 * Display only — "Gerar fator de correção" reads `correctionStore.filters`
 * directly and never goes through this hook.
 */
export function useCorrectionMask(): boolean[] {
  const logs         = useLogStore(s => s.logs)
  const filters      = useCorrectionStore(s => s.filters)
  const visualFilter = useVisualFilterStore(s => s.filter)
  const visualActive = isVisualFilterActive(visualFilter)

  // Two independent memos: applying/clearing the visual filter never invalidates
  // the (costlier) correction mask, so clearing is instant.
  const correctionMask = useMemo(
    () => evaluateCorrectionFilters(logs, filters),
    [logs, filters],
  )
  const visualMask = useMemo(
    () => visualActive ? evaluateVisualFilter(logs, visualFilter) : [],
    [logs, visualFilter, visualActive],
  )

  return visualActive ? visualMask : correctionMask
}
