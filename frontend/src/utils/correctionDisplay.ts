import { CONFIDENCE_CONSTANT } from '@/types/correction'
import type { CorrectionCell, CorrectionSnapshot } from '@/types/correction'

export type ValueMode = 'direct' | 'weighted'
export type StatMode  = 'mean' | 'median'

/**
 * `editableMap` cells are raw VE (%×10, e.g. 592); the snapshot's mean/median are VE Lambda in
 * real % (e.g. 59.2) — same scale as the `VE` signal. Convert before dividing, or every factor
 * comes out ~10x too small.
 */
export function rawVeToReal(rawValue: number): number {
  return rawValue / 10
}

/** Direct (undamped) factor for one cell, or null when the cell has no data. */
export function computeDirectFactor(cell: CorrectionCell, currentRawMapValue: number, statMode: StatMode): number | null {
  if (cell.n === 0 || cell.mean === null || cell.median === null) return null
  const stat = statMode === 'mean' ? cell.mean : cell.median
  return stat / rawVeToReal(currentRawMapValue)
}

/** Weighted (damped toward 1.0 by sample count) factor for one cell, or null when the cell has no data. */
export function computeWeightedFactor(cell: CorrectionCell, currentRawMapValue: number, statMode: StatMode): number | null {
  const direct = computeDirectFactor(cell, currentRawMapValue, statMode)
  if (direct === null) return null
  const w = cell.n / (cell.n + CONFIDENCE_CONSTANT)
  return 1 + (direct - 1) * w
}

export function computeFactor(cell: CorrectionCell, currentRawMapValue: number, statMode: StatMode, valueMode: ValueMode): number | null {
  return valueMode === 'direct'
    ? computeDirectFactor(cell, currentRawMapValue, statMode)
    : computeWeightedFactor(cell, currentRawMapValue, statMode)
}

/** Grid of factors (same shape as the map/snapshot), null for cells with no data. */
export function computeFactorGrid(
  snapshot: CorrectionSnapshot,
  editableMap: number[][],
  statMode: StatMode,
  valueMode: ValueMode,
): (number | null)[][] {
  return snapshot.cells.map((row, rowI) =>
    row.map((cell, colJ) => computeFactor(cell, editableMap[rowI][colJ], statMode, valueMode))
  )
}
