import { formatPercentDelta } from './correctionDisplay'

/** Variação percentual do valor atual sobre o original; null quando o original é 0 e o valor mudou (sem base). */
export function diffPercent(original: number, current: number): number | null {
  if (current === original) return 0
  if (original === 0) return null
  return ((current - original) / Math.abs(original)) * 100
}

/**
 * Texto do hover de uma célula editável (VE, Ignição e Lambda): valor original, atual e a diferença
 * em percentual (`+5.0%`, `-5.0%`; `—` quando não há base para o percentual).
 */
export function formatCellDiffTitle(original: number, current: number, fmt: (v: number) => string): string {
  return [
    `Original: ${fmt(original)}`,
    `Atual: ${fmt(current)}`,
    `Diferença: ${formatPercentDelta(diffPercent(original, current))}`,
  ].join('\n')
}
