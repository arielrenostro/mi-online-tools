import { useRef, useEffect, useState, useMemo } from 'react'
import { useTimeStore } from '@/store/timeStore'
import { useLogStore, selectActiveLogs, selectTotalDuration, selectAllRows, selectAllSignals } from '@/store/logStore'
import type { DatalogRow, TimeSelection } from '@/types/datalog'

// ─── utils ───────────────────────────────────────────────────────────────────

function pxToMs(pxOffset: number, railWidth: number, total: number): number {
  if (railWidth === 0 || total === 0) return 0
  return Math.max(0, Math.min(total, (pxOffset / railWidth) * total))
}

function msToPct(ms: number, total: number): number {
  return total === 0 ? 0 : (ms / total) * 100
}

function fmtTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const ms3 = Math.round(ms % 1000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms3).padStart(3, '0')}`
}

function fmtDur(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m === 0) return `${s}s`
  if (s === 0) return `${m}min`
  return `${m}min ${s}s`
}

function getSignalValue(row: DatalogRow, signal: string): number {
  return row[signal] ?? 0
}

// ─── SparklineSVG ─────────────────────────────────────────────────────────────

function SparklineSVG({ data, total }: { data: [number, number][]; total: number }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dims, setDims] = useState({ w: 0, h: 48 })

  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    const obs = new ResizeObserver(e => setDims({ w: e[0].contentRect.width, h: e[0].contentRect.height }))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  if (data.length < 2 || dims.w === 0 || total === 0) return null

  const vals = data.map(([, v]) => v)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const range = maxV - minV || 1

  const pts = data.map(([t, v]) => {
    const x = (t / total) * dims.w
    const y = dims.h - ((v - minV) / range) * (dims.h * 0.8) - dims.h * 0.1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
      <polygon points={`0,${dims.h} ${pts} ${dims.w},${dims.h}`} fill="rgba(59,130,246,0.1)" />
      <polyline points={pts} fill="none" stroke="rgba(59,130,246,0.4)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// ─── CursorLine ──────────────────────────────────────────────────────────────

function CursorLine({ cursor_ms, total }: { cursor_ms: number; total: number }) {
  const pct = msToPct(cursor_ms, total)
  return (
    <div className="absolute top-0 bottom-0 z-30 pointer-events-none" style={{ left: `${pct}%` }}>
      <div className="absolute top-0 -translate-x-1/2 w-0 h-0"
        style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid #ef4444' }}
      />
      <div className="absolute top-1.5 bottom-0 -translate-x-px w-0.5 bg-red-500 opacity-90" />
    </div>
  )
}

// ─── SelectionBand ────────────────────────────────────────────────────────────

function SelectionBand({ selection, total }: { selection: TimeSelection; total: number }) {
  const l = msToPct(selection.start_ms, total)
  const w = msToPct(selection.end_ms, total) - l
  return (
    <div
      className="absolute top-0 bottom-0 z-20 bg-blue-500/20 border-x border-blue-400/60"
      style={{ left: `${l}%`, width: `${w}%` }}
    />
  )
}

// ─── ViewportBand ─────────────────────────────────────────────────────────────

function ViewportBand({ zoom, total }: { zoom: import('@/types/datalog').TimeSelection; total: number }) {
  const l = msToPct(zoom.start_ms, total)
  const r = msToPct(zoom.end_ms, total)
  return (
    <>
      <div className="absolute top-0 bottom-0 z-10 bg-gray-950/65 pointer-events-none" style={{ left: 0, width: `${l}%` }} />
      <div className="absolute top-0 bottom-0 z-10 bg-gray-950/65 pointer-events-none" style={{ left: `${r}%`, right: 0 }} />
      <div className="absolute top-0 bottom-0 z-11 border-x border-blue-400/50 pointer-events-none" style={{ left: `${l}%`, width: `${r - l}%` }} />
    </>
  )
}

// ─── LogSeparators ────────────────────────────────────────────────────────────

function LogSeparators({ logs, total }: { logs: { duration_ms: number }[]; total: number }) {
  let offset = 0
  return (
    <>
      {logs.slice(0, -1).map((log, i) => {
        offset += log.duration_ms
        const pct = msToPct(offset, total)
        return (
          <div
            key={i}
            className="absolute top-0 bottom-0 z-20 -translate-x-px border-l border-dashed border-gray-500/60 pointer-events-none"
            style={{ left: `${pct}%` }}
          />
        )
      })}
    </>
  )
}

// ─── StatusBar ────────────────────────────────────────────────────────────────

function StatusBar({ cursor_ms, selection, onClear }: {
  cursor_ms: number | null
  selection: TimeSelection | null
  onClear: () => void
}) {
  return (
    <div className="flex items-center gap-4 px-3 pb-2 text-xs text-gray-400 font-mono">
      {cursor_ms !== null
        ? <span><span className="text-gray-500">Cursor:</span> <span className="text-red-400">{fmtTime(cursor_ms)}</span></span>
        : <span className="text-gray-600">Cursor: —</span>
      }
      {selection ? (
        <>
          <span>
            <span className="text-gray-500">Seleção:</span>{' '}
            <span className="text-blue-400">{fmtTime(selection.start_ms)}</span>
            {' – '}
            <span className="text-blue-400">{fmtTime(selection.end_ms)}</span>
            {' '}
            <span className="text-gray-500">({fmtDur(selection.end_ms - selection.start_ms)})</span>
          </span>
          <button onClick={onClear} className="text-gray-500 hover:text-gray-200 underline underline-offset-2">
            Limpar
          </button>
        </>
      ) : (
        <span className="text-gray-600">Seleção: nenhuma</span>
      )}
    </div>
  )
}

// ─── TimeRail (main) ──────────────────────────────────────────────────────────

type DragState =
  | { type: 'idle' }
  | { type: 'cursor' }
  | { type: 'selection'; startMs: number }

export function TimeRail() {
  const railRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState>({ type: 'idle' })

  const cursor_ms       = useTimeStore(s => s.cursor_ms)
  const selection       = useTimeStore(s => s.selection)
  const chartZoom       = useTimeStore(s => s.chartZoom)
  const sparklineSensor = useTimeStore(s => s.sparklineSensor)
  const setCursor       = useTimeStore(s => s.setCursor)
  const setSelection    = useTimeStore(s => s.setSelection)
  const clearSelection  = useTimeStore(s => s.clearSelection)
  const setSensor       = useTimeStore(s => s.setSparklineSensor)

  const activeLogs    = useLogStore(selectActiveLogs)
  const total         = useLogStore(selectTotalDuration)
  const allRows       = useLogStore(selectAllRows)
  const allSignals    = useLogStore(selectAllSignals)

  const sparklineData = useMemo<[number, number][]>(() => {
    if (total === 0) return []
    const step = Math.max(1, Math.floor(allRows.length / 500))
    return allRows
      .filter((_, i) => i % step === 0)
      .map(row => [row.timestamp_ms, getSignalValue(row, sparklineSensor)])
  }, [allRows, sparklineSensor, total])

  function getRailMs(clientX: number): number {
    const rect = railRef.current!.getBoundingClientRect()
    return pxToMs(clientX - rect.left, rect.width, total)
  }

  function isCursorHit(clientX: number): boolean {
    if (cursor_ms === null || total === 0) return false
    const rect = railRef.current!.getBoundingClientRect()
    const cursorPx = (cursor_ms / total) * rect.width
    return Math.abs(clientX - rect.left - cursorPx) <= 8
  }

  function isInsideSelection(clientX: number): boolean {
    if (!selection || total === 0) return false
    const rect = railRef.current!.getBoundingClientRect()
    const startPx = (selection.start_ms / total) * rect.width
    const endPx   = (selection.end_ms / total) * rect.width
    const px = clientX - rect.left
    return px > startPx + 8 && px < endPx - 8
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    if (isCursorHit(e.clientX)) {
      setDrag({ type: 'cursor' })
    } else if (!isInsideSelection(e.clientX)) {
      const ms = getRailMs(e.clientX)
      setDrag({ type: 'selection', startMs: ms })
      setCursor(ms)
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (drag.type === 'cursor') {
      setCursor(getRailMs(e.clientX))
    } else if (drag.type === 'selection') {
      const cur = getRailMs(e.clientX)
      if (Math.abs(cur - drag.startMs) > 200) {
        setSelection(Math.min(drag.startMs, cur), Math.max(drag.startMs, cur))
      }
    }
  }

  function handleMouseUp() { setDrag({ type: 'idle' }) }
  function handleMouseLeave() { if (drag.type !== 'idle') setDrag({ type: 'idle' }) }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (cursor_ms === null) return
    if (e.key === 'ArrowLeft') { e.preventDefault(); setCursor(Math.max(0, cursor_ms - (e.shiftKey ? 1000 : 100))) }
    if (e.key === 'ArrowRight') { e.preventDefault(); setCursor(Math.min(total, cursor_ms + (e.shiftKey ? 1000 : 100))) }
    if (e.key === 'Escape') { e.preventDefault(); clearSelection() }
  }

  if (total === 0) return null

  return (
    <div className="bg-gray-900 border-b border-gray-700 select-none flex-shrink-0">
      <div className="flex items-stretch gap-2 px-3 pt-2 pb-1">
        {/* Signal selector */}
        <select
          value={sparklineSensor}
          onChange={e => setSensor(e.target.value)}
          className="flex-none w-28 bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-1.5 py-1 h-12"
        >
          {allSignals.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Rail */}
        <div
          ref={railRef}
          className="relative flex-1 h-12 rounded overflow-hidden cursor-crosshair bg-gray-800"
          tabIndex={0}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onKeyDown={handleKeyDown}
        >
          <SparklineSVG data={sparklineData} total={total} />
          {chartZoom && <ViewportBand zoom={chartZoom} total={total} />}
          {selection && <SelectionBand selection={selection} total={total} />}
          <LogSeparators logs={activeLogs} total={total} />
          {cursor_ms !== null && <CursorLine cursor_ms={cursor_ms} total={total} />}
        </div>
      </div>

      <StatusBar cursor_ms={cursor_ms} selection={selection} onClear={clearSelection} />
    </div>
  )
}
