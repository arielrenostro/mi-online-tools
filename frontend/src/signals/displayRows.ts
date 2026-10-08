import type { DatalogRow, LogEntry } from '@/types/datalog'
import { flattenActiveRows } from '@/store/logStore'
import { VE_FULL_SCALE } from '@/store/constantsStore'
import type { ConstantsValues } from '@/store/constantsStore'
import { applyRuntimeSignals, RUNTIME_SIGNAL_NAMES } from './runtimeSignals'
import { sortSignals } from './signalRegistry'

let cacheLogs:      LogEntry[] | null = null
let cacheConstants: ConstantsValues | null = null
let cacheRows:      DatalogRow[] = []

/**
 * Linhas dos logs ativos (como `flattenActiveRows`) já com os sinais de runtime — VE Lambda Corrigido,
 * Potência e Torque — calculados com as constantes dadas. Cache de uma entrada por referência de
 * `logs` e `constants`: todos os componentes montados compartilham o mesmo array em vez de cada um
 * refazer o flatten + enriquecimento.
 *
 * Só para exibição. Geração do fator de correção e filtros de correção usam `flattenActiveRows`/
 * `log.model.rows`, que NÃO têm essas chaves — é isso que isola o mapa das constantes.
 */
export function getDisplayRows(logs: LogEntry[], constants: ConstantsValues): DatalogRow[] {
  if (logs === cacheLogs && constants === cacheConstants) return cacheRows

  const { veAtFull, ...engine } = constants
  const ctx  = { constants: engine, k: VE_FULL_SCALE / veAtFull }
  const rows = flattenActiveRows(logs)
  for (const row of rows) applyRuntimeSignals(row, ctx)

  cacheLogs = logs
  cacheConstants = constants
  cacheRows = rows
  return rows
}

/**
 * Nomes de sinais dos logs ativos acrescidos dos de runtime (vazio quando não há log ativo), na ordem
 * de exibição agrupada (`sortSignals`) — é por aqui que Dashboard, Gráficos e Dinamômetro listam sinais.
 */
export function withRuntimeSignals(signals: string[]): string[] {
  if (signals.length === 0) return signals
  return sortSignals([...signals, ...RUNTIME_SIGNAL_NAMES.filter(n => !signals.includes(n))])
}
