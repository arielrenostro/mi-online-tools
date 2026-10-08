import { SyncedChart } from '@/components/SyncedChart'
import { useUIStore } from '@/store/uiStore'
import { useDisplayRows, useDisplaySignals } from '@/hooks/useDisplayRows'
import { useTimeStore } from '@/store/timeStore'
import { SIGNAL_MAP } from '@/signals/signalRegistry'
import { findLastRow } from '@/utils/findLastRow'

function SignalSidebar() {
  const open            = useUIStore(s => s.chartSidebarOpen)
  const setOpen         = useUIStore(s => s.setChartSidebarOpen)
  const allRows         = useDisplayRows()
  const allSignals      = useDisplaySignals()
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
  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-1 min-h-0">
        {/* A altura vem dos painéis (soma das linhas): rola na vertical, nunca na horizontal. */}
        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <SyncedChart />
        </div>
        <SignalSidebar />
      </div>
    </div>
  )
}
