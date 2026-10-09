import { useRef, useState, useMemo } from 'react'
import { useTimeStore } from '@/store/timeStore'
import { useLogStore, selectActiveLogs, selectTotalDuration } from '@/store/logStore'
import { useDisplayRows, useDisplaySignals } from '@/hooks/useDisplayRows'
import { SIGNAL_MAP } from '@/signals/signalRegistry'
import { buildSparkline, type SparklineData } from '@/utils/sparkline'
import { findLastRow } from '@/utils/findLastRow'
import { dragSelection } from '@/utils/railDrag'
import type { TimeSelection } from '@/types/datalog'

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

const SPARK_W = 1000
const SPARK_H = 100
const SPARK_PAD = 10

function isNum(v: unknown): v is number {
  return typeof v === 'number' && !isNaN(v)
}

function sparkY(v: number, min: number, max: number): number {
  if (max === min) return SPARK_H / 2
  return SPARK_H - SPARK_PAD - ((v - min) / (max - min)) * (SPARK_H - 2 * SPARK_PAD)
}

function formatSignal(signal: string, v: number): string {
  const def = SIGNAL_MAP.get(signal)
  return def ? def.format(v) : v.toFixed(3)
}

// ─── SparklineSVG ─────────────────────────────────────────────────────────────

// viewBox fixo + preserveAspectRatio="none": o navegador escala, sem medir o contêiner.
function SparklineSVG({ data, total }: { data: SparklineData; total: number }) {
  if (data.segments.length === 0 || total === 0) return null
  const { min, max } = data

  let line = ''
  let area = ''
  for (const seg of data.segments) {
    const pts = seg.map(([t, v]) => [(t / total) * SPARK_W, sparkY(v, min, max)] as const)
    line += pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
    if (pts.length === 1) { line += 'h0'; continue }
    area += `M${pts[0][0].toFixed(1)},${SPARK_H}`
      + pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join('')
      + `L${pts[pts.length - 1][0].toFixed(1)},${SPARK_H}Z`
  }

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      preserveAspectRatio="none"
    >
      <path d={area} fill="rgba(96,165,250,0.18)" />
      <path
        d={line} fill="none" stroke="rgba(96,165,250,0.85)" strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

// ─── SparklineScale / SparklineDot ────────────────────────────────────────────

function SparklineScale({ data, signal }: { data: SparklineData; signal: string }) {
  if (data.segments.length === 0) return null
  return (
    <div className="absolute left-1 top-0 bottom-0 z-30 flex flex-col justify-between py-0.5 text-[10px] leading-none text-gray-400 font-mono pointer-events-none">
      <span>{formatSignal(signal, data.max)}</span>
      <span>{formatSignal(signal, data.min)}</span>
    </div>
  )
}

function SparklineDot({ data, cursor_ms, value, total }: {
  data: SparklineData; cursor_ms: number; value: number | null; total: number
}) {
  if (value === null || data.segments.length === 0) return null
  return (
    <div
      className="absolute z-30 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-400 ring-1 ring-gray-900 pointer-events-none"
      style={{ left: `${msToPct(cursor_ms, total)}%`, top: `${sparkY(value, data.min, data.max)}%` }}
    />
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
      className="absolute top-0 bottom-0 z-20 bg-blue-500/20 border-x border-blue-400/60 cursor-grab"
      style={{ left: `${l}%`, width: `${w}%` }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-2 -translate-x-full cursor-ew-resize bg-blue-400/40 hover:bg-blue-400/70 transition-colors" />
      <div className="absolute right-0 top-0 bottom-0 w-2 translate-x-full cursor-ew-resize bg-blue-400/40 hover:bg-blue-400/70 transition-colors" />
    </div>
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

function StatusBar({ cursor_ms, selection, onClear, sensor, sensorValue }: {
  cursor_ms: number | null
  selection: TimeSelection | null
  onClear: () => void
  sensor: string
  sensorValue: number | null
}) {
  return (
    <div className="flex items-center gap-4 px-3 pb-2 text-xs text-gray-400 font-mono">
      {cursor_ms !== null
        ? <span><span className="text-gray-500">Cursor:</span> <span className="text-red-400">{fmtTime(cursor_ms)}</span></span>
        : <span className="text-gray-600">Cursor: —</span>
      }
      {cursor_ms !== null && (
        <span>
          <span className="text-gray-500">{sensor}:</span>{' '}
          <span className="text-gray-200">{sensorValue !== null ? formatSignal(sensor, sensorValue) : '—'}</span>
        </span>
      )}
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
  | { type: 'handle'; side: 'left' | 'right' }
  | { type: 'move'; startMs: number; selStart: number; selEnd: number }

export function TimeRail() {
  const railRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState>({ type: 'idle' })
  // Seleção em arrasto: só a faixa da régua acompanha o mouse; o store (e com ele gráficos, tabela,
  // etc.) recebe a seleção uma única vez, ao soltar — recalcular tudo a cada movimento trava.
  const [draft, setDraft] = useState<TimeSelection | null>(null)

  const cursor_ms       = useTimeStore(s => s.cursor_ms)
  const selection       = useTimeStore(s => s.selection)
  const sparklineSensor = useTimeStore(s => s.sparklineSensor)
  const setCursor       = useTimeStore(s => s.setCursor)
  const setSelection    = useTimeStore(s => s.setSelection)
  const clearSelection  = useTimeStore(s => s.clearSelection)
  const setSensor       = useTimeStore(s => s.setSparklineSensor)

  const activeLogs    = useLogStore(selectActiveLogs)
  const total         = useLogStore(selectTotalDuration)
  const allRows       = useDisplayRows()
  const allSignals    = useDisplaySignals()
  const shownSelection = draft ?? selection

  const sparklineData = useMemo<SparklineData>(
    () => buildSparkline(allRows, sparklineSensor, total),
    [allRows, sparklineSensor, total],
  )

  const cursorValue = useMemo<number | null>(() => {
    if (cursor_ms === null) return null
    const v = findLastRow(allRows, cursor_ms)?.[sparklineSensor]
    return isNum(v) ? v : null
  }, [allRows, cursor_ms, sparklineSensor])

  function isHandleHit(clientX: number): 'left' | 'right' | null {
    if (!selection || total === 0) return null
    const rect = railRef.current!.getBoundingClientRect()
    const px = clientX - rect.left
    const startPx = (selection.start_ms / total) * rect.width
    const endPx   = (selection.end_ms   / total) * rect.width
    if (Math.abs(px - startPx) <= 8) return 'left'
    if (Math.abs(px - endPx)   <= 8) return 'right'
    return null
  }

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
    const handle = isHandleHit(e.clientX)
    if (handle) {
      setDrag({ type: 'handle', side: handle })
    } else if (isCursorHit(e.clientX)) {
      setDrag({ type: 'cursor' })
    } else if (isInsideSelection(e.clientX) && selection) {
      setDrag({ type: 'move', startMs: getRailMs(e.clientX),
                selStart: selection.start_ms, selEnd: selection.end_ms })
    } else {
      const ms = getRailMs(e.clientX)
      setDrag({ type: 'selection', startMs: ms })
      setCursor(ms)
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (drag.type === 'cursor') {
      setCursor(getRailMs(e.clientX))
    } else if (drag.type !== 'idle') {
      const next = dragSelection(drag, getRailMs(e.clientX), shownSelection, total)
      if (next) setDraft(next)
    }
  }

  /** Fim do arrasto: grava o rascunho da seleção, se houver, uma única vez. */
  function endDrag() {
    if (draft) setSelection(draft.start_ms, draft.end_ms)
    setDraft(null)
    setDrag({ type: 'idle' })
  }
  function handleMouseUp() { endDrag() }
  function handleMouseLeave() { if (drag.type !== 'idle') endDrag() }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (cursor_ms === null) return
    if (e.key === 'ArrowLeft') { e.preventDefault(); setCursor(Math.max(0, cursor_ms - (e.shiftKey ? 1000 : 100))) }
    if (e.key === 'ArrowRight') { e.preventDefault(); setCursor(Math.min(total, cursor_ms + (e.shiftKey ? 1000 : 100))) }
    if (e.key === 'Escape') { e.preventDefault(); setDraft(null); clearSelection() }
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
          className={`relative flex-1 h-12 rounded overflow-hidden bg-gray-800 ${drag.type === 'move' ? 'cursor-grabbing' : 'cursor-crosshair'}`}
          tabIndex={0}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onKeyDown={handleKeyDown}
        >
          <SparklineSVG data={sparklineData} total={total} />
          <SparklineScale data={sparklineData} signal={sparklineSensor} />
          {shownSelection && <ViewportBand zoom={shownSelection} total={total} />}
          {shownSelection && <SelectionBand selection={shownSelection} total={total} />}
          <LogSeparators logs={activeLogs} total={total} />
          {cursor_ms !== null && <CursorLine cursor_ms={cursor_ms} total={total} />}
          {cursor_ms !== null && (
            <SparklineDot data={sparklineData} cursor_ms={cursor_ms} value={cursorValue} total={total} />
          )}
        </div>
      </div>

      <StatusBar
        cursor_ms={cursor_ms} selection={shownSelection} onClear={clearSelection}
        sensor={sparklineSensor} sensorValue={cursorValue}
      />
    </div>
  )
}
