import type { TimeSelection } from './datalog'

/** Lambda Loop raw values: 0=open, 1=closed, 2=closed + auto-correção (fuel trim active). */
export type LambdaLoopState = 0 | 1 | 2

export interface CorrectionFilterConfig {
  /** Lambda Loop states that qualify a point. All three selected = no filtering. */
  lambdaLoop:        LambdaLoopState[]
  minClt:            number
  minLambda:         number
  maxLambda:         number
  maxDeltaTps:       number
  maxDeltaMap:       number
  maxDeltaLambdaTarget: number
  skipFirstClosedLoop: number
  skipFirstOpenLoop:   number
}

export const DEFAULT_CORRECTION_FILTERS: CorrectionFilterConfig = {
  lambdaLoop:           [1, 2],
  minClt:               85,
  minLambda:            0.6,
  maxLambda:            1.1,
  maxDeltaTps:          5,
  maxDeltaMap:          5,
  maxDeltaLambdaTarget: 0.03,
  skipFirstClosedLoop:  5,
  skipFirstOpenLoop:    10,
}

/** Compares two filter configs for equality (used to detect unapplied edits). */
export function filtersEqual(a: CorrectionFilterConfig, b: CorrectionFilterConfig): boolean {
  const sortedA = { ...a, lambdaLoop: [...a.lambdaLoop].sort() }
  const sortedB = { ...b, lambdaLoop: [...b.lambdaLoop].sort() }
  return JSON.stringify(sortedA) === JSON.stringify(sortedB)
}

/** Fixed weighting constant (K) for `w = n / (n + CONFIDENCE_CONSTANT)`. No UI control. */
export const CONFIDENCE_CONSTANT = 100

export interface CorrectionCell {
  /** Effective sample count — sum of bilinear weights of points touching this cell. */
  n:      number
  /** Weighted mean of per-point VE Lambda values; null when n === 0. */
  mean:   number | null
  /** Unweighted median of the same point set; null when n === 0. */
  median: number | null
}

export interface CorrectionProvenance {
  logFilenames: string[]
  timeRange:    TimeSelection | null
  filters:      CorrectionFilterConfig
}

export interface CorrectionSnapshot {
  /** Same shape as the map: cells[rowI][colJ], rowI over mapBreakpoints, colJ over rpmBreakpoints. */
  cells:       CorrectionCell[][]
  generatedAt: number
  provenance:  CorrectionProvenance
}
