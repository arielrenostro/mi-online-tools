import { useMemo, useState } from 'react'
import { useMapStore } from '@/store/mapStore'
import { useCorrectionStore } from '@/store/correctionStore'
import { useMapTableCellWidth } from '@/hooks/useMapTableCellWidth'
import HeatmapTable from '@/components/HeatmapTable'
import ConfirmDialog from '@/components/ConfirmDialog'
import { computeFactorGrid, computeDirectFactor, computeWeightedFactor } from '@/utils/correctionDisplay'
import type { StatMode, ValueMode } from '@/utils/correctionDisplay'
import type { CorrectionFilterConfig } from '@/types/correction'

const FACTOR_DISPLAY_RANGE = 0.15 // ±15% around 1.00 for the factor tables' color scale

function fmtTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const LAMBDA_LOOP_LABELS: Record<number, string> = { 0: 'Aberto', 1: 'Fechado', 2: 'Fechado+AC' }

function fmtFilters(f: CorrectionFilterConfig): string {
  const parts: string[] = []
  if (f.lambdaLoop.length < 3) {
    parts.push(`Loop=${f.lambdaLoop.map(v => LAMBDA_LOOP_LABELS[v]).join('/')}`)
  }
  parts.push(`CLT≥${f.minClt}°`)
  parts.push(`Lambda ${f.minLambda.toFixed(3)}–${f.maxLambda.toFixed(3)}`)
  parts.push(`ΔTPS≤${f.maxDeltaTps}`)
  parts.push(`ΔMAP≤${f.maxDeltaMap}`)
  parts.push(`|Δλ×alvo|≤${f.maxDeltaLambdaTarget.toFixed(3)}`)
  if (f.skipFirstClosedLoop > 0) parts.push(`pula ${f.skipFirstClosedLoop} 1ºs CL`)
  if (f.skipFirstOpenLoop > 0) parts.push(`pula ${f.skipFirstOpenLoop} 1ºs OL`)
  return parts.join(' · ')
}

