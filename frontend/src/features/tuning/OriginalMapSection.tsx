import { useState } from 'react'
import MapWithChart from '@/components/MapWithChart'

interface Props {
  cells:          number[][]
  rpmBreakpoints: number[]
  mapBreakpoints: number[]
  formatValue?:   (v: number | boolean | null) => string
}

export default function OriginalMapSection({ cells, rpmBreakpoints, mapBreakpoints, formatValue }: Props) {
  const [collapsed, setCollapsed] = useState(true)

  const fmt = formatValue ?? (v => v === null ? '—' : String(v as number))

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
        <MapWithChart
          cells={cells}
          rowHeaders={mapBreakpoints}
          colHeaders={rpmBreakpoints}
          colorScale="warm"
          readOnly
          formatValue={fmt}
        />
      )}
    </section>
  )
}
