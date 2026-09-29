// Pure operations behind the map-editing shortcuts (F2 bulk edit, H/V interpolate, ±1%,
// Delete on a range, Ctrl+C/V). Kept free of React so they can be unit-tested and reused
// regardless of which table currently has keyboard focus.

export type Pos        = { r: number; c: number }
export type SelRect    = { r0: number; r1: number; c0: number; c1: number }
export type CellChange = { row: number; col: number; value: number }
export type Cells      = (number | boolean | null)[][]
export type Selection  = { anchor: Pos; selEnd: Pos | null } | null
export type BulkType   = 'pct' | 'add' | 'fixed'

export function selectionRect(sel: Selection): SelRect | null {
  if (!sel) return null
  const end = sel.selEnd ?? sel.anchor
  return {
    r0: Math.min(sel.anchor.r, end.r), r1: Math.max(sel.anchor.r, end.r),
    c0: Math.min(sel.anchor.c, end.c), c1: Math.max(sel.anchor.c, end.c),
  }
}

export function isSingleCell(sr: SelRect | null): boolean {
  return !sr || (sr.r0 === sr.r1 && sr.c0 === sr.c1)
}

// Ported from mi-dashboard-android's MapEditOps.interpolateHorizontal/Vertical:
// index-based positioning within the selection, independent per row/column, edges unchanged.
export function interpolateHorizontal(cells: Cells, sr: SelRect): CellChange[] {
  const steps = sr.c1 - sr.c0
  if (steps < 2) return []
  const changes: CellChange[] = []
  for (let r = sr.r0; r <= sr.r1; r++) {
    const left  = cells[r][sr.c0]
    const right = cells[r][sr.c1]
    if (typeof left !== 'number' || typeof right !== 'number') continue
    for (let c = sr.c0 + 1; c < sr.c1; c++) {
      const t = (c - sr.c0) / steps
      changes.push({ row: r, col: c, value: left + (right - left) * t })
    }
  }
  return changes
}

export function interpolateVertical(cells: Cells, sr: SelRect): CellChange[] {
  const steps = sr.r1 - sr.r0
  if (steps < 2) return []
  const changes: CellChange[] = []
  for (let c = sr.c0; c <= sr.c1; c++) {
    const top    = cells[sr.r0][c]
    const bottom = cells[sr.r1][c]
    if (typeof top !== 'number' || typeof bottom !== 'number') continue
    for (let r = sr.r0 + 1; r < sr.r1; r++) {
      const t = (r - sr.r0) / steps
      changes.push({ row: r, col: c, value: top + (bottom - top) * t })
    }
  }
  return changes
}

/** F2 dialog: fixed value, additive delta, or percentage of each cell's own value. */
export function bulkAdjustChanges(cells: Cells, sr: SelRect, type: BulkType, value: number): CellChange[] {
  const changes: CellChange[] = []
  for (let r = sr.r0; r <= sr.r1; r++) {
    for (let c = sr.c0; c <= sr.c1; c++) {
      const cur = cells[r][c]
      if (typeof cur !== 'number') continue
      const next = type === 'fixed' ? value
                 : type === 'add'   ? cur + value
                 : cur * (1 + value / 100)
      changes.push({ row: r, col: c, value: next })
    }
  }
  return changes
}

/** Ctrl+I / Ctrl+U: multiply every numeric cell in the range by `factor`. */
export function scaleChanges(cells: Cells, sr: SelRect, factor: number): CellChange[] {
  return bulkAdjustChanges(cells, sr, 'pct', (factor - 1) * 100)
}

/** Delete/Backspace over a range: every numeric cell goes to 0 (the store clamps to the minimum). */
export function clearRangeChanges(cells: Cells, sr: SelRect): CellChange[] {
  return bulkAdjustChanges(cells, sr, 'fixed', 0)
}

/** Ctrl+C: tab-separated rows in on-screen order. */
export function toTsv(cells: Cells, sr: SelRect): string {
  const lines: string[] = []
  for (let r = sr.r0; r <= sr.r1; r++) {
    const cols: string[] = []
    for (let c = sr.c0; c <= sr.c1; c++) {
      const v = cells[r][c]
      cols.push(v === null ? '' : String(typeof v === 'number' ? v : (v ? 1 : 0)))
    }
    lines.push(cols.join('\t'))
  }
  return lines.join('\n')
}

/** Ctrl+V: writes tab-separated values starting at `anchor`, clipped to the grid. */
export function pasteChanges(text: string, anchor: Pos, nRows: number, nCols: number): CellChange[] {
  const changes: CellChange[] = []
  text.trim().split(/\r?\n/).map(row => row.split('\t')).forEach((row, dr) => {
    row.forEach((val, dc) => {
      const r = anchor.r + dr
      const c = anchor.c + dc
      if (r >= nRows || c >= nCols) return
      const num = parseFloat(val)
      if (!isNaN(num)) changes.push({ row: r, col: c, value: num })
    })
  })
  return changes
}
