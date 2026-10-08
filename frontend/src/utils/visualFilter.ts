import type { DatalogRow, LogEntry } from '@/types/datalog'
import type { LambdaLoopState } from '@/types/correction'

/** Sinais com range no filtro visual (nomes de `SIGNAL_DEFS`). */
export const VISUAL_FILTER_SIGNALS = ['MAP', 'RPM', 'Lambda 1', 'Lambda Corr', 'Pedal'] as const
export type VisualFilterSignal = typeof VISUAL_FILTER_SIGNALS[number]

/** `min`/`max` `null` = lado aberto. Valores no mesmo domínio do sinal já convertido (kPa, RPM, λ, %). */
export interface VisualRange {
  enabled: boolean
  min:     number | null
  max:     number | null
}

export type VisualFilterRanges = Record<VisualFilterSignal, VisualRange>

/** Estados de Lambda Loop que passam; habilitado com lista vazia é inválido (nada passaria). */
export interface VisualLoopFilter {
  enabled: boolean
  states:  LambdaLoopState[]
}

export interface VisualFilterConfig {
  ranges:     VisualFilterRanges
  lambdaLoop: VisualLoopFilter
}

export function emptyVisualRanges(): VisualFilterRanges {
  const ranges = {} as VisualFilterRanges
  for (const sig of VISUAL_FILTER_SIGNALS) ranges[sig] = { enabled: false, min: null, max: null }
  return ranges
}

export function emptyVisualFilter(): VisualFilterConfig {
  return { ranges: emptyVisualRanges(), lambdaLoop: { enabled: false, states: [] } }
}

/** Ativo = ao menos um range habilitado ou o Lambda Loop habilitado. */
export function isVisualFilterActive(filter: VisualFilterConfig): boolean {
  return filter.lambdaLoop.enabled || VISUAL_FILTER_SIGNALS.some(sig => filter.ranges[sig].enabled)
}

/** Range habilitado com mínimo > máximo, ou Lambda Loop habilitado sem nenhum estado. */
export function hasInvalidRange(filter: VisualFilterConfig): boolean {
  if (filter.lambdaLoop.enabled && filter.lambdaLoop.states.length === 0) return true
  return VISUAL_FILTER_SIGNALS.some(sig => {
    const r = filter.ranges[sig]
    return r.enabled && r.min !== null && r.max !== null && r.min > r.max
  })
}

/**
 * Para cada linha, se satisfaz todos os ranges habilitados (AND, limites inclusivos)
 * e, quando habilitado, o conjunto de estados de Lambda Loop. Valor não numérico
 * (NaN) falha a linha do filtro correspondente. Sem nada habilitado, toda linha passa.
 */
export function evaluateVisualFilterForRows(rows: DatalogRow[], filter: VisualFilterConfig): boolean[] {
  const active = VISUAL_FILTER_SIGNALS
    .filter(sig => filter.ranges[sig].enabled)
    .map(sig => ({ sig, min: filter.ranges[sig].min, max: filter.ranges[sig].max }))
  const loopStates = filter.lambdaLoop.enabled ? filter.lambdaLoop.states : null

  return rows.map(row => {
    if (loopStates && !loopStates.includes(row['Lambda Loop'] as LambdaLoopState)) return false
    for (const { sig, min, max } of active) {
      const v = row[sig]
      if (typeof v !== 'number' || Number.isNaN(v)) return false
      if (min !== null && v < min) return false
      if (max !== null && v > max) return false
    }
    return true
  })
}

/**
 * Máscara plana na mesma ordem de `selectAllRows` (logs ativos, linhas de
 * cada log em sequência) — mesma forma de `evaluateCorrectionFilters`.
 */
export function evaluateVisualFilter(logs: LogEntry[], filter: VisualFilterConfig): boolean[] {
  const result: boolean[] = []
  for (const log of logs) {
    if (!log.enabled) continue
    result.push(...evaluateVisualFilterForRows(log.model.rows, filter))
  }
  return result
}
