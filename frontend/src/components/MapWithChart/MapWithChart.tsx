import { useState, useRef, useCallback, useEffect } from 'react'
import HeatmapTable, { type ColorScale } from '@/components/HeatmapTable'
import MapChart from '@/components/MapChart'
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
  chartHeight?:   number
  onUndo?:        () => void
  onRedo?:        () => void
  canUndo?:       boolean
  canRedo?:       boolean
  onReset?:       () => void
  resetDisabled?: boolean
}

type Pos = { r: number; c: number }

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
  chartHeight,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onReset,
  resetDisabled,
}: MapWithChartProps) {
  const [selectedCells,    setSelectedCells]    = useState<Set<string>>(new Set())
  const [externalSelection, setExternalSelection] = useState<{ anchor: Pos; selEnd: Pos } | null>(null)
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

  const handleSelectionChange = useCallback((anchor: Pos | null, selEnd: Pos | null) => {
    if (!anchor) { setSelectedCells(new Set()); return }
    const end = selEnd ?? anchor
    const r0  = Math.min(anchor.r, end.r), r1 = Math.max(anchor.r, end.r)
    const c0  = Math.min(anchor.c, end.c), c1 = Math.max(anchor.c, end.c)
    const next = new Set<string>()
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        next.add(`${r}:${c}`)
    setSelectedCells(next)
  }, [])

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
    setExternalSelection({ anchor: { r: minR, c: minC }, selEnd: { r: maxR, c: maxC } })
  }, [])

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
    <div ref={containerRef} className="flex items-start select-none">
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
          onSelectionChange={handleSelectionChange}
          cellWidth={derivedCellWidth}
          externalSelection={externalSelection}
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
