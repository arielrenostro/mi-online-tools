import { useState, useRef, useEffect } from 'react'
import BulkEditModal from '@/features/tuning/BulkEditModal'

export type ColorScale = 'warm' | 'diverging' | 'confidence' | 'coverage' | 'convergence'

interface HeatmapTableProps {
  cells:           (number | boolean | null)[][]
  rowHeaders:      number[]      // MAP breakpoints (kPa), cells[0] = lowest MAP
  colHeaders:      number[]      // RPM breakpoints
  colorScale?:     ColorScale
  readOnly?:       boolean
  onCellChange?:   (row: number, col: number, value: number) => void
  onBulkChange?:   (changes: { row: number; col: number; value: number }[]) => void
  modifiedCells?:  Set<string>   // "row:col"
  min?:            number
  max?:            number
  formatValue?:    (v: number | boolean | null) => string
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

type Pos = { r: number; c: number }

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
}: HeatmapTableProps) {
  const nRows = cells.length
  const nCols = colHeaders.length

  const [anchor,       setAnchor]       = useState<Pos | null>(null)
  const [selEnd,       setSelEnd]       = useState<Pos | null>(null)
  const [editing,      setEditing]      = useState<Pos | null>(null)
  const [editVal,      setEditVal]      = useState('')
  const [dragging,     setDragging]     = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)

  const wrapRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Highest MAP at top → reverse render order
  const rowOrder = [...rowHeaders.keys()].reverse()

  const allNums = cells.flat().filter((v): v is number => typeof v === 'number')
  const cMin    = min ?? (allNums.length ? Math.min(...allNums) : 0)
  const cMax    = max ?? (allNums.length ? Math.max(...allNums) : 1)

  // Selection rectangle (data space)
  const selR = selEnd ?? anchor
  const sr   = anchor && selR ? {
    r0: Math.min(anchor.r, selR.r), r1: Math.max(anchor.r, selR.r),
    c0: Math.min(anchor.c, selR.c), c1: Math.max(anchor.c, selR.c),
  } : null

  const inSel    = (r: number, c: number) => !!sr && r >= sr.r0 && r <= sr.r1 && c >= sr.c0 && c <= sr.c1
  const isAnchor = (r: number, c: number) => anchor?.r === r && anchor?.c === c

  // ── Position helpers ─────────────────────────────────────────────────────────

  function clamp(r: number, c: number): Pos {
    return { r: Math.max(0, Math.min(nRows - 1, r)), c: Math.max(0, Math.min(nCols - 1, c)) }
  }

  // dr/dc in DATA space: dr=-1 = lower MAP = visually DOWN; dr=+1 = visually UP
  function move(dr: number, dc: number, extend: boolean) {
    if (!anchor) return
    const base = extend ? (selEnd ?? anchor) : anchor
    const next = clamp(base.r + dr, base.c + dc)
    if (extend) { setSelEnd(next) } else { setAnchor(next); setSelEnd(null) }
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

  function handleBulkApply(type: 'pct' | 'fixed', value: number) {
    if (!sr || !onBulkChange) return
    const changes: { row: number; col: number; value: number }[] = []
    for (let r = sr.r0; r <= sr.r1; r++) {
      for (let c = sr.c0; c <= sr.c1; c++) {
        const cur = cells[r][c]
        if (typeof cur !== 'number') continue
        const newVal = type === 'fixed' ? value : cur * (1 + value / 100)
        changes.push({ row: r, col: c, value: newVal })
      }
    }
    onBulkChange(changes)
  }

  // ── Container keydown (no input focused) ─────────────────────────────────────

  function handleContainerKey(e: React.KeyboardEvent) {
    if (editing || bulkEditOpen) return
    if (!anchor) return

    const { key, shiftKey, ctrlKey, metaKey } = e
    const mod = ctrlKey || metaKey

    // Arrow navigation
    if (key === 'ArrowDown')  { e.preventDefault(); move(-1,  0, shiftKey); return }
    if (key === 'ArrowUp')    { e.preventDefault(); move( 1,  0, shiftKey); return }
    if (key === 'ArrowRight') { e.preventDefault(); move( 0,  1, shiftKey); return }
    if (key === 'ArrowLeft')  { e.preventDefault(); move( 0, -1, shiftKey); return }

    // Enter: inline edit (single cell) or navigate (range / shift)
    if (key === 'Enter') {
      e.preventDefault()
      if (!readOnly && !shiftKey && (!sr || (sr.r0 === sr.r1 && sr.c0 === sr.c1))) {
        startEdit(anchor.r, anchor.c)
      } else {
        shiftKey ? move(1, 0, false) : move(-1, 0, false)
      }
      return
    }

    // Tab
    if (key === 'Tab') {
      e.preventDefault()
      shiftKey ? move(0, -1, false) : move(0, 1, false)
      return
    }

    if (readOnly) return

    // F2: bulk edit modal
    if (key === 'F2') {
      e.preventDefault()
      if (anchor) setBulkEditOpen(true)
      return
    }

    // Delete / Backspace
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault()
      if (sr && (sr.r1 > sr.r0 || sr.c1 > sr.c0)) {
        const changes: { row: number; col: number; value: number }[] = []
        for (let r = sr.r0; r <= sr.r1; r++)
          for (let c = sr.c0; c <= sr.c1; c++)
            if (typeof cells[r][c] === 'number') changes.push({ row: r, col: c, value: 0 })
        if (changes.length) onBulkChange?.(changes)
      } else {
        startEdit(anchor.r, anchor.c, '')
      }
      return
    }

    // Ctrl+C — copy as TSV
    if (mod && key === 'c') {
      e.preventDefault()
      const range = sr ?? { r0: anchor.r, r1: anchor.r, c0: anchor.c, c1: anchor.c }
      const lines: string[] = []
      for (let r = range.r0; r <= range.r1; r++) {
        const cols: string[] = []
        for (let c = range.c0; c <= range.c1; c++) {
          const v = cells[r][c]
          cols.push(v === null ? '' : String(typeof v === 'number' ? v : (v ? 1 : 0)))
        }
        lines.push(cols.join('\t'))
      }
      navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
      return
    }

    // Ctrl+V — paste TSV
    if (mod && key === 'v') {
      e.preventDefault()
      navigator.clipboard.readText().then(text => {
        const rows = text.trim().split(/\r?\n/).map(row => row.split('\t'))
        const changes: { row: number; col: number; value: number }[] = []
        rows.forEach((row, dr) => {
          row.forEach((val, dc) => {
            const r = anchor.r + dr
            const c = anchor.c + dc
            if (r < nRows && c < nCols) {
              const num = parseFloat(val)
              if (!isNaN(num)) changes.push({ row: r, col: c, value: num })
            }
          })
        })
        if (changes.length) onBulkChange?.(changes)
      }).catch(() => {})
      return
    }

    // Printable digit — start inline edit
    if (key.length === 1 && !mod && /[\d.\-]/.test(key)) {
      e.preventDefault()
      startEdit(anchor.r, anchor.c, key)
    }
  }

  // ── Input keydown (during inline edit) ──────────────────────────────────────

  function handleInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!editing) return
    e.stopPropagation()
    const { key, shiftKey } = e

    if (key === 'Enter') {
      e.preventDefault()
      commitEdit(editing.r, editing.c)
      setAnchor(clamp(editing.r - 1, editing.c)); setSelEnd(null)
      return
    }
    if (key === 'Tab') {
      e.preventDefault()
      commitEdit(editing.r, editing.c)
      setAnchor(clamp(editing.r, editing.c + (shiftKey ? -1 : 1))); setSelEnd(null)
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
      setAnchor(clamp(editing.r - 1, editing.c)); setSelEnd(null)
      return
    }
    if (key === 'ArrowUp') {
      e.preventDefault()
      commitEdit(editing.r, editing.c)
      setAnchor(clamp(editing.r + 1, editing.c)); setSelEnd(null)
      return
    }
  }

  // ── Mouse handlers ───────────────────────────────────────────────────────────

  function handleCellDown(r: number, c: number, e: React.MouseEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    wrapRef.current?.focus()
    if (editing) commitEdit(editing.r, editing.c)
    if (e.shiftKey && anchor) { setSelEnd({ r, c }) }
    else { setAnchor({ r, c }); setSelEnd(null) }
    setDragging(true)
  }

  function handleCellEnter(r: number, c: number) {
    if (dragging) setSelEnd({ r, c })
  }

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!editing && !bulkEditOpen) setTimeout(() => wrapRef.current?.focus(), 0)
  }, [editing, bulkEditOpen])

  useEffect(() => {
    const up = () => setDragging(false)
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

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

  return (
    <>
      <div
        ref={wrapRef}
        tabIndex={0}
        className="overflow-auto rounded border border-gray-700 outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
        onKeyDown={handleContainerKey}
      >
        <table
          className="border-collapse text-xs font-mono"
          style={{ minWidth: 'max-content' }}
        >
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 bg-gray-800 border border-gray-700 p-1 text-gray-400 text-center whitespace-nowrap">
                MAP↓ / RPM→
              </th>
              {colHeaders.map(rpm => (
                <th
                  key={rpm}
                  className="sticky top-0 z-10 bg-gray-800 border border-gray-700 p-1 text-gray-300 text-center min-w-[52px]"
                >
                  {rpm}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowOrder.map(ri => (
              <tr key={ri}>
                <td className="sticky left-0 z-10 bg-gray-800 border border-gray-700 p-1 text-gray-300 font-bold text-center whitespace-nowrap">
                  {rowHeaders[ri]}
                </td>
                {cells[ri].map((val, ci) => {
                  const { bg, fg } = cellBg(val, colorScale, cMin, cMax)
                  const sel    = inSel(ri, ci)
                  const anch   = isAnchor(ri, ci)
                  const isEdit = editing?.r === ri && editing?.c === ci
                  const isMod  = modifiedCells?.has(`${ri}:${ci}`) ?? false

                  return (
                    <td
                      key={ci}
                      style={{
                        backgroundColor: sel ? 'rgba(59,130,246,0.40)' : bg,
                        color:           sel ? '#f3f4f6' : fg,
                        boxShadow:       anch && !isEdit ? 'inset 0 0 0 2px #60a5fa' : undefined,
                      }}
                      className={[
                        'border p-0 text-center cursor-default select-none',
                        isMod ? 'border-2 border-orange-400' : 'border-gray-700',
                      ].join(' ')}
                      onMouseDown={e => handleCellDown(ri, ci, e)}
                      onMouseEnter={() => handleCellEnter(ri, ci)}
                      onDoubleClick={() => startEdit(ri, ci)}
                    >
                      {isEdit ? (
                        <input
                          ref={inputRef}
                          type="number"
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => commitEdit(ri, ci)}
                          onKeyDown={handleInputKey}
                          className="w-[52px] text-center bg-gray-900 outline outline-2 outline-blue-400 text-gray-100 font-bold"
                        />
                      ) : (
                        <span className="block px-1 py-0.5 min-w-[52px]">{fmt(val)}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bulkEditOpen && (
        <BulkEditModal
          cellCount={bulkCellCount}
          onApply={(type, value) => {
            handleBulkApply(type, value)
            setBulkEditOpen(false)
          }}
          onClose={() => setBulkEditOpen(false)}
        />
      )}
    </>
  )
}
