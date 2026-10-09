import { useMemo } from 'react'
import { useLogStore } from '@/store/logStore'
import { useFilterStore } from '@/store/filterStore'
import { evaluateFilterCached } from '@/utils/filter'

/**
 * Boolean mask, in the same order as `selectAllRows`/`flattenActiveRows`
 * (active logs, each log's rows in order, concatenated), of which points
 * pass the applied filter.
 *
 * It is the one pass/fail state of the app: the same mask highlights points
 * in Dashboard/Gráficos/Dados and (together with the time selection) selects
 * the points of a correction run, so what is highlighted is what is used.
 */
export function useFilterMask(): boolean[] {
  const logs   = useLogStore(s => s.logs)
  const filter = useFilterStore(s => s.filter)
  return useMemo(() => evaluateFilterCached(logs, filter), [logs, filter])
}
