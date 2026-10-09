import { FILTER_RANGE_SIGNALS, type FilterConfig, type FilterRange } from '@/types/filter'
import type { RunLogRecipe, RunRecipe } from '@/types/correction'

const LOOP_LABELS: Record<number, string> = { 0: 'Aberto', 1: 'Fechado', 2: 'Fechado+AC' }

export function fmtClock(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function rangeChip(sig: string, r: FilterRange): string {
  if (r.min !== null && r.max !== null) return `${sig} ${r.min}–${r.max}`
  if (r.min !== null) return `${sig} ≥ ${r.min}`
  if (r.max !== null) return `${sig} ≤ ${r.max}`
  return `${sig} (sem limites)`
}

/** Um texto curto por critério LIGADO do filtro usado no run. `null` (formato desconhecido) → lista vazia. */
export function filterChips(filter: FilterConfig | null): string[] {
  if (!filter) return []
  const chips: string[] = []
  for (const sig of FILTER_RANGE_SIGNALS) {
    // Receitas de runs salvos antes das faixas de bateria/injeção/alvo/boost não têm estas chaves.
    if (filter.ranges[sig]?.enabled) chips.push(rangeChip(sig, filter.ranges[sig]))
  }
  if (filter.lambdaLoop.enabled) chips.push(`Loop: ${filter.lambdaLoop.states.map(s => LOOP_LABELS[s]).join('/')}`)
  if (filter.maxDeltaTps.enabled) chips.push(`ΔTPS ≤ ${filter.maxDeltaTps.value}`)
  if (filter.maxDeltaMap.enabled) chips.push(`ΔMAP ≤ ${filter.maxDeltaMap.value}`)
  if (filter.maxDeltaLambdaTarget.enabled) chips.push(`|Δλ×alvo| ≤ ${filter.maxDeltaLambdaTarget.value}`)
  // Receitas de runs salvos antes dos "antes" não têm estes campos.
  if (filter.skipBeforeClosed?.enabled) chips.push(`pula ${filter.skipBeforeClosed.n} últimos antes de CL`)
  if (filter.skipBeforeOpen?.enabled) chips.push(`pula ${filter.skipBeforeOpen.n} últimos antes de OL`)
  if (filter.skipClosed.enabled) chips.push(`pula ${filter.skipClosed.n} 1ºs CL`)
  if (filter.skipOpen.enabled) chips.push(`pula ${filter.skipOpen.n} 1ºs OL`)
  return chips
}

export function logChip(log: RunLogRecipe): string {
  if (log.range === 'full') return log.filename
  if (log.range === 'unused') return `${log.filename} (não usado)`
  return `${log.filename} ${fmtClock(log.range.start_ms)}–${fmtClock(log.range.end_ms)}`
}

/** Chips dos logs (e do intervalo global, nos runs migrados do snapshot antigo). */
export function logChips(recipe: RunRecipe): string[] {
  const chips = recipe.logs.map(logChip)
  if (recipe.globalTimeRange) {
    chips.push(`intervalo ${fmtClock(recipe.globalTimeRange.start_ms)}–${fmtClock(recipe.globalTimeRange.end_ms)} (linha do tempo)`)
  }
  return chips
}
