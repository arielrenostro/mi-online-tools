import type { DatalogRow } from '@/types/datalog'

export const SPARKLINE_BUCKETS = 800

export interface SparklineData {
  /** Trechos contínuos de pontos `[timestamp_ms, valor]`; um valor ausente encerra o trecho. */
  segments: [number, number][][]
  /** Mínimo e máximo dos valores válidos (0/0 quando não há nenhum). */
  min: number
  max: number
}

function isValid(v: unknown): v is number {
  return typeof v === 'number' && !isNaN(v)
}

/**
 * Prepara a pré-visualização de um sinal ao longo da timeline. A linha é dividida em `buckets`
 * faixas uniformes de tempo e cada uma emite seu mínimo e seu máximo, na ordem em que ocorrem —
 * assim um pico de uma amostra não se perde numa log longa (ao contrário de "1 a cada N").
 * Valores ausentes (`undefined`/`NaN`) quebram o traço em trechos em vez de virar zero.
 */
export function buildSparkline(
  rows: DatalogRow[],
  signal: string,
  total: number,
  buckets: number = SPARKLINE_BUCKETS,
): SparklineData {
  const segments: [number, number][][] = []
  let current: [number, number][] = []
  let min = Infinity
  let max = -Infinity

  // bucket em andamento
  let idx = -1
  let loT = 0, loV = 0, hiT = 0, hiV = 0

  function flushBucket() {
    if (idx < 0) return
    // ordem temporal; um bucket de um valor só (ou min == max no mesmo instante) emite 1 ponto
    if (loT === hiT) current.push([loT, loV])
    else if (loT < hiT) current.push([loT, loV], [hiT, hiV])
    else current.push([hiT, hiV], [loT, loV])
    idx = -1
  }
  function endSegment() {
    flushBucket()
    if (current.length > 0) segments.push(current)
    current = []
  }

  if (total > 0) {
    for (const row of rows) {
      const v = row[signal]
      if (!isValid(v)) { endSegment(); continue }
      const t = row.timestamp_ms
      const b = Math.max(0, Math.min(buckets - 1, Math.floor((t / total) * buckets)))
      if (b !== idx) {
        flushBucket()
        idx = b
        loT = hiT = t
        loV = hiV = v
      } else {
        if (v < loV) { loV = v; loT = t }
        if (v > hiV) { hiV = v; hiT = t }
      }
      if (v < min) min = v
      if (v > max) max = v
    }
    endSegment()
  }

  return segments.length === 0 ? { segments, min: 0, max: 0 } : { segments, min, max }
}
