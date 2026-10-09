import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import HeatmapTable, { type ColorScale } from '@/components/HeatmapTable'
import MapChart from '@/components/MapChart'
import type { Selection } from '@/utils/mapEditOps'
import { readMapChartRatio, computeTableCellWidth, MAP_CHART_RATIO_KEY, RATIO_MIN, RATIO_MAX } from '@/utils/mapTableWidth'

interface MapWithChartProps {
  cells:          (number | boolean | null)[][]
  rowHeaders:     number[]
  colHeaders:     number[]
  colorScale?:    ColorScale
  readOnly?:      boolean
  onCellChange?:  (row: number, col: number, value: number) => void
  onBulkChange?:  (changes: { row: number; col: number; value: number }[]) => void
  modifiedCells?: Set<string>
  formatValue?:   (v: number | boolean | null) => string
  /** Native tooltip text for a table cell (passed through to the table). */
  cellTitle?:     (row: number, col: number) => string | undefined
  chartHeight?:   number
  onUndo?:        () => void
  onRedo?:        () => void
  canUndo?:       boolean
  canRedo?:       boolean
  onReset?:       () => void
  resetDisabled?: boolean
  /** Selection shared with the other tables of the grid; the chart mirrors it and feeds it. */
  /** Optional: without it the table and chart keep a private selection (e.g. Ignition/Lambda). */
  selection?:         Selection
  onSelectionChange?: (selection: Selection) => void
  onKeyDelegate?:     (e: React.KeyboardEvent) => void
  keyHandlerRef?:     { current: ((e: React.KeyboardEvent) => void) | null }
}

export default function MapWithChart({
  cells,
  rowHeaders,
  colHeaders,
  colorScale,
  readOnly,
  onCellChange,
  onBulkChange,
  modifiedCells,
  formatValue,
  cellTitle,
  chartHeight,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onReset,
  resetDisabled,
  selection: sharedSelection,
  onSelectionChange: onSharedSelectionChange,
  onKeyDelegate,
  keyHandlerRef,
}: MapWithChartProps) {
  const [localSelection, setLocalSelection] = useState<Selection>(null)
  const selection = sharedSelection !== undefined ? sharedSelection : localSelection
  const onSelectionChange = useCallback((next: Selection) => {
    setLocalSelection(next)
    onSharedSelectionChange?.(next)
  }, [onSharedSelectionChange])
  const [focusToken,       setFocusToken]       = useState(0)
  const [chartRatio,       setChartRatio]       = useState<number>(readMapChartRatio)
  const [containerWidth, setContainerWidth] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const ratioRef     = useRef<number>(chartRatio)
  ratioRef.current   = chartRatio

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setContainerWidth(el.getBoundingClientRect().width)
    const obs = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const selectedCells = useMemo(() => {
    const next = new Set<string>()
    if (!selection) return next
    const end = selection.selEnd ?? selection.anchor
    const r0  = Math.min(selection.anchor.r, end.r), r1 = Math.max(selection.anchor.r, end.r)
    const c0  = Math.min(selection.anchor.c, end.c), c1 = Math.max(selection.anchor.c, end.c)
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        next.add(`${r}:${c}`)
    return next
  }, [selection])

  const handleChartCellClick = useCallback((cells: Set<string>) => {
    if (cells.size === 0) return
    const positions = [...cells].map(k => {
      const [r, c] = k.split(':').map(Number)
      return { r, c }
    })
    const minR = Math.min(...positions.map(p => p.r))
    const maxR = Math.max(...positions.map(p => p.r))
    const minC = Math.min(...positions.map(p => p.c))
    const maxC = Math.max(...positions.map(p => p.c))
    onSelectionChange({ anchor: { r: minR, c: minC }, selEnd: { r: maxR, c: maxC } })
    setFocusToken(t => t + 1)
  }, [onSelectionChange])

  function handleDragStart(e: React.MouseEvent) {
    e.preventDefault()
    const startX     = e.clientX
    const containerW = containerRef.current?.getBoundingClientRect().width ?? 1
    const startRatio = ratioRef.current

    function onMove(ev: MouseEvent) {
      const dx       = startX - ev.clientX
      const newRatio = Math.max(RATIO_MIN, Math.min(RATIO_MAX, startRatio + dx / containerW))
      setChartRatio(newRatio)
    }

    function onUp() {
      localStorage.setItem(MAP_CHART_RATIO_KEY, String(ratioRef.current))
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }

  const tablePercent = (1 - chartRatio) * 100
  const chartPercent = chartRatio * 100

  const derivedCellWidth = containerWidth > 0
    ? computeTableCellWidth(containerWidth, colHeaders.length, chartRatio)
    : undefined

  return (
    <div ref={containerRef} data-map-grid-item className="flex items-start select-none">
      <div
        style={{ flexBasis: `${tablePercent}%`, minWidth: 0 }}
        className="overflow-hidden flex-shrink-0"
      >
        <HeatmapTable
          cells={cells}
          rowHeaders={rowHeaders}
          colHeaders={colHeaders}
          colorScale={colorScale}
          readOnly={readOnly}
          onCellChange={onCellChange}
          onBulkChange={onBulkChange}
          modifiedCells={modifiedCells}
          formatValue={formatValue}
          cellTitle={cellTitle}
          selection={selection}
          onSelectionChange={onSelectionChange}
          cellWidth={derivedCellWidth}
          focusToken={focusToken}
          onKeyDelegate={onKeyDelegate}
          keyHandlerRef={keyHandlerRef}
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onReset={onReset}
          resetDisabled={resetDisabled}
        />
      </div>

      <div
        className="w-3 self-stretch cursor-col-resize flex-shrink-0 flex items-center justify-center group"
        onMouseDown={handleDragStart}
      >
        <div className="w-px h-10 rounded-full bg-gray-600 group-hover:bg-blue-400 transition-colors" />
      </div>

      <div
        style={{ flexBasis: `${chartPercent}%`, minWidth: '280px' }}
        className="flex-shrink-0"
      >
        <MapChart
          data={cells as number[][]}
          rowLabels={rowHeaders}
          colLabels={colHeaders}
          selectedCells={selectedCells}
          height={chartHeight}
          onCellChange={onCellChange}
          onChartCellClick={handleChartCellClick}
        />
      </div>
    </div>
  )
}
