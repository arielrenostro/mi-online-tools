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
