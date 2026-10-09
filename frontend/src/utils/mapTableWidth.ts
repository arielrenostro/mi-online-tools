export const MAP_CHART_RATIO_KEY = 'miot:map-chart-ratio'
const RATIO_DEFAULT = 0.5
export const RATIO_MIN = 0.15
export const RATIO_MAX = 0.75
/** Estimated width of the sticky "MAP↓/RPM→" header column. */
export const STICKY_COL_PX = 80
/** Width reserved for the drag handle between a map table and its paired chart. */
export const DIVIDER_PX = 12

export function readMapChartRatio(): number {
  const s = localStorage.getItem(MAP_CHART_RATIO_KEY)
  if (!s) return RATIO_DEFAULT
  const n = parseFloat(s)
  return isNaN(n) ? RATIO_DEFAULT : Math.max(RATIO_MIN, Math.min(RATIO_MAX, n))
}

/**
 * Per-cell width that gives a table of `nCols` columns the same total rendered
 * width the editable VE map's table uses inside `MapWithChart` (the `1 - ratio`
 * fraction of `containerWidth`, minus the chart divider and the sticky column).
 * Shared by `MapWithChart` and any other table that should visually match it
 * (e.g. the correction heatmaps) — one formula, so they can't drift apart.
 */
export function computeTableCellWidth(containerWidth: number, nCols: number, ratio = readMapChartRatio()): number | undefined {
  if (nCols <= 0) return undefined
  const tablePx = containerWidth * (1 - ratio) - DIVIDER_PX
  return tablePx > STICKY_COL_PX ? Math.max(24, (tablePx - STICKY_COL_PX) / nCols) : undefined
}

/**
 * Real width the non-cell part of a heatmap table takes (sticky "MAP↓ / RPM→" column + borders).
 * Measured, slightly rounded up: unlike `STICKY_COL_PX` (an estimate that the map's own table has
 * room to absorb), two tables side by side have no slack, so an underestimate becomes a scrollbar.
 */
export const PAIR_FIXED_PX = 94
/** Folga da conta "dois cabem": a tabela renderiza uns pixels acima do calculado (bordas, arredondamento). */
export const PAIR_SLACK_PX = 12

/**
 * Per-cell width for two tables side by side with `gapPx` between them, so the pair never
 * overflows `containerWidth`. Each table is the width of the editable map's table (see
 * `computeTableCellWidth`) unless that would not fit twice, in which case each gets half of the
 * space left after the gap and a small slack. Returns undefined when there is no room for even the fixed part.
 */
export function computePairCellWidth(containerWidth: number, nCols: number, gapPx: number, ratio = readMapChartRatio()): number | undefined {
  if (nCols <= 0) return undefined
  const aligned = containerWidth * (1 - ratio) - DIVIDER_PX
  const fitsTwo = (containerWidth - gapPx - PAIR_SLACK_PX) / 2
  const tablePx = Math.min(aligned, fitsTwo)
  return tablePx > PAIR_FIXED_PX ? Math.max(24, (tablePx - PAIR_FIXED_PX) / nCols) : undefined
}
