import { useState, useMemo, useRef, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { build2DOptions } from './useMapChartOptions'
import { build3DOptions } from './mapChart3DOptions'

type Orientation = 'map_x_rpm' | 'rpm_x_map'
type Mode        = '2d' | '3d'

function useStickyState<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    const stored = localStorage.getItem(key) as T | null
    return stored ?? fallback
  })
  function setAndSave(v: T) {
    setVal(v)
    localStorage.setItem(key, v)
  }
  return [val, setAndSave]
}

interface MapChartProps {
  data:               number[][]
  rowLabels:          number[]
  colLabels:          number[]
  selectedCells?:     Set<string>
  height?:            number
  onCellChange?:      (row: number, col: number, value: number) => void
  onChartCellClick?:  (cells: Set<string>) => void
}

export default function MapChart({
  data,
  rowLabels,
  colLabels,
  selectedCells = new Set(),
  height = 340,
  onCellChange,
  onChartCellClick,
}: MapChartProps) {
  const [orientation, setOrientation] = useStickyState<Orientation>('miot:map-chart-orientation', 'map_x_rpm')
  const [mode,        setMode]        = useStickyState<Mode>('miot:map-chart-mode', '2d')

  const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const echartsRef         = useRef<any>(null)
  const chartContainerRef  = useRef<HTMLDivElement>(null)
  const orientRef          = useRef(orientation)
  const modeRef            = useRef(mode)
  const dragRef            = useRef<{ row: number; col: number } | null>(null)
  const boxStartRef        = useRef<{ x: number; y: number } | null>(null)
  const symbolHitRef       = useRef(false)
  const onCellChangeRef    = useRef(onCellChange)
  const onChartClickRef    = useRef(onChartCellClick)
  const dataRef            = useRef(data)
  const rowLabelsRef       = useRef(rowLabels)
  const colLabelsRef       = useRef(colLabels)

  orientRef.current        = orientation
  modeRef.current          = mode
  onCellChangeRef.current  = onCellChange
  onChartClickRef.current  = onChartCellClick
  dataRef.current          = data
  rowLabelsRef.current     = rowLabels
  colLabelsRef.current     = colLabels

  const { colorMin, colorMax } = useMemo(() => {
    const nums = data.flat().filter((v): v is number => typeof v === 'number')
    return nums.length
      ? { colorMin: Math.min(...nums), colorMax: Math.max(...nums) }
      : { colorMin: 0, colorMax: 1 }
  }, [data])

  const option = useMemo(() => {
    return mode === '2d'
      ? build2DOptions(data, rowLabels, colLabels, orientation, selectedCells)
      : build3DOptions(data, rowLabels, colLabels, orientation, colorMin, colorMax, selectedCells)
  }, [data, rowLabels, colLabels, orientation, colorMin, colorMax, selectedCells, mode])

  // Stable event handlers — created once, access dynamic values through refs
  const onEvents = useRef({
    click(params: any) {
      if (params.componentType !== 'series') return
      const { seriesIndex, dataIndex } = params
      const o   = orientRef.current
      const row = o === 'map_x_rpm' ? seriesIndex : dataIndex
      const col = o === 'map_x_rpm' ? dataIndex   : seriesIndex
      onChartClickRef.current?.(new Set([`${row}:${col}`]))
    },
    mousedown(params: any) {
      if (modeRef.current !== '2d') return
      if (params.componentType !== 'series') return
      symbolHitRef.current = true   // signal: symbol was clicked, not empty area
      boxStartRef.current  = null   // cancel any pending box select
      const { seriesIndex, dataIndex } = params
      const o   = orientRef.current
      const row = o === 'map_x_rpm' ? seriesIndex : dataIndex
      const col = o === 'map_x_rpm' ? dataIndex   : seriesIndex
      dragRef.current = { row, col }
    },
  }).current

  // Window mouse events — drag edit + box selection
  useEffect(() => {
    function onMove(e: MouseEvent) {
      // Drag edit existing point
      if (dragRef.current && echartsRef.current) {
        const inst = echartsRef.current.getEchartsInstance()
        const dom  = inst.getDom() as HTMLElement
        const rect = dom.getBoundingClientRect()
        const pixY = e.clientY - rect.top
        const pixX = rect.width / 2
        const result = inst.convertFromPixel({ gridIndex: 0 }, [pixX, pixY])
        if (result) {
          const newVal = Math.round(result[1])
          const { row, col } = dragRef.current
          onCellChangeRef.current?.(row, col, newVal)
        }
      }

      // Box selection — update visual rectangle
      if (boxStartRef.current && chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect()
        const cx   = Math.min(Math.max(0, e.clientX - rect.left), rect.width)
        const cy   = Math.min(Math.max(0, e.clientY - rect.top),  rect.height)
        const { x: sx, y: sy } = boxStartRef.current
        setSelBox({
          x: Math.min(sx, cx), y: Math.min(sy, cy),
          w: Math.abs(cx - sx), h: Math.abs(cy - sy),
        })
      }
    }

    function onUp(e: MouseEvent) {
      if (dragRef.current) { dragRef.current = null }

      if (boxStartRef.current && chartContainerRef.current && echartsRef.current) {
        const rect  = chartContainerRef.current.getBoundingClientRect()
        const curX  = e.clientX - rect.left
        const curY  = e.clientY - rect.top
        const { x: sx, y: sy } = boxStartRef.current
        const x1 = Math.min(sx, curX), x2 = Math.max(sx, curX)
        const y1 = Math.min(sy, curY), y2 = Math.max(sy, curY)

        boxStartRef.current = null
        setSelBox(null)

        if (x2 - x1 > 3 && y2 - y1 > 3) {
          const inst    = echartsRef.current.getEchartsInstance()
          const o       = orientRef.current
          const d       = dataRef.current
          const nSeries = (o === 'map_x_rpm' ? rowLabelsRef : colLabelsRef).current.length
          const nX      = (o === 'map_x_rpm' ? colLabelsRef : rowLabelsRef).current.length
          const sel     = new Set<string>()

          for (let si = 0; si < nSeries; si++) {
            for (let xi = 0; xi < nX; xi++) {
              const row = o === 'map_x_rpm' ? si : xi
              const col = o === 'map_x_rpm' ? xi : si
              const val = d[row]?.[col]
              if (typeof val !== 'number') continue
              const px = inst.convertToPixel({ gridIndex: 0 }, [xi, val])
              if (!Array.isArray(px)) continue
              const [pixX, pixY] = px as [number, number]
              if (pixX >= x1 && pixX <= x2 && pixY >= y1 && pixY <= y2)
                sel.add(`${row}:${col}`)
            }
          }

          if (sel.size > 0) onChartClickRef.current?.(sel)
        }
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [])

  function handleContainerMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (symbolHitRef.current) { symbolHitRef.current = false; return }
    if (modeRef.current !== '2d') return
    const rect = e.currentTarget.getBoundingClientRect()
    boxStartRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex text-xs rounded overflow-hidden border border-gray-700">
          {(['map_x_rpm', 'rpm_x_map'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setOrientation(opt)}
              className={`px-2 py-1 transition-colors ${orientation === opt
                ? 'bg-gray-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
            >
              {opt === 'map_x_rpm' ? 'MAP×RPM' : 'RPM×MAP'}
            </button>
          ))}
        </div>
        <div className="flex text-xs rounded overflow-hidden border border-gray-700">
          {(['2d', '3d'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setMode(opt)}
              className={`px-2 py-1 transition-colors ${mode === opt
                ? 'bg-gray-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
            >
              {opt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={chartContainerRef}
        className="relative"
        onMouseDown={handleContainerMouseDown}
      >
        <ReactECharts
          ref={echartsRef}
          option={option}
          style={{ height, width: '100%' }}
          notMerge={true}
          lazyUpdate={false}
          onEvents={onEvents}
        />
        {selBox && (
          <div
            style={{
              position:     'absolute',
              left:          selBox.x,
              top:           selBox.y,
              width:         selBox.w,
              height:        selBox.h,
              border:        '1px solid #60a5fa',
              background:    'rgba(59,130,246,0.12)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  )
}
