import type { TimeSelection } from './datalog'
import type { FilterConfig } from './filter'

/** Lambda Loop raw values: 0=open, 1=closed, 2=closed + auto-correção (fuel trim active). */
export type LambdaLoopState = 0 | 1 | 2

/** Half-width (VE percentage points) of the sliding window that defines the mode's "approximate same value". */
export const MODE_TOLERANCE = 0.5

/** Padrão da constante de confiança k do Ponderado: `w = n / (n + k)`. Editável em Configurações. */
export const DEFAULT_CONFIDENCE_K = 100

export interface CorrectionCell {
  /** Effective sample count — sum of bilinear weights of points touching this cell. */
  n:      number
  /** Weighted mean of per-point VE Lambda values; null when n === 0. */
  mean:   number | null
  /** Unweighted median of the same point set; null when n === 0. */
  median: number | null
  /**
   * Approximate most frequent value: mean of the densest ±MODE_TOLERANCE cluster of the same point
   * set. null when n === 0; undefined on snapshots persisted before the mode existed.
   */
  mode?:  number | null
}

/** Intervalo de um log usado no run: o log inteiro, nenhum trecho, ou um trecho em ms do próprio log. */
export type RunLogRange = 'full' | 'unused' | TimeSelection

export interface RunLogRecipe {
  /** `null` só no run migrado do snapshot antigo, que gravava apenas nomes de arquivo. */
  hash:     string | null
  filename: string
  range:    RunLogRange
}

/** Receita do run — só para exibição; nunca é reavaliada (o run não depende dos logs depois de gerado). */
export interface RunRecipe {
  logs:   RunLogRecipe[]
  /**
   * Só nos runs migrados do snapshot antigo, que gravava um único intervalo na timeline concatenada
   * (sem como dividi-lo por log). Runs novos usam `range` em cada log.
   */
  globalTimeRange?: TimeSelection
  /** `null` quando o run veio de um formato que não permite reconstruir o filtro. */
  filter: FilterConfig | null
}

export interface RunBreakpoints {
  /** Descendente: índice 0 = maior MAP (convenção do frontend). */
  map: number[]
  /** Ascendente. */
  rpm: number[]
}

/**
 * Um compilado de correção, gerado no Datalog e consumido na aba VE. Guarda por célula `n`/média/
 * mediana/moda (nunca um fator — o fator é derivado na leitura contra o mapa carregado) e os
 * breakpoints do mapa contra o qual foi gerado.
 */
export interface CorrectionRun {
  id:          string
  name:        string
  createdAt:   number
  breakpoints: RunBreakpoints
  /** cells[rowI][colJ], rowI sobre `breakpoints.map`, colJ sobre `breakpoints.rpm`. */
  cells:       CorrectionCell[][]
  recipe:      RunRecipe
}

/** Dois conjuntos de breakpoints são iguais quando MAP e RPM coincidem valor a valor, na mesma ordem. */
export function breakpointsEqual(a: RunBreakpoints, b: RunBreakpoints): boolean {
  const same = (x: number[], y: number[]) => x.length === y.length && x.every((v, i) => v === y[i])
  return same(a.map, b.map) && same(a.rpm, b.rpm)
}
