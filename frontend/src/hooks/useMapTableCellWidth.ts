import { useEffect, useRef, useState } from 'react'
import { computePairCellWidth, computeTableCellWidth } from '@/utils/mapTableWidth'

/**
 * Measures the width of the returned `ref`'s element and returns the per-cell
 * width that gives a `nCols`-column table the same total rendered width the
 * editable VE map's table uses (same formula, same persisted split ratio —
 * see `utils/mapTableWidth.ts`). Used to make the correction heatmaps line up
 * with the map above instead of sizing themselves independently.
 *
 * With `pairGapPx`, the width is the one for two tables side by side separated by that gap
 * (`computePairCellWidth`): the same as the map's table when two fit, smaller when they would not.
 */
export function useMapTableCellWidth(nCols: number, pairGapPx?: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setContainerWidth(el.getBoundingClientRect().width)
    const obs = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const cellWidth = containerWidth <= 0
    ? undefined
    : pairGapPx !== undefined
      ? computePairCellWidth(containerWidth, nCols, pairGapPx)
      : computeTableCellWidth(containerWidth, nCols)
  return { ref, cellWidth }
}
