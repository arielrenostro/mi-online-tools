import { DEFAULT_CONFIDENCE_K } from '@/types/correction'
import type { CorrectionCell } from '@/types/correction'

export type ValueMode = 'direct' | 'weighted'
export type StatMode  = 'mean' | 'median' | 'mode'

/**
 * Direct (undamped) factor for one cell, or null when the cell has no data. The cell's mean/median/mode
 * are already per-point ratios against the loaded map (see `deriveCells`), so the factor is the
 * selected statistic itself — it is not divided by the cell's own map value.
 */
export function computeDirectFactor(cell: CorrectionCell, statMode: StatMode): number | null {
  if (cell.n === 0 || cell.mean === null || cell.median === null) return null
  const stat = statMode === 'mean' ? cell.mean : statMode === 'median' ? cell.median : cell.mode
  return stat ?? null
}

/**
 * Weighted (damped toward 1.0 by sample count) factor for one cell, or null when the cell has no data:
 * `1 + (direct − 1) × w` with `w = n / (n + k)`. `k` is the confidence constant from Configurações.
 */
export function computeWeightedFactor(
  cell: CorrectionCell, statMode: StatMode, k: number = DEFAULT_CONFIDENCE_K,
): number | null {
  const direct = computeDirectFactor(cell, statMode)
  if (direct === null) return null
  const w = cell.n / (cell.n + k)
  return 1 + (direct - 1) * w
}

export function computeFactor(
  cell: CorrectionCell, statMode: StatMode, valueMode: ValueMode, k: number = DEFAULT_CONFIDENCE_K,
): number | null {
  return valueMode === 'direct'
    ? computeDirectFactor(cell, statMode)
    : computeWeightedFactor(cell, statMode, k)
}

/** Grid of factors (same shape as the map/cells), null for cells with no data. */
export function computeFactorGrid(
  cells: CorrectionCell[][],
  statMode: StatMode,
  valueMode: ValueMode,
  k: number = DEFAULT_CONFIDENCE_K,
): (number | null)[][] {
  return cells.map(row => row.map(cell => computeFactor(cell, statMode, valueMode, k)))
}

/**
 * Cell changes that "Aplicar correções no mapa" sends to `bulkUpdateCells`: each cell with a factor
 * becomes its current raw value × factor (rounded); cells without data are left out. One call to
 * `bulkUpdateCells` is one undo step.
 */
export function computeApplyChanges(
  factorGrid: (number | null)[][],
  editableMap: number[][],
): { row: number; col: number; value: number }[] {
  const changes: { row: number; col: number; value: number }[] = []
  factorGrid.forEach((row, rowI) => row.forEach((factor, colJ) => {
    if (factor === null) return
    changes.push({ row: rowI, col: colJ, value: Math.round(editableMap[rowI][colJ] * factor) })
  }))
  return changes
}

/** Fator → variação percentual: 1.05 → +5, 0.95 → −5 (pontos percentuais). */
export function factorToPercent(factor: number | null): number | null {
  return factor === null ? null : (factor - 1) * 100
}

/** Grade de fatores → grade de variações percentuais (null mantido). */
export function percentGrid(factorGrid: (number | null)[][]): (number | null)[][] {
  return factorGrid.map(row => row.map(factorToPercent))
}

/** "+5.0%", "-5.0%", "0.0%" — uma casa decimal; um valor que arredonda para zero não leva sinal. */
export function formatPercentDelta(pct: number | null): string {
  if (pct === null) return '—'
  const r = Math.round(pct * 10) / 10
  if (r === 0) return '0.0%'
  return `${r > 0 ? '+' : ''}${r.toFixed(1)}%`
}

/**
 * Peso de confiança por célula, `n / (n + k)` (0 < w < 1), null nas células sem dados. É o mesmo peso
 * do fator Ponderado; serve para colorir as tabelas de correção pela quantidade de amostras.
 */
export function confidenceWeightGrid(cells: CorrectionCell[][], k: number = DEFAULT_CONFIDENCE_K): (number | null)[][] {
  return cells.map(row => row.map(c => (c.n === 0 ? null : c.n / (c.n + k))))
}
