import type { TimeSelection } from '@/types/datalog'

/** Menor seleção possível, e arrasto mínimo para criar uma (um arrasto menor só move o cursor). */
export const MIN_SELECTION_MS = 200

export type SelectionDrag =
  | { type: 'selection'; startMs: number }
  | { type: 'handle'; side: 'left' | 'right' }
  | { type: 'move'; startMs: number; selStart: number; selEnd: number }

/**
 * Seleção resultante de um arrasto na TimeRail quando o ponteiro está em `cur` (ms), ou `null` se o
 * arrasto ainda não define uma seleção. `base` é a seleção em vigor durante o arrasto (alças).
 * Pura: a TimeRail guarda o resultado como rascunho e só grava no store ao soltar o mouse.
 */
export function dragSelection(
  drag: SelectionDrag, cur: number, base: TimeSelection | null, total: number,
): TimeSelection | null {
  const make = (start: number, end: number): TimeSelection | null => {
    const s = Math.max(0, start), e = Math.max(0, end)
    return s < e ? { start_ms: s, end_ms: e } : null
  }
  switch (drag.type) {
    case 'selection':
      return Math.abs(cur - drag.startMs) > MIN_SELECTION_MS
        ? make(Math.min(drag.startMs, cur), Math.max(drag.startMs, cur))
        : null
    case 'handle':
      if (!base) return null
      return drag.side === 'left'
        ? make(Math.min(cur, base.end_ms - MIN_SELECTION_MS), base.end_ms)
        : make(base.start_ms, Math.max(cur, base.start_ms + MIN_SELECTION_MS))
    case 'move': {
      const width = drag.selEnd - drag.selStart
      const start = Math.max(0, Math.min(total - width, drag.selStart + (cur - drag.startMs)))
      return make(start, start + width)
    }
  }
}