function ToggleGroup<T extends string>({ value, options, onChange }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded border border-gray-700 overflow-hidden text-xs">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2 py-1 transition-colors ${
            value === opt.value ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function formatFactor(v: number | boolean | null): string {
  if (v === null) return '—'
  return (v as number).toFixed(3)
}

function formatSamples(v: number | boolean | null): string {
  if (v === null) return '—'
  return String(Math.round(v as number))
}

const FACTOR_TABLES: { mode: ValueMode; title: string }[] = [
  { mode: 'direct',   title: 'Direta' },
  { mode: 'weighted', title: 'Ponderado' },
]

export default function CorrectionSection() {
  const snapshot        = useCorrectionStore(s => s.snapshot)
  const isStale         = useCorrectionStore(s => s.isStale)
  const originalMap     = useMapStore(s => s.originalMap)
  const editableMap     = useMapStore(s => s.editableMap)
  const bulkUpdateCells = useMapStore(s => s.bulkUpdateCells)

  const [statMode, setStatMode] = useState<StatMode>('mean')
  const [confirmMode, setConfirmMode] = useState<ValueMode | null>(null)

  const nCols = originalMap?.rpmBreakpoints.length ?? 0
  const { ref: widthRef, cellWidth } = useMapTableCellWidth(nCols)

  const directGrid = useMemo(() => {
    if (!snapshot || !editableMap) return null
    return computeFactorGrid(snapshot, editableMap, statMode, 'direct')
  }, [snapshot, editableMap, statMode])

  const weightedGrid = useMemo(() => {
    if (!snapshot || !editableMap) return null
    return computeFactorGrid(snapshot, editableMap, statMode, 'weighted')
  }, [snapshot, editableMap, statMode])

  if (!snapshot || !originalMap || !editableMap || !directGrid || !weightedGrid) return null

  const gridByMode: Record<ValueMode, (number | null)[][]> = { direct: directGrid, weighted: weightedGrid }

  const sampleGrid = snapshot.cells.map(row => row.map(c => (c.n === 0 ? null : c.n)))
  const maxSamples = Math.max(1, ...sampleGrid.flat().filter((v): v is number => v !== null))

  function cellTitle(rowI: number, colJ: number): string | undefined {
    const cell = snapshot!.cells[rowI][colJ]
    if (cell.n === 0 || cell.mean === null || cell.median === null) return 'Sem dados'
    const directMean   = computeDirectFactor(cell, editableMap![rowI][colJ], 'mean')!
    const weightedMean = computeWeightedFactor(cell, editableMap![rowI][colJ], 'mean')!
    return [
      `n=${cell.n.toFixed(1)}`,
      `média=${cell.mean.toFixed(1)}`,
      `mediana=${cell.median.toFixed(1)}`,
      `direto=${directMean.toFixed(3)}`,
      `ponderado=${weightedMean.toFixed(3)}`,
    ].join(' · ')
  }

  function handleApply(mode: ValueMode) {
    const grid = gridByMode[mode]
    const changes: { row: number; col: number; value: number }[] = []
    grid.forEach((row, rowI) => row.forEach((factor, colJ) => {
      if (factor === null) return
      changes.push({ row: rowI, col: colJ, value: Math.round(editableMap![rowI][colJ] * factor) })
    }))
    bulkUpdateCells(changes)
    setConfirmMode(null)
  }

  const { provenance } = snapshot

  return (
    <section className="px-5 pb-4">
      {/* ref here (not on <section>) so the measured width excludes the px-5 padding,
          matching what MapWithChart's own container measures for the map above */}
      <div ref={widthRef}>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            Correção
            {isStale && <span className="text-yellow-500 normal-case font-normal">(desatualizado — filtros/logs/intervalo mudaram)</span>}
          </h2>
          <ToggleGroup value={statMode} onChange={setStatMode} options={[
            { value: 'mean',   label: 'Média' },
            { value: 'median', label: 'Mediana' },
          ]} />
        </div>

        <p className="text-xs text-gray-500 mb-3">
          Gerado com: {provenance.logFilenames.join(', ') || '—'} ·{' '}
          {provenance.timeRange
            ? `intervalo ${fmtTime(provenance.timeRange.start_ms)}–${fmtTime(provenance.timeRange.end_ms)}`
            : 'todos os pontos'} ·{' '}
          {fmtFilters(provenance.filters)}
        </p>

        <div className="overflow-x-auto pb-1">
          <div className="flex items-start gap-4 w-max">
            {FACTOR_TABLES.map(({ mode, title }) => (
              <div key={mode}>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
                  <button
                    onClick={() => setConfirmMode(mode)}
                    className="px-2.5 py-1 rounded bg-blue-700 hover:bg-blue-600 text-xs text-white transition-colors"
                  >
                    Aplicar correções no mapa
                  </button>
                </div>
                <HeatmapTable
                  cells={gridByMode[mode]}
                  rowHeaders={originalMap.mapBreakpoints}
                  colHeaders={originalMap.rpmBreakpoints}
                  colorScale="symmetric"
                  readOnly
                  min={1 - FACTOR_DISPLAY_RANGE}
                  max={1 + FACTOR_DISPLAY_RANGE}
                  formatValue={formatFactor}
                  cellTitle={cellTitle}
                  cellWidth={cellWidth}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Amostras</h3>
          <HeatmapTable
            cells={sampleGrid}
            rowHeaders={originalMap.mapBreakpoints}
            colHeaders={originalMap.rpmBreakpoints}
            colorScale="coverage"
            readOnly
            min={0}
            max={maxSamples}
            formatValue={formatSamples}
            cellTitle={cellTitle}
            cellWidth={cellWidth}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmMode !== null}
        onClose={() => setConfirmMode(null)}
        onConfirm={() => confirmMode && handleApply(confirmMode)}
        title="Aplicar correções no mapa"
        message={`Cada célula com dados será multiplicada pelo fator ${confirmMode === 'direct' ? 'direto' : 'ponderado'}. Células sem dados ficam inalteradas. Isso conta como uma única ação de undo.`}
        confirmLabel="Aplicar"
      />
    </section>
  )
}
