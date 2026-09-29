import { useState, useRef, useEffect } from 'react'
import BulkEditModal from '@/features/tuning/BulkEditModal'
import {
  selectionRect, isSingleCell, interpolateHorizontal, interpolateVertical, bulkAdjustChanges,
  scaleChanges, clearRangeChanges, toTsv, pasteChanges,
  type Pos, type Selection, type BulkType,
} from '@/utils/mapEditOps'
import { IconAdjust, IconInterpolateH, IconInterpolateV, IconUndo, IconRedo } from '@/components/MapEditIcons'

export type ColorScale = 'warm' | 'diverging' | 'confidence' | 'coverage' | 'convergence' | 'symmetric'

interface HeatmapTableProps {
  cells:               (number | boolean | null)[][]
  rowHeaders:          number[]      // MAP breakpoints (kPa), cells[0] = highest MAP (top row)
  colHeaders:          number[]      // RPM breakpoints
  colorScale?:         ColorScale
  readOnly?:           boolean
  onCellChange?:       (row: number, col: number, value: number) => void
  onBulkChange?:       (changes: { row: number; col: number; value: number }[]) => void
  modifiedCells?:      Set<string>   // "row:col"
  min?:                number
  max?:                number
  formatValue?:        (v: number | boolean | null) => string
  /**
   * Controlled selection. When provided (even as `null`), the table renders it and reports every
   * change through `onSelectionChange`, so several tables over the same grid can share one cursor.
   * When omitted, the table keeps its own selection.
   */
  selection?:          Selection
  onSelectionChange?:  (selection: Selection) => void
  cellWidth?:          number
  /** Bump to move keyboard focus to this table (e.g. after a selection made in its chart). */
  focusToken?:         number
  /** Read-only tables: receives keys the table does not handle itself (F2, H, V, Ctrl+…). */
  onKeyDelegate?:      (e: React.KeyboardEvent) => void
  /**
   * Editable tables: filled with a handler for the value-editing shortcuts, so another table of
   * the grid can drive this one. Inline-edit-starting keys (Enter, digits, Delete on one cell)
   * are ignored when delegated, since they would pull focus into this table.
   */
  keyHandlerRef?:      { current: ((e: React.KeyboardEvent) => void) | null }
  onUndo?:             () => void
  onRedo?:             () => void
  canUndo?:            boolean
  canRedo?:            boolean
  /** Native tooltip text for a cell, shown regardless of the active color scale. */
  cellTitle?:          (row: number, col: number) => string | undefined
  /** Renders a "Resetar" button in the same toolbar row as Undo/Redo/Ajuste/Interpolar. */
  onReset?:            () => void
  resetDisabled?:      boolean
}

// ── Color helpers ─────────────────────────────────────────────────────────────

type RGB = [number, number, number]

