import { useRef } from 'react'
import { SyncedChart } from '@/components/SyncedChart'
import { useUIStore } from '@/store/uiStore'
import { useLogStore, selectAllRows, selectAllSignals } from '@/store/logStore'
import { useTimeStore } from '@/store/timeStore'
import { SIGNAL_MAP } from '@/signals/signalRegistry'
import type { DatalogRow } from '@/types/datalog'

function ResizeHandle({ height, onResize }: { height: number; onResize: (h: number) => void }) {
  const startRef = useRef<{ y: number; h: number } | null>(null)

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    startRef.current = { y: e.clientY, h: height }
    function onMove(ev: MouseEvent) {
      if (!startRef.current) return
      const newH = Math.max(200, Math.min(1200, startRef.current.h + ev.clientY - startRef.current.y))
      onResize(newH)
    }
    function onUp() {
      startRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className="flex-shrink-0 h-3 cursor-ns-resize flex items-center justify-center group hover:bg-gray-800/60"
      onMouseDown={onMouseDown}
    >
      <div className="w-10 h-0.5 rounded-full bg-gray-700 group-hover:bg-gray-400 transition-colors" />
    </div>
  )
}

function findLastRow(rows: DatalogRow[], t: number): DatalogRow | null {
  if (!rows.length || rows[0].timestamp_ms > t) return null
  let lo = 0, hi = rows.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (rows[mid].timestamp_ms <= t) lo = mid
    else hi = mid - 1
  }
  return rows[lo]
}

function SignalSidebar() {
  const open            = useUIStore(s => s.chartSidebarOpen)
  const setOpen         = useUIStore(s => s.setChartSidebarOpen)
  const allRows         = useLogStore(selectAllRows)
  const allSignals      = useLogStore(selectAllSignals)
  const cursor_ms       = useTimeStore(s => s.cursor_ms)

  const currentRow = cursor_ms !== null ? findLastRow(allRows, cursor_ms) : null

  if (!open) {
    return (
      <div className="flex-shrink-0 w-6 flex flex-col items-center border-l border-gray-800 bg-gray-950">
        <button
          onClick={() => setOpen(true)}
          title="Mostrar sinais"
          className="mt-2 text-gray-500 hover:text-gray-300 text-xs leading-none"
        >›</button>
      </div>
    )
  }

  return (
    <div className="flex-shrink-0 w-52 flex flex-col border-l border-gray-800 bg-gray-950 min-h-0">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-800 flex-shrink-0">
        <span className="text-xs text-gray-400 font-medium">Sinais</span>
        <button
          onClick={() => setOpen(false)}
          title="Ocultar sinais"
          className="text-gray-500 hover:text-gray-300 text-xs leading-none"
        >‹</button>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-gray-950">
            <tr>
              <th className="text-left px-2 py-1 text-gray-500 font-medium border-b border-gray-800">Nome</th>
              <th className="text-right px-2 py-1 text-gray-500 font-medium border-b border-gray-800">Valor</th>
            </tr>
          </thead>
          <tbody>
            {allSignals.map(sig => {
              const raw = currentRow?.[sig]
              const def = SIGNAL_MAP.get(sig)
              const display = typeof raw === 'number' && !isNaN(raw)
                ? (def ? def.format(raw) : raw.toFixed(3))
                : '—'
              return (
                <tr key={sig} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-2 py-0.5 text-gray-300 truncate max-w-0 w-1/2">{sig}</td>
                  <td className="px-2 py-0.5 text-gray-100 text-right tabular-nums">{display}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ChartsTab() {
  const chartsHeight    = useUIStore(s => s.chartsHeight)
  const setChartsHeight = useUIStore(s => s.setChartsHeight)

  return (
    <div className="flex flex-col" style={{ height: chartsHeight }}>
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 p-2">
          <SyncedChart />
        </div>
        <SignalSidebar />
      </div>
      <ResizeHandle height={chartsHeight} onResize={setChartsHeight} />
    </div>
  )
}
