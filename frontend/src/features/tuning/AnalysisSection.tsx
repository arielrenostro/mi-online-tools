import { useState } from 'react'
import { useMapStore } from '@/store/mapStore'
import HeatmapTable from '@/components/HeatmapTable'
import type { ColorScale } from '@/components/HeatmapTable'
import type { TuningOutput } from '@/types/tuning'

type TabKey = 've_lambda' | 'samples' | 'confidence' | 'cv' | 'correction' | 'convergence'

const TABS: { key: TabKey; label: string; scale: ColorScale }[] = [
  { key: 've_lambda',   label: 'VE Lambda',    scale: 'warm'        },
  { key: 'samples',     label: 'Amostras',     scale: 'coverage'    },
  { key: 'confidence',  label: 'Confiança',    scale: 'confidence'  },
  { key: 'cv',          label: 'CV',           scale: 'warm'        },
  { key: 'correction',  label: 'Correção %',   scale: 'diverging'   },
  { key: 'convergence', label: 'Convergência', scale: 'convergence' },
]

function selectGrid(output: TuningOutput, tab: TabKey): (number | boolean | null)[][] {
  switch (tab) {
    case 've_lambda':   return output.veLambdaMap
    case 'samples':     return output.sampleCountMap
    case 'confidence':  return output.confidenceMap
    case 'cv':          return output.cvMap
    case 'correction':  return output.correctionPctMap
    case 'convergence': return output.convergenceMap
  }
}

function fmtCell(tab: TabKey) {
  return (v: number | boolean | null): string => {
    if (v === null) return '—'
    if (tab === 'convergence') return typeof v === 'boolean' ? (v ? '✓' : '!') : '—'
    if (typeof v !== 'number') return '—'
    if (tab === 've_lambda')  return v.toFixed(3)
    if (tab === 'samples')    return String(Math.round(v))
    if (tab === 'confidence') return (v * 100).toFixed(0) + '%'
    if (tab === 'cv')         return (v * 100).toFixed(1) + '%'
    if (tab === 'correction') return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
    return String(Math.round(v))
  }
}

interface Props {
  output: TuningOutput | null
}

export default function AnalysisSection({ output }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('ve_lambda')

  const originalMap = useMapStore(s => s.originalMap)

  if (!output || !originalMap) return null

  const { filterStats, gradientWarnings, cellsExtrapolated, monotonicityWarnings } = output
  const grid       = selectGrid(output, activeTab)
  const activeInfo = TABS.find(t => t.key === activeTab)!

  const filteredTotal =
    filterStats.discardedClt +
    filterStats.discardedOpenLoop +
    filterStats.discardedSkipCl +
    filterStats.discardedSkipRpmBkt +
    filterStats.discardedSkipMapBkt +
    filterStats.discardedDeltaRpm +
    filterStats.discardedDeltaMap +
    filterStats.discardedDeltaLambda +
    filterStats.discardedMaxLambda +
    filterStats.discardedDeltaPedal

  return (
    <div className="flex flex-col gap-4">
      {/* Filter stats */}
      <div className="flex flex-wrap gap-3">
        {([
          ['Total',          filterStats.totalRows],
          ['Aproveitadas',   filterStats.passed],
          ['Filtradas',      filteredTotal],
          ['Fora da grade',  filterStats.discardedOutOfRange],
          ['Outliers',       filterStats.discardedOutlier],
          ['Interpoladas',   cellsExtrapolated.length],
          ['Monoton. warn.', monotonicityWarnings.length],
          ['Grad. warn.',    gradientWarnings.length],
        ] as [string, number][]).map(([label, value]) => (
          <div key={label} className="bg-gray-800 rounded-lg px-3 py-2 text-center min-w-[80px]">
            <p className="text-lg font-bold text-gray-100">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-700 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
              activeTab === t.key
                ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <HeatmapTable
        cells={grid}
        rowHeaders={originalMap.mapBreakpoints}
        colHeaders={originalMap.rpmBreakpoints}
        colorScale={activeInfo.scale}
        readOnly
        formatValue={fmtCell(activeTab)}
        {...(activeTab === 'confidence' ? { min: 0, max: 1 } : {})}
      />

      {/* Gradient warnings */}
      {gradientWarnings.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-yellow-400 mb-2">
            Avisos de gradiente ({gradientWarnings.length})
          </p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {gradientWarnings.map((w, i) => (
              <p key={i} className="text-xs text-gray-400 bg-yellow-950/40 rounded px-2 py-1">
                [{w.rowI},{w.colJ}] → [{w.neighborI},{w.neighborJ}]:{' '}
                <span className="text-yellow-300 font-medium">{w.gradientPct.toFixed(1)}%</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