function lerp(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function multiStop(stops: RGB[], t: number): RGB {
  const clamped = Math.max(0, Math.min(1, t))
  const seg     = clamped * (stops.length - 1)
  const i       = Math.min(Math.floor(seg), stops.length - 2)
  return lerp(stops[i], stops[i + 1], seg - i)
}

const WARM_STOPS: RGB[]       = [[59,130,246],[34,197,94],[234,179,8],[239,68,68]]
const DIVERGING_NEG: RGB      = [59, 130, 246]
const DIVERGING_MID: RGB      = [255, 255, 255]
const DIVERGING_POS: RGB      = [239,  68,  68]
const CONFIDENCE_STOPS: RGB[] = [[239,68,68],[234,179,8],[34,197,94]]
const COVERAGE_STOPS: RGB[]   = [[31,41,55],[59,130,246]]

function rgb(c: RGB): string { return `rgb(${c[0]},${c[1]},${c[2]})` }
function brightness(c: RGB): number { return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 }

function cellBg(
  value: number | boolean | null,
  scale: ColorScale,
  min: number,
  max: number,
): { bg: string; fg: string } {
  const empty = { bg: 'rgb(31,41,55)', fg: '#9ca3af' }
  if (value === null) return empty

  if (scale === 'convergence') {
    if (typeof value === 'boolean')
      return { bg: value ? 'rgb(34,197,94)' : 'rgb(234,179,8)', fg: '#111' }
    return empty
  }

  if (typeof value !== 'number') return empty
  const range = max - min || 1

  let col: RGB
  if (scale === 'warm') {
    col = multiStop(WARM_STOPS, (value - min) / range)
  } else if (scale === 'symmetric') {
    // Both extremes render hot; only the midpoint (e.g. a neutral 1.00 factor) is cool.
    const mid       = (max + min) / 2
    const halfRange = Math.max(mid - min, max - mid) || 1
    col = multiStop(WARM_STOPS, Math.abs(value - mid) / halfRange)
  } else if (scale === 'diverging') {
    const mid = (max + min) / 2
    col = value <= mid
      ? lerp(DIVERGING_NEG, DIVERGING_MID, (value - min) / (mid - min || 1))
      : lerp(DIVERGING_MID, DIVERGING_POS, (value - mid) / (max - mid || 1))
  } else if (scale === 'confidence') {
    col = multiStop(CONFIDENCE_STOPS, (value - min) / range)
  } else {
    col = multiStop(COVERAGE_STOPS, Math.min(1, (value - min) / range))
  }

  return { bg: rgb(col), fg: brightness(col) > 128 ? '#111' : '#f3f4f6' }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HeatmapTable({
  cells,
  rowHeaders,
  colHeaders,
  colorScale = 'warm',
  readOnly   = true,
  onCellChange,
  onBulkChange,
  modifiedCells,
  min,
  max,
  formatValue,
  selection: controlledSelection,
  onSelectionChange,
  cellWidth,
  focusToken,
  onKeyDelegate,
  keyHandlerRef,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  cellTitle,
  onReset,
  resetDisabled,
}: HeatmapTableProps) {
  const cw      = cellWidth ?? 52
  const cellFs  = cw >= 48 ? 12 : cw >= 38 ? 11 : cw >= 30 ? 10 : 9
  const cellPad = cw >= 48 ? '2px 4px' : cw >= 38 ? '1px 3px' : cw >= 30 ? '0 2px' : '0 1px'
  const nRows = cells.length
  const nCols = colHeaders.length

  const [localSelection, setLocalSelection] = useState<Selection>(null)
  const [editing,      setEditing]      = useState<Pos | null>(null)
  const [editVal,      setEditVal]      = useState('')
  const [dragging,     setDragging]     = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const wrapRef       = useRef<HTMLDivElement>(null)
  const inputRef      = useRef<HTMLInputElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const allNums = cells.flat().filter((v): v is number => typeof v === 'number')
  const cMin    = min ?? (allNums.length ? Math.min(...allNums) : 0)
  const cMax    = max ?? (allNums.length ? Math.max(...allNums) : 1)

  // Selection: controlled by the parent when `selection` is passed, otherwise local.
  const selection = controlledSelection !== undefined ? controlledSelection : localSelection
  const anchor    = selection?.anchor ?? null
  const selEnd    = selection?.selEnd ?? null
  const sr        = selectionRect(selection)

  function setSelection(next: Selection) {
    if (controlledSelection === undefined) setLocalSelection(next)
    onSelectionChange?.(next)
  }

  const inSel    = (r: number, c: number) => !!sr && r >= sr.r0 && r <= sr.r1 && c >= sr.c0 && c <= sr.c1
  const isAnchor = (r: number, c: number) => anchor?.r === r && anchor?.c === c

  // ── Position helpers ─────────────────────────────────────────────────────────

  function clamp(r: number, c: number): Pos {
    return { r: Math.max(0, Math.min(nRows - 1, r)), c: Math.max(0, Math.min(nCols - 1, c)) }
  }

  // Data index now matches visual order 1:1 (row 0 = top = highest MAP), so
  // dr/dc map directly to screen direction: dr=+1 = visually DOWN.
  function move(dr: number, dc: number, extend: boolean) {
    if (!anchor) return
    const base = extend ? (selEnd ?? anchor) : anchor
    const next = clamp(base.r + dr, base.c + dc)
    setSelection(extend ? { anchor, selEnd: next } : { anchor: next, selEnd: null })
  }

  // ── Inline edit helpers ──────────────────────────────────────────────────────

  function startEdit(r: number, c: number, initial?: string) {
    if (readOnly) return
    const cur = cells[r][c]
    const val = initial !== undefined
      ? initial
      : (typeof cur === 'number' ? String(cur) : '')
    setEditing({ r, c })
    setEditVal(val)
    setTimeout(() => {
      const inp = inputRef.current
      if (!inp) return
      inp.focus()
      if (initial !== undefined) inp.setSelectionRange(val.length, val.length)
      else inp.select()
    }, 0)
  }

  function commitEdit(r: number, c: number) {
    const num = parseFloat(editVal)
    if (!isNaN(num)) onCellChange?.(r, c, num)
    setEditing(null)
  }

  function cancelEdit() { setEditing(null) }

  // ── Bulk edit (F2 modal) ─────────────────────────────────────────────────────

  function openBulkEdit() {
    if (!anchor) return
    returnFocusRef.current = document.activeElement as HTMLElement | null
    setBulkEditOpen(true)
  }

  function handleBulkApply(type: BulkType, value: number) {
    if (!sr || !onBulkChange) return
    onBulkChange(bulkAdjustChanges(cells, sr, type, value))
  }

  const canInterpolateH = !!sr && (sr.c1 - sr.c0) >= 2
  const canInterpolateV = !!sr && (sr.r1 - sr.r0) >= 2

  function runInterpolateH() {
    if (!sr || !onBulkChange) return
    const changes = interpolateHorizontal(cells, sr)
    if (changes.length) onBulkChange(changes)
  }

  function runInterpolateV() {
    if (!sr || !onBulkChange) return
    const changes = interpolateVertical(cells, sr)
    if (changes.length) onBulkChange(changes)
  }

  // ── Value-editing shortcuts ──────────────────────────────────────────────────
  // Runs on the editable table, either because it has focus or because a read-only table of the
  // same grid delegated the key (`delegated`). Returns true when the key was handled.

  function handleEditKey(e: React.KeyboardEvent, delegated: boolean): boolean {
    if (!anchor || !onBulkChange) return false
    const { key } = e
    const mod = e.ctrlKey || e.metaKey
    const range = sr ?? { r0: anchor.r, r1: anchor.r, c0: anchor.c, c1: anchor.c }
    const apply = (changes: { row: number; col: number; value: number }[]) => {
      if (changes.length) onBulkChange(changes)
    }

    if (key === 'F2') { e.preventDefault(); openBulkEdit(); return true }

    if (!mod && key.toLowerCase() === 'h') { e.preventDefault(); runInterpolateH(); return true }
    if (!mod && key.toLowerCase() === 'v') { e.preventDefault(); runInterpolateV(); return true }

    if (key === 'Delete' || key === 'Backspace') {
      if (isSingleCell(sr)) {
        if (delegated) return false
        e.preventDefault()
        startEdit(anchor.r, anchor.c, '')
      } else {
        e.preventDefault()
        apply(clearRangeChanges(cells, range))
      }
      return true
    }

    if (mod && key === 'c') {
      e.preventDefault()
      navigator.clipboard.writeText(toTsv(cells, range)).catch(() => {})
      return true
    }
    if (mod && key === 'v') {
      e.preventDefault()
      navigator.clipboard.readText()
        .then(text => apply(pasteChanges(text, anchor, nRows, nCols)))
        .catch(() => {})
      return true
    }
    if (mod && key === 'i') { e.preventDefault(); apply(scaleChanges(cells, range, 1.01)); return true }
    if (mod && key === 'u') { e.preventDefault(); apply(scaleChanges(cells, range, 0.99)); return true }

    if (!delegated && key.length === 1 && !mod && /[\d.\-]/.test(key)) {
      e.preventDefault()
      startEdit(anchor.r, anchor.c, key)
      return true
    }
    return false
  }

  useEffect(() => {
    if (!keyHandlerRef) return
    if (readOnly || editing || bulkEditOpen) { keyHandlerRef.current = null; return }
    keyHandlerRef.current = e => { handleEditKey(e, true) }
    return () => { keyHandlerRef.current = null }
  })

  // ── Container keydown (no input focused) ─────────────────────────────────────

  function handleContainerKey(e: React.KeyboardEvent) {
    if (editing || bulkEditOpen) return

    const { key, shiftKey } = e

    if (key === 'Escape') { setSelection(null); return }
    if (!anchor) return

    // Arrow navigation
    if (key === 'ArrowDown')  { e.preventDefault(); move( 1,  0, shiftKey); return }
    if (key === 'ArrowUp')    { e.preventDefault(); move(-1,  0, shiftKey); return }
    if (key === 'ArrowRight') { e.preventDefault(); move( 0,  1, shiftKey); return }
    if (key === 'ArrowLeft')  { e.preventDefault(); move( 0, -1, shiftKey); return }

    // Enter: inline edit (single cell) or navigate (range / shift)
    if (key === 'Enter') {
      e.preventDefault()
      if (!readOnly && !shiftKey && isSingleCell(sr)) {
        startEdit(anchor.r, anchor.c)
      } else {
        shiftKey ? move(-1, 0, false) : move(1, 0, false)
      }
      return
    }

    // Tab
    if (key === 'Tab') {
      e.preventDefault()
      shiftKey ? move(0, -1, false) : move(0, 1, false)
      return
    }

    if (readOnly) { onKeyDelegate?.(e); return }

    handleEditKey(e, false)
  }

  // ── Input keydown (during inline edit) ──────────────────────────────────────

  function handleInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!editing) return
    e.stopPropagation()
    const { key, shiftKey } = e

    if (key === 'Enter') {
      e.preventDefault()
      commitEdit(editing.r, editing.c)
      setSelection({ anchor: clamp(editing.r + 1, editing.c), selEnd: null })
      return
    }
    if (key === 'Tab') {
      e.preventDefault()
      commitEdit(editing.r, editing.c)
      setSelection({ anchor: clamp(editing.r, editing.c + (shiftKey ? -1 : 1)), selEnd: null })
      return
    }
    if (key === 'Escape') {
      e.preventDefault()
      cancelEdit()
      return
    }
    if (key === 'ArrowDown') {
      e.preventDefault()
      commitEdit(editing.r, editing.c)
      setSelection({ anchor: clamp(editing.r + 1, editing.c), selEnd: null })
      return
    }
    if (key === 'ArrowUp') {
      e.preventDefault()
      commitEdit(editing.r, editing.c)
      setSelection({ anchor: clamp(editing.r - 1, editing.c), selEnd: null })
      return
    }
  }

  // ── Mouse handlers ───────────────────────────────────────────────────────────

  function handleCellDown(r: number, c: number, e: React.MouseEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    wrapRef.current?.focus()
    if (editing) commitEdit(editing.r, editing.c)
    if (e.shiftKey && anchor) { setSelection({ anchor, selEnd: { r, c } }) }
    else { setSelection({ anchor: { r, c }, selEnd: null }) }
    setDragging(true)
  }

  function handleCellEnter(r: number, c: number) {
    if (dragging && anchor) setSelection({ anchor, selEnd: { r, c } })
  }

  // ── Effects ──────────────────────────────────────────────────────────────────

  // After an inline edit or the bulk dialog closes, give focus back to where it was (the table
  // that had it when the dialog was opened) without scrolling the page.
  useEffect(() => {
    if (readOnly || editing || bulkEditOpen) return
    const target = returnFocusRef.current ?? wrapRef.current
    returnFocusRef.current = null
    setTimeout(() => { if (target?.isConnected) target.focus({ preventScroll: true }) }, 0)
  }, [editing, bulkEditOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!readOnly && nRows > 0 && nCols > 0 && !selection) setSelection({ anchor: { r: 0, c: 0 }, selEnd: null })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const up = () => setDragging(false)
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  useEffect(() => {
    if (focusToken) wrapRef.current?.focus({ preventScroll: true })
  }, [focusToken])

  // ── Format ───────────────────────────────────────────────────────────────────

  const fmt = formatValue ?? ((v: number | boolean | null) => {
    if (v === null) return '—'
    if (typeof v === 'boolean') return v ? '✓' : '!'
    return String(Math.round(v as number))
  })

  // ── Bulk edit cell count ─────────────────────────────────────────────────────

  const bulkCellCount = sr
    ? (sr.r1 - sr.r0 + 1) * (sr.c1 - sr.c0 + 1)
    : 1

  // ── Render ───────────────────────────────────────────────────────────────────

  const toolbarButtonClass = 'p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-800 disabled:hover:text-gray-400'

  // A toolbar button click must never blur the table: mousedown's default focus
  // transfer is prevented, and (belt-and-suspenders for the F2 dialog opening,
  // which does intentionally move focus) the blur handler below only clears the
  // selection when focus leaves this whole container, not the table div itself.
  const preventFocusSteal = (e: React.MouseEvent) => e.preventDefault()

  return (
    <div ref={containerRef} data-map-grid-item>
      {!readOnly && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <button
            type="button"
            onClick={openBulkEdit}
            onMouseDown={preventFocusSteal}
            disabled={!anchor}
            title="Ajuste (F2)"
            className={toolbarButtonClass}
          >
            <IconAdjust />
          </button>
          <button
            type="button"
            onClick={runInterpolateH}
            onMouseDown={preventFocusSteal}
            disabled={!canInterpolateH}
            title="Interpolar horizontal (H)"
            className={toolbarButtonClass}
          >
            <IconInterpolateH />
          </button>
          <button
            type="button"
            onClick={runInterpolateV}
            onMouseDown={preventFocusSteal}
            disabled={!canInterpolateV}
            title="Interpolar vertical (V)"
            className={toolbarButtonClass}
          >
            <IconInterpolateV />
          </button>
          <button
            type="button"
            onClick={onUndo}
            onMouseDown={preventFocusSteal}
            disabled={!onUndo || !canUndo}
            title="Desfazer (Ctrl+Z)"
            className={toolbarButtonClass}
          >
            <IconUndo />
          </button>
          <button
            type="button"
            onClick={onRedo}
            onMouseDown={preventFocusSteal}
            disabled={!onRedo || !canRedo}
            title="Refazer (Ctrl+Y)"
            className={toolbarButtonClass}
          >
            <IconRedo />
          </button>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              onMouseDown={preventFocusSteal}
              disabled={resetDisabled}
              className="ml-auto px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Resetar
            </button>
          )}
        </div>
      )}
      <div
        ref={wrapRef}
        tabIndex={0}
        className={`${cellWidth != null ? 'overflow-x-auto overflow-y-hidden' : 'overflow-auto'} rounded border border-gray-700 outline-none focus-visible:ring-1 focus-visible:ring-blue-500`}
        onKeyDown={handleContainerKey}
      >
        <table
          className="border-collapse font-mono"
          style={{ minWidth: 'max-content', fontSize: cellFs }}
        >
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 bg-gray-800 border border-gray-700 p-1 text-gray-400 text-center whitespace-nowrap">
                MAP↓ / RPM→
              </th>
              {colHeaders.map(rpm => (
                <th
                  key={rpm}
                  className="sticky top-0 z-10 bg-gray-800 border border-gray-700 text-gray-300 text-center"
                  style={{ minWidth: cw, padding: cellPad }}
                >
                  {rpm}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cells.map((_, ri) => (
              <tr key={ri}>
                <td className="sticky left-0 z-10 bg-gray-800 border border-gray-700 p-1 text-gray-300 font-bold text-center whitespace-nowrap">
                  {rowHeaders[ri]}
                </td>
                {cells[ri].map((val, ci) => {
                  const { bg, fg } = cellBg(val, colorScale, cMin, cMax)
                  const sel           = inSel(ri, ci)
                  const anch          = isAnchor(ri, ci)
                  const isEdit        = editing?.r === ri && editing?.c === ci
                  const isMod = modifiedCells?.has(`${ri}:${ci}`) ?? false

                  return (
                    <td
                      key={ci}
                      style={{
                        backgroundColor: sel ? 'rgba(59,130,246,0.40)' : bg,
                        color:           sel ? '#f3f4f6' : fg,
                        boxShadow: anch && !isEdit ? 'inset 0 0 0 2px #60a5fa' : undefined,
                      }}
                      className={[
                        'border p-0 text-center cursor-default select-none',
                        isMod ? 'border-2 border-orange-400' : 'border-gray-700',
                      ].join(' ')}
                      onMouseDown={e => handleCellDown(ri, ci, e)}
                      onMouseEnter={() => handleCellEnter(ri, ci)}
                      onDoubleClick={() => startEdit(ri, ci)}
                      title={cellTitle?.(ri, ci)}
                    >
                      {isEdit ? (
                        <input
                          ref={inputRef}
                          type="number"
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => commitEdit(ri, ci)}
                          onKeyDown={handleInputKey}
                          className="text-center bg-gray-900 outline outline-2 outline-blue-400 text-gray-100 font-bold"
                          style={{ width: cw }}
                        />
                      ) : (
                        <span style={{ display: 'block', minWidth: cw, padding: cellPad }}>{fmt(val)}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {bulkEditOpen && (
          <BulkEditModal
            cellCount={bulkCellCount}
            onApply={(type, value) => {
              handleBulkApply(type, value)
              setBulkEditOpen(false)
            }}
            onClose={() => setBulkEditOpen(false)}
            canInterpolateH={canInterpolateH}
            canInterpolateV={canInterpolateV}
            onInterpolate={direction => {
              direction === 'h' ? runInterpolateH() : runInterpolateV()
              setBulkEditOpen(false)
            }}
          />
        )}
      </div>
    </div>
  )
}
