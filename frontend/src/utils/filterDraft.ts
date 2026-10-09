import {
  FILTER_RANGE_SIGNALS, makeDefaultFilter,
  type FilterConfig, type FilterRangeSignal,
} from '@/types/filter'
import type { LambdaLoopState } from '@/types/correction'

/** Rascunho do modal: campos como texto, para permitir digitação parcial ("-", "0."). */
export interface DraftRange { enabled: boolean; min: string; max: string }
export interface DraftNumber { enabled: boolean; text: string }

export interface FilterDraft {
  ranges:               Record<FilterRangeSignal, DraftRange>
  lambdaLoop:           { enabled: boolean; states: LambdaLoopState[] }
  maxDeltaTps:          DraftNumber
  maxDeltaMap:          DraftNumber
  maxDeltaLambdaTarget: DraftNumber
  skipClosed:           DraftNumber
  skipOpen:             DraftNumber
  skipBeforeClosed:     DraftNumber
  skipBeforeOpen:       DraftNumber
}

/** Chaves de critério, para ligar mensagem de erro ↔ linha do modal. */
export type DraftErrorKey =
  | `range:${FilterRangeSignal}` | 'lambdaLoop'
  | 'maxDeltaTps' | 'maxDeltaMap' | 'maxDeltaLambdaTarget' | 'skipClosed' | 'skipOpen' | 'skipBeforeClosed' | 'skipBeforeOpen'

const SKIP_KEYS = ['skipClosed', 'skipOpen', 'skipBeforeClosed', 'skipBeforeOpen'] as const

const str = (n: number | null): string => (n === null ? '' : String(n))

export function toDraft(filter: FilterConfig): FilterDraft {
  const ranges = {} as FilterDraft['ranges']
  for (const sig of FILTER_RANGE_SIGNALS) {
    const r = filter.ranges[sig]
    ranges[sig] = { enabled: r.enabled, min: str(r.min), max: str(r.max) }
  }
  return {
    ranges,
    lambdaLoop:           { enabled: filter.lambdaLoop.enabled, states: [...filter.lambdaLoop.states] },
    maxDeltaTps:          { enabled: filter.maxDeltaTps.enabled, text: String(filter.maxDeltaTps.value) },
    maxDeltaMap:          { enabled: filter.maxDeltaMap.enabled, text: String(filter.maxDeltaMap.value) },
    maxDeltaLambdaTarget: { enabled: filter.maxDeltaLambdaTarget.enabled, text: String(filter.maxDeltaLambdaTarget.value) },
    skipClosed:           { enabled: filter.skipClosed.enabled, text: String(filter.skipClosed.n) },
    skipOpen:             { enabled: filter.skipOpen.enabled, text: String(filter.skipOpen.n) },
    skipBeforeClosed:     { enabled: filter.skipBeforeClosed.enabled, text: String(filter.skipBeforeClosed.n) },
    skipBeforeOpen:       { enabled: filter.skipBeforeOpen.enabled, text: String(filter.skipBeforeOpen.n) },
  }
}

/** `''` → `null` (lado aberto); texto não numérico → `undefined` (inválido). */
export function parseBound(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isNaN(n) ? undefined : n
}

function parseLimit(text: string): number | undefined {
  const n = parseBound(text)
  return n === null || n === undefined || n < 0 ? undefined : n
}

function parseCount(text: string): number | undefined {
  const n = parseLimit(text)
  return n === undefined || !Number.isInteger(n) ? undefined : n
}

/** Mensagens de erro dos critérios LIGADOS (desligados nunca são erro). Vazio = rascunho válido. */
export function draftErrors(draft: FilterDraft): Partial<Record<DraftErrorKey, string>> {
  const errors: Partial<Record<DraftErrorKey, string>> = {}
  for (const sig of FILTER_RANGE_SIGNALS) {
    const row = draft.ranges[sig]
    if (!row.enabled) continue
    const min = parseBound(row.min)
    const max = parseBound(row.max)
    if (min === undefined || max === undefined) errors[`range:${sig}`] = 'Valor inválido'
    else if (min !== null && max !== null && min > max) errors[`range:${sig}`] = 'Mínimo maior que o máximo'
  }
  if (draft.lambdaLoop.enabled && draft.lambdaLoop.states.length === 0) errors.lambdaLoop = 'Marque ao menos um estado'
  for (const key of ['maxDeltaTps', 'maxDeltaMap', 'maxDeltaLambdaTarget'] as const) {
    if (draft[key].enabled && parseLimit(draft[key].text) === undefined) errors[key] = 'Informe um número maior ou igual a zero'
  }
  for (const key of SKIP_KEYS) {
    if (draft[key].enabled && parseCount(draft[key].text) === undefined) errors[key] = 'Informe um inteiro maior ou igual a zero'
  }
  return errors
}

/**
 * Converte o rascunho em filtro. Critério desligado com texto inválido mantém o valor padrão
 * (nunca é lido); critério ligado inválido também cai no padrão — por isso só use o resultado
 * quando `draftErrors` for vazio.
 */
export function draftToFilter(draft: FilterDraft): FilterConfig {
  const base = makeDefaultFilter()
  for (const sig of FILTER_RANGE_SIGNALS) {
    const row = draft.ranges[sig]
    base.ranges[sig] = { enabled: row.enabled, min: parseBound(row.min) ?? null, max: parseBound(row.max) ?? null }
  }
  base.lambdaLoop = { enabled: draft.lambdaLoop.enabled, states: [...draft.lambdaLoop.states].sort() as LambdaLoopState[] }
  for (const key of ['maxDeltaTps', 'maxDeltaMap', 'maxDeltaLambdaTarget'] as const) {
    base[key] = { enabled: draft[key].enabled, value: parseLimit(draft[key].text) ?? base[key].value }
  }
  for (const key of SKIP_KEYS) {
    base[key] = { enabled: draft[key].enabled, n: parseCount(draft[key].text) ?? base[key].n }
  }
  return base
}
