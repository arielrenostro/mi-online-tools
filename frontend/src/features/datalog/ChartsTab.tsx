import { useRef } from 'react'
import { SyncedChart } from '@/components/SyncedChart'
import { useUIStore } from '@/store/uiStore'

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

export function ChartsTab() {
  const chartsHeight    = useUIStore(s => s.chartsHeight)
  const setChartsHeight = useUIStore(s => s.setChartsHeight)

  return (
    <div className="flex flex-col" style={{ height: chartsHeight }}>
      <div className="flex-1 min-h-0 p-2">
        <SyncedChart />
      </div>
      <ResizeHandle height={chartsHeight} onResize={setChartsHeight} />
    </div>
  )
}
