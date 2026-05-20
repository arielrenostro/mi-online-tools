import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useTimeStore } from '@/store/timeStore'
import { useUIStore } from '@/store/uiStore'
import { useLogStore, selectAllRows } from '@/store/logStore'
import { SIGNAL_DEFS } from '@/signals/signalRegistry'
import type { DatalogRow, TimeSelection } from '@/types/datalog'

// ─── Column definitions ───────────────────────────────────────────────────────

interface ColDef {
  id:             string
  label:          string
  width:          number
  defaultVisible: boolean
  format:         (r: DatalogRow) => string
}

function fmtTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const ms3 = Math.round(ms % 1000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms3).padStart(3, '0')}`
}

// Coluna estrutural de tempo (não é um sinal)
const TEMPO_COL: ColDef = {
  id: 'Tempo', label: 'Tempo', width: 100, defaultVisible: true,
  format: r => fmtTime(r.timestamp_ms),
}

// Colunas de sinais derivadas do registry
const SIGNAL_COLS: ColDef[] = SIGNAL_DEFS.map(sig => ({
  id:             sig.name,
  label:          sig.name,
  width:          sig.tableWidth,
  defaultVisible: sig.defaultVisible,
  format:         (r: DatalogRow) => {
    const v = r[sig.name]
    return typeof v === 'number' && !isNaN(v) ? sig.format(v) : '—'
  },
}))

const ALL_COLS: ColDef[] = [TEMPO_COL, ...SIGNAL_COLS]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterRows(rows: DatalogRow[], selection: TimeSelection | null): DatalogRow[] {
  if (!selection) return rows
  return rows.filter(r => r.timestamp_ms >= selection.start_ms && r.timestamp_ms <= selection.end_ms)
}

function findCursorIndex(rows: DatalogRow[], cursor_ms: number | null): number {
  if (cursor_ms === null || rows.length === 0) return -1
  let lo = 0, hi = rows.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (rows[mid].timestamp_ms < cursor_ms) lo = mid + 1
    else hi = mid
  }
  if (lo === 0) return 0
  const a = rows[lo - 1], b = rows[lo]
  return Math.abs(a.timestamp_ms - cursor_ms) <= Math.abs(b.timestamp_ms - cursor_ms) ? lo - 1 : lo
}

function fmtSelectionTime(ms: number): string {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function exportCsv(rows: DatalogRow[], cols: ColDef[], filename: string) {
  const header = cols.map(c => c.label).join(';')
  const lines = rows.map(r => cols.map(c => c.format(r)).join(';'))
  const csv = [header, ...lines].join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Column Visibility Dropdown ───────────────────────────────────────────────

function ColsDropdown({ visibility, onChange }: {
  visibility: Record<string, boolean>
  onChange:   (id: string, visible: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="px-3 py-1 text-xs border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 rounded"
      >
        Colunas ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-gray-800 border border-gray-700 rounded shadow-xl w-44 py-1 max-h-72 overflow-y-auto">
          {ALL_COLS.map(col => {
            const checked = visibility[col.id] ?? col.defaultVisible
            return (
              <label key={col.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-700">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => onChange(col.id, e.target.checked)}
                  className="accent-blue-500"
                />
                <span className="text-xs text-gray-300">{col.label}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Virtual Table ────────────────────────────────────────────────────────────

const ROW_H  = 28
const BUFFER = 8

function VirtualTable({ rows, cols, cursorIndex, onRowClick }: {
  rows:        DatalogRow[]
  cols:        ColDef[]
  cursorIndex: number
  onRowClick:  (row: DatalogRow) => void
}) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop]     = useState(0)
  const [containerH, setContainerH]   = useState(400)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(e => setContainerH(e[0].contentRect.height))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Auto-scroll cursor row into view
  useEffect(() => {
    if (cursorIndex < 0 || !containerRef.current) return
    const el = containerRef.current
    const rowTop    = cursorIndex * ROW_H
    const rowBottom = rowTop + ROW_H
    if (rowTop < el.scrollTop || rowBottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = rowTop - el.clientHeight / 2 + ROW_H / 2
    }
  }, [cursorIndex])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop)
  }, [])

  const startIdx   = Math.max(0, Math.floor(scrollTop / ROW_H) - BUFFER)
  const endIdx     = Math.min(rows.length, Math.ceil((scrollTop + containerH) / ROW_H) + BUFFER)
  const visibleRows = rows.slice(startIdx, endIdx)
  const totalWidth = cols.reduce((s, c) => s + c.width, 0) + 24 // 24 for cursor indicator

  return (
    <div ref={containerRef} className="flex-1 overflow-auto min-h-0" onScroll={handleScroll}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex bg-gray-900 border-b border-gray-700 text-xs text-gray-500 font-medium"
        style={{ minWidth: totalWidth }}
      >
        <div className="w-6 flex-shrink-0" />
        {cols.map(col => (
          <div key={col.id} style={{ width: col.width, flexShrink: 0 }} className="px-2 py-1.5 truncate">
            {col.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ height: rows.length * ROW_H, position: 'relative', minWidth: totalWidth }}>
        {visibleRows.map((row, i) => {
          const absIdx   = startIdx + i
          const isCursor = absIdx === cursorIndex
          return (
            <div
              key={row.timestamp_ms}
              style={{ position: 'absolute', top: absIdx * ROW_H, height: ROW_H, width: '100%' }}
              className={`flex items-center cursor-pointer select-none text-xs font-mono
                ${isCursor ? 'bg-blue-900/30 text-gray-100' : 'text-gray-400 hover:bg-gray-800'}`}
              onClick={() => onRowClick(row)}
            >
              <div className="w-6 flex-shrink-0 text-center text-blue-400">
                {isCursor ? '▶' : ''}
              </div>
              {cols.map(col => (
                <div key={col.id} style={{ width: col.width, flexShrink: 0 }} className="px-2 truncate">
                  {col.format(row)}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── DataTab ──────────────────────────────────────────────────────────────────

export function DataTab() {
  const cursor_ms        = useTimeStore(s => s.cursor_ms)
  const setCursor        = useTimeStore(s => s.setCursor)
  const selection        = useTimeStore(s => s.selection)
  const columnVisibility = useUIStore(s => s.columnVisibility)
  const setColVisibility = useUIStore(s => s.setColumnVisibility)
  const allRows          = useLogStore(selectAllRows)

  const displayRows = useMemo(() => filterRows(allRows, selection), [allRows, selection])
  const cursorIndex = useMemo(() => findCursorIndex(displayRows, cursor_ms), [displayRows, cursor_ms])

  const visibleCols = useMemo(
    () => ALL_COLS.filter(c => columnVisibility[c.id] ?? c.defaultVisible),
    [columnVisibility],
  )

  const onRowClick = useCallback((row: DatalogRow) => {
    setCursor(row.timestamp_ms)
  }, [setCursor])

  const onExport = useCallback(() => {
    exportCsv(displayRows, visibleCols, 'datalog.csv')
  }, [displayRows, visibleCols])

  const rowCountLabel = selection
    ? `Exibindo ${displayRows.length.toLocaleString()} linhas (seleção: ${fmtSelectionTime(selection.start_ms)} – ${fmtSelectionTime(selection.end_ms)})`
    : `Exibindo ${displayRows.length.toLocaleString()} linhas (todos os logs)`

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-800 flex-shrink-0">
        <span className="text-xs text-gray-500 flex-1">{rowCountLabel}</span>
        <ColsDropdown visibility={columnVisibility} onChange={setColVisibility} />
        <button
          onClick={onExport}
          className="px-3 py-1 text-xs border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 rounded"
        >
          Exportar CSV
        </button>
      </div>

      {displayRows.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-gray-600 text-sm">
          Nenhuma linha no intervalo selecionado
        </div>
      ) : (
        <VirtualTable
          rows={displayRows}
          cols={visibleCols}
          cursorIndex={cursorIndex}
          onRowClick={onRowClick}
        />
      )}
    </div>
  )
}
