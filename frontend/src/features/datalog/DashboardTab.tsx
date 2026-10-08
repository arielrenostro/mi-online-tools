import { useTimeStore } from '@/store/timeStore'
import { useDisplayRows, useDisplaySignals } from '@/hooks/useDisplayRows'
import { useCorrectionMask } from '@/hooks/useCorrectionMask'
import { useVisualFilterStore } from '@/store/visualFilterStore'
import { isVisualFilterActive } from '@/utils/visualFilter'
import { SIGNAL_MAP } from '@/signals/signalRegistry'
import type { DatalogRow } from '@/types/datalog'

function fmtTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const ms3 = Math.round(ms % 1000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms3).padStart(3, '0')}`
}

function findRowIndexAtCursor(rows: DatalogRow[], cursor_ms: number | null): number | null {
  if (cursor_ms === null || rows.length === 0) return null
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

export function DashboardTab() {
  const cursor_ms  = useTimeStore(s => s.cursor_ms)
  const allRows    = useDisplayRows()
  const allSignals = useDisplaySignals()
  const mask       = useCorrectionMask()
  const visualActive = useVisualFilterStore(s => isVisualFilterActive(s.filter))
  const rowIndex   = findRowIndexAtCursor(allRows, cursor_ms)
  const row        = rowIndex !== null ? allRows[rowIndex] : null
  const excluded   = rowIndex !== null && mask[rowIndex] === false

  if (!row) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-600 text-sm">
        Mova o cursor do TimeRail para inspecionar os valores
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="text-xs text-gray-500 mb-2 font-mono">t = {fmtTime(row.timestamp_ms)}</div>
      {excluded && (
        <p className="text-xs text-yellow-500 bg-yellow-950/40 border border-yellow-900 rounded px-3 py-2 mb-4 inline-block">
          {visualActive
            ? 'Este instante não passa no filtro visual atual'
            : 'Este instante não passa nos filtros de correção VE atuais'}
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {allSignals.map(name => {
          const def = SIGNAL_MAP.get(name)
          if (!def) return null
          const value = row[name]
          return (
            <div
              key={name}
              className={`bg-gray-800 rounded-lg p-4 border ${excluded ? 'border-yellow-700' : 'border-gray-700'}`}
            >
              <div className="text-xs text-gray-500 mb-1">{def.name}</div>
              <div className="text-2xl font-bold text-gray-100 font-mono tracking-tight">
                {typeof value === 'number' && !isNaN(value) ? def.format(value) : '—'}
              </div>
              {def.unit && <div className="text-xs text-gray-500 mt-1">{def.unit}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
