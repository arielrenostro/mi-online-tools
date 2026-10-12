import type { TimeSelection } from './datalog'
import type { FilterConfig } from './filter'

/** Lambda Loop raw values: 0=open, 1=closed, 2=closed + auto-correção (fuel trim active). */
export type LambdaLoopState = 0 | 1 | 2

/** Half-width (ratio, i.e. 0.5 percentage points of factor) of the sliding window that defines the mode's "approximate same value". */
export const MODE_TOLERANCE = 0.005

/** Padrão da constante de confiança k do Ponderado: `w = n / (n + k)`. Editável em Configurações. */
export const DEFAULT_CONFIDENCE_K = 100

/**
 * Per-cell statistics derived from a run's samples against the loaded map (never stored in a new run).
 * `mean`/`median`/`mode` are per-point ratios `VE Lambda ÷ map VE interpolated at the point`, i.e.
 * already a factor (1.02 = +2%).
 */
export interface CorrectionCell {
  /** Effective sample count — sum of bilinear weights of points touching this cell. */
  n:      number
  /** Weighted mean of the per-point ratios; null when n === 0. */
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
 * Um compilado de correção, gerado no Datalog e consumido na aba VE. Guarda as amostras (MAP, RPM,
 * VE Lambda) dos pontos qualificados e os breakpoints do mapa contra o qual foi gerado; as
 * estatísticas por célula e o fator são derivados na leitura contra o mapa carregado.
 */
export interface CorrectionRun {
  id:          string
  name:        string
  createdAt:   number
  breakpoints: RunBreakpoints
  /**
   * Amostras intercaladas `[MAP, RPM, VE Lambda, …]` dos pontos qualificados dentro da faixa do mapa.
   * `null` (ou ausente, em runs persistidos antes das amostras) = run sem amostras: não utilizável.
   */
  samples:     Float64Array | null
  /**
   * Obsoleto: estatísticas por célula do VE Lambda absoluto, só em runs gerados antes das amostras
   * (e no migrado do snapshot único). Nunca lido para calcular fatores; mantido só para não perder dados.
   */
  cells?:      CorrectionCell[][]
  recipe:      RunRecipe
}

/** Um run só tem fatores a exibir se guarda amostras. */
export function runHasSamples(run: Pick<CorrectionRun, 'samples'>): boolean {
  return run.samples != null && run.samples.length > 0
}

/** Dois conjuntos de breakpoints são iguais quando MAP e RPM coincidem valor a valor, na mesma ordem. */
export function breakpointsEqual(a: RunBreakpoints, b: RunBreakpoints): boolean {
  const same = (x: number[], y: number[]) => x.length === y.length && x.every((v, i) => v === y[i])
  return same(a.map, b.map) && same(a.rpm, b.rpm)
}
