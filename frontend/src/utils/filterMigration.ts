import { makeDefaultFilter, type FilterConfig } from '@/types/filter'
import type { LambdaLoopState } from '@/types/correction'

/** Formato dos filtros de correção salvos antes do filtro único (`miot:correction-filters`). */
export interface LegacyCorrectionFilters {
  lambdaLoop:           LambdaLoopState[]
  minClt:               number
  minLambda:            number
  maxLambda:            number
  maxDeltaTps:          number
  maxDeltaMap:          number
  maxDeltaLambdaTarget: number
  skipFirstClosedLoop:  number
  skipFirstOpenLoop:    number
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** O formato antigo é reconhecível por `minClt` numérico — o novo não tem essa chave. */
export function isLegacyCorrectionFilters(raw: unknown): raw is LegacyCorrectionFilters {
  return !!raw && typeof raw === 'object' && isFiniteNumber((raw as Record<string, unknown>).minClt)
}

/**
 * Converte o filtro de correção antigo para o filtro único, preservando exatamente os limites:
 * Lambda e CLT viram faixas ligadas, os três estados de Lambda Loop (= "sem filtro") desligam o
 * critério, e skips 0 desligam o skip. MAP/RPM/Pedal/Lambda Corr ficam desligados.
 */
export function migrateLegacyCorrectionFilters(old: LegacyCorrectionFilters): FilterConfig {
  const f = makeDefaultFilter()
  const states = Array.isArray(old.lambdaLoop)
    ? ([...new Set(old.lambdaLoop.filter(s => s === 0 || s === 1 || s === 2))].sort() as LambdaLoopState[])
    : [1, 2] as LambdaLoopState[]

  f.ranges['CLT']      = { enabled: true, min: isFiniteNumber(old.minClt) ? old.minClt : 85, max: null }
  f.ranges['Lambda 1'] = {
    enabled: true,
    min: isFiniteNumber(old.minLambda) ? old.minLambda : 0.6,
    max: isFiniteNumber(old.maxLambda) ? old.maxLambda : 1.1,
  }
  f.lambdaLoop = states.length >= 3 || states.length === 0
    ? { enabled: false, states: [1, 2] }
    : { enabled: true, states }

  if (isFiniteNumber(old.maxDeltaTps))          f.maxDeltaTps          = { enabled: true, value: old.maxDeltaTps }
  if (isFiniteNumber(old.maxDeltaMap))          f.maxDeltaMap          = { enabled: true, value: old.maxDeltaMap }
  if (isFiniteNumber(old.maxDeltaLambdaTarget)) f.maxDeltaLambdaTarget = { enabled: true, value: old.maxDeltaLambdaTarget }

  const closed = isFiniteNumber(old.skipFirstClosedLoop) ? old.skipFirstClosedLoop : 5
  const open   = isFiniteNumber(old.skipFirstOpenLoop) ? old.skipFirstOpenLoop : 10
  f.skipClosed = { enabled: closed > 0, n: closed > 0 ? closed : 5 }
  f.skipOpen   = { enabled: open > 0, n: open > 0 ? open : 10 }
  return f
}
