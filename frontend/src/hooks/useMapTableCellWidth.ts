import { useEffect, useRef, useState } from 'react'
import { computeTableCellWidth } from '@/utils/mapTableWidth'

/**
 * Measures the width of the returned `ref`'s element and returns the per-cell
 * width that gives a `nCols`-column table the same total rendered width the
 * editable VE map's table uses (same formula, same persisted split ratio —
 * see `utils/mapTableWidth.ts`). Used to make the correction heatmaps line up
 * with the map above instead of sizing themselves independently.
 */
export function useMapTableCellWidth(nCols: number) {
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

  const cellWidth = containerWidth > 0 ? computeTableCellWidth(containerWidth, nCols) : undefined
  return { ref, cellWidth }
}
