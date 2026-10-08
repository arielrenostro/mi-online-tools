import { useMemo } from 'react'
import type { DatalogRow } from '@/types/datalog'
import { useLogStore, commonSignals } from '@/store/logStore'
import { useConstantsStore } from '@/store/constantsStore'
import { getDisplayRows, withRuntimeSignals } from '@/signals/displayRows'

/**
 * Linhas dos logs ativos concatenadas, com os sinais de runtime (VE Lambda Corrigido, Potência,
 * Torque) calculados a partir das constantes atuais. Use em tudo que EXIBE dados; geração de
 * correção e filtros de correção seguem em `flattenActiveRows` (sem esses sinais).
 */
export function useDisplayRows(): DatalogRow[] {
  const logs   = useLogStore(s => s.logs)
  const values = useConstantsStore(s => s.values)
  return useMemo(() => getDisplayRows(logs, values), [logs, values])
}

/** Sinais disponíveis em todos os logs ativos, mais os de runtime. */
export function useDisplaySignals(): string[] {
  const logs = useLogStore(s => s.logs)
  return useMemo(() => withRuntimeSignals(commonSignals(logs)), [logs])
}
