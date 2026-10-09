import { useMemo, useRef } from 'react'
import type { DatalogRow } from '@/types/datalog'
import { useLogStore, commonSignals } from '@/store/logStore'
import { useConstantsStore } from '@/store/constantsStore'
import { getDisplayRows, withRuntimeSignals } from '@/signals/displayRows'

/**
 * Linhas dos logs ativos concatenadas, com os sinais de runtime (VE Lambda Corrigido, Potência,
 * Torque) calculados a partir das constantes atuais. Use em tudo que EXIBE dados; geração de
 * correção e filtros de correção seguem em `flattenActiveRows` (sem esses sinais).
 *
 * `enabled` false (tela montada mas fora de vista, ex.: os gráficos escondidos): devolve as últimas
 * linhas calculadas sem recalcular — editar uma constante em Configurações não refaz as 72 mil linhas
 * por causa de uma tela que ninguém está vendo.
 */
export function useDisplayRows(enabled = true): DatalogRow[] {
  const logs   = useLogStore(s => s.logs)
  const values = useConstantsStore(s => s.values)
  const last   = useRef<DatalogRow[] | null>(null)
  return useMemo(() => {
    if (!enabled && last.current) return last.current
    last.current = getDisplayRows(logs, values)
    return last.current
  }, [enabled, logs, values])
}

/** Sinais disponíveis em todos os logs ativos, mais os de runtime. */
export function useDisplaySignals(): string[] {
  const logs = useLogStore(s => s.logs)
  return useMemo(() => withRuntimeSignals(commonSignals(logs)), [logs])
}
