import { useState } from 'react'
import { useMapStore } from '@/store/mapStore'
import HeatmapTable from '@/components/HeatmapTable'

export default function OriginalMapSection() {
  const [collapsed, setCollapsed] = useState(true)
  const originalMap = useMapStore(s => s.originalMap)

  if (!originalMap) return null

  return (
    <section className="px-5 pb-3">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 hover:text-gray-200 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-90'}`}
          fill="currentColor" viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
        Mapa Original
      </button>

      {!collapsed && (
        <HeatmapTable
          cells={originalMap.cells}
          rowHeaders={originalMap.mapBreakpoints}
          colHeaders={originalMap.rpmBreakpoints}
          colorScale="warm"
          readOnly
          formatValue={v => v === null ? '—' : String(v as number)}
        />
      )}
    </section>
  )
}
