import { useMemo } from 'react'
import { useLogStore } from '@/store/logStore'
import { useCorrectionStore } from '@/store/correctionStore'
import { evaluateCorrectionFilters } from '@/utils/correctionFilters'

/**
 * Boolean mask, in the same order as `selectAllRows`/`flattenActiveRows`
 * (active logs, each log's rows in order, concatenated), of which points
 * currently pass the VE correction filters.
 */
export function useCorrectionMask(): boolean[] {
  const logs    = useLogStore(s => s.logs)
  const filters = useCorrectionStore(s => s.filters)
  return useMemo(() => evaluateCorrectionFilters(logs, filters), [logs, filters])
}
