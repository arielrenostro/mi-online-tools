import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMapStore } from '@/store/mapStore'
import { useCorrectionStore, isRunCompatible, selectSelectedRun } from '@/store/correctionStore'
import { useCorrectionSettingsStore } from '@/store/correctionSettingsStore'
import { confidenceOpacity } from '@/utils/correctionColor'
import { RunSelector } from './RunSelector'
import { filterChips, logChips } from '@/utils/runRecipe'
import { useMapTableCellWidth } from '@/hooks/useMapTableCellWidth'
import HeatmapTable from '@/components/HeatmapTable'
import ConfirmDialog from '@/components/ConfirmDialog'
import { computeFactorGrid, computeDirectFactor, computeWeightedFactor, computeApplyChanges, confidenceWeightGrid, factorToPercent, formatPercentDelta, percentGrid, snapshotHasMode } from '@/utils/correctionDisplay'
import type { StatMode, ValueMode } from '@/utils/correctionDisplay'
import type { Selection } from '@/utils/mapEditOps'

function ToggleGroup<T extends string>({ value, options, onChange }: {
  value: T
  options: { value: T; label: string; disabled?: boolean; title?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded border border-gray-700 overflow-hidden text-xs">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          disabled={opt.disabled}
          title={opt.title}
          className={`px-2 py-1 transition-colors ${
            value === opt.value ? 'bg-blue-700 text-white'
            : opt.disabled      ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
            : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/** Os fatores aparecem como variação percentual: 1.05 → +5.0%, 0.95 → -5.0%. */
function formatCorrection(v: number | boolean | null): string {
  return formatPercentDelta(v as number | null)
}

function formatSamples(v: number | boolean | null): string {
  if (v === null) return '—'
  return String(Math.round(v as number))
}

/** Espaço entre as tabelas Direta e Ponderado (`gap-4`); entra na conta da largura para o par caber sem rolagem. */
const PAIR_GAP_PX = 16

type ColorBy = 'value' | 'samples'

const FACTOR_TABLES: { mode: ValueMode; title: string }[] = [
  { mode: 'direct',   title: 'Direta' },
  { mode: 'weighted', title: 'Ponderado' },
]

interface CorrectionSectionProps {
  selection:         Selection
  onSelectionChange: (selection: Selection) => void
  onKeyDelegate?:    (e: React.KeyboardEvent) => void
}

export default function CorrectionSection({ selection, onSelectionChange, onKeyDelegate }: CorrectionSectionProps) {
  const runs            = useCorrectionStore(s => s.runs)
  const run             = useCorrectionStore(selectSelectedRun)
  const originalMap     = useMapStore(s => s.originalMap)
  const editableMap     = useMapStore(s => s.editableMap)
  const bulkUpdateCells = useMapStore(s => s.bulkUpdateCells)
  const confidenceK     = useCorrectionSettingsStore(s => s.values.confidenceK)

  const [selectedStat, setStatMode] = useState<StatMode>('mean')
  // O que pinta as tabelas Direta/Ponderado: a confiança pelas amostras (padrão) ou só o tamanho da correção.
  const [colorBy, setColorBy] = useState<ColorBy>('samples')
  const [confirmMode, setConfirmMode] = useState<ValueMode | null>(null)

  const nCols = originalMap?.rpmBreakpoints.length ?? 0
  const { ref: widthRef, cellWidth } = useMapTableCellWidth(nCols, PAIR_GAP_PX)

  const compatible = run !== null && isRunCompatible(run, originalMap)
  const usable     = compatible ? run : null

  const modeAvailable = useMemo(() => (usable ? snapshotHasMode(usable) : false), [usable])
  // An older run has no mode: fall back to the median rather than showing empty factors.
  const statMode: StatMode = selectedStat === 'mode' && !modeAvailable ? 'median' : selectedStat

  const directGrid = useMemo(() => {
    if (!usable || !editableMap) return null
    return computeFactorGrid(usable, editableMap, statMode, 'direct')
  }, [usable, editableMap, statMode])

  const weightedGrid = useMemo(() => {
    if (!usable || !editableMap) return null
    return computeFactorGrid(usable, editableMap, statMode, 'weighted', confidenceK)
  }, [usable, editableMap, statMode, confidenceK])

  if (!originalMap || !editableMap) return null

  const header = (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Correção</h2>
  )

  // No run yet: the section is still here, saying where corrections come from.
  if (runs.length === 0) {
    return (
      <section className="px-5 pb-4">
        <div className="mb-2">{header}</div>
        <div className="rounded-lg border border-dashed border-gray-700 px-4 py-5 text-sm text-gray-400">
          <p>
            Nenhuma correção gerada ainda. As correções são geradas a partir dos datalogs: na tela{' '}
            <Link to="/datalog" className="text-blue-400 hover:text-blue-300 underline">Datalog</Link>,
            ajuste o filtro e use o botão <strong className="text-gray-200">Gerar Correção</strong> no cabeçalho — o run
            gerado aparece aqui, ao lado do mapa.
          </p>
        </div>
      </section>
    )
  }

  const recipeLine = run && (
    <div className="flex flex-wrap gap-1.5 mb-3" aria-label="Receita do run">
      {[...logChips(run.recipe), ...filterChips(run.recipe.filter)].map((chip, i) => (
        <span key={`${i}-${chip}`} className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-[11px] text-gray-400">
          {chip}
        </span>
      ))}
      {run.recipe.filter === null && (
        <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-[11px] text-gray-500">filtros usados: indisponíveis</span>
      )}
    </div>
  )

  if (!run) {
    return (
      <section className="px-5 pb-4">
        <div className="mb-2">{header}</div>
        <div className="mb-3"><RunSelector /></div>
        <p className="text-xs text-gray-500">Escolha um run no seletor para ver as correções.</p>
      </section>
    )
  }

  if (!compatible || !directGrid || !weightedGrid) {
    return (
      <section className="px-5 pb-4">
        <div className="mb-2">{header}</div>
        <div className="mb-3"><RunSelector /></div>
        {recipeLine}
        <div role="alert" className="rounded-lg border border-yellow-800 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-500">
          Este run foi gerado para outra grade de MAP/RPM e é <strong>incompatível com o mapa carregado</strong>: não há
          fatores a exibir nem correção a aplicar. Escolha outro run ou gere um novo no Datalog com este mapa.
        </div>
      </section>
    )
  }

  // O fator é o que "Aplicar" usa; as tabelas mostram a mesma coisa como variação percentual.
  const gridByMode: Record<ValueMode, (number | null)[][]> = { direct: directGrid, weighted: weightedGrid }
  const percentByMode: Record<ValueMode, (number | null)[][]> = {
    direct:   percentGrid(directGrid),
    weighted: percentGrid(weightedGrid),
  }

  // Cores por amostras: a cor segue o valor da correção; a confiança n/(n+k) só mexe na opacidade.
  const opacityGrid = confidenceWeightGrid(run.cells, confidenceK).map(row => row.map(w => (w === null ? null : confidenceOpacity(w))))
  const sampleGrid = run.cells.map(row => row.map(c => (c.n === 0 ? null : c.n)))
  const maxSamples = Math.max(1, ...sampleGrid.flat().filter((v): v is number => v !== null))

  function cellTitle(rowI: number, colJ: number): string | undefined {
    const cell = run!.cells[rowI][colJ]
    if (cell.n === 0 || cell.mean === null || cell.median === null) return 'Sem dados'
    const directMean   = computeDirectFactor(cell, editableMap![rowI][colJ], 'mean')!
    const weightedMean = computeWeightedFactor(cell, editableMap![rowI][colJ], 'mean', confidenceK)!
    return [
      `n=${cell.n.toFixed(1)}`,
      `média=${cell.mean.toFixed(1)}`,
      `mediana=${cell.median.toFixed(1)}`,
      `moda=${typeof cell.mode === 'number' ? cell.mode.toFixed(1) : '—'}`,
      `direto=${formatPercentDelta(factorToPercent(directMean))}`,
      `ponderado=${formatPercentDelta(factorToPercent(weightedMean))}`,
    ].join(' · ')
  }

  function handleApply(mode: ValueMode) {
    bulkUpdateCells(computeApplyChanges(gridByMode[mode], editableMap!))
    setConfirmMode(null)
  }

  return (
    <section className="px-5 pb-4">
      {/* ref here (not on <section>) so the measured width excludes the px-5 padding,
          matching what MapWithChart's own container measures for the map above */}
      <div ref={widthRef}>
        <div className="mb-2">{header}</div>
        <div className="mb-3"><RunSelector /></div>

        {recipeLine}

        <div className="mb-4 flex items-start gap-8 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Valores</p>
            <ToggleGroup value={statMode} onChange={setStatMode} options={[
              { value: 'mean',   label: 'Média' },
              { value: 'median', label: 'Mediana' },
              { value: 'mode',   label: 'Moda', disabled: !modeAvailable,
                title: modeAvailable ? undefined : 'Este run foi gerado antes da Moda existir — só runs gerados a partir de agora têm Moda' },
            ]} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Cores</p>
            <ToggleGroup value={colorBy} onChange={setColorBy} options={[
              { value: 'value',   label: 'Valor', title: 'Cor pelo tamanho da correção: 5% amarelo, 10% vermelho, 15% limite' },
              { value: 'samples', label: 'Amostras', title: `Mantém as cores do valor e varia a intensidade pela confiança n / (n + k), com k = ${confidenceK} (Configurações): discreta com poucas amostras, cor inteira com muitas` },
            ]} />
          </div>
        </div>
        {colorBy === 'samples' && (
          <p className="text-[11px] text-gray-500 -mt-2 mb-3">
            Mantém as cores do valor e varia só a <strong className="text-gray-400">intensidade</strong> pela confiança{' '}
            <span className="font-mono">n / (n + k)</span>, com k = {confidenceK}: células com poucas amostras desbotam e ficam
            bem discretas; com muitas amostras em relação ao k, mostram a cor inteira. Os valores continuam sendo a correção.
          </p>
        )}

        <div className="overflow-x-auto pb-1">
          <div className="flex items-start gap-4 w-max">
            {FACTOR_TABLES.map(({ mode, title }) => (
              <div key={mode}>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <h3
                    title={mode === 'weighted' ? `Correção amortecida pelo nº de amostras: peso = n / (n + k), com k = ${confidenceK} (Configurações)` : undefined}
                    className="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {title}
                  </h3>
                  <button
                    onClick={() => setConfirmMode(mode)}
                    className="px-2.5 py-1 rounded bg-blue-700 hover:bg-blue-600 text-xs text-white transition-colors"
                  >
                    Aplicar correções no mapa
                  </button>
                </div>
                <HeatmapTable
                  cells={percentByMode[mode]}
                  rowHeaders={originalMap.mapBreakpoints}
                  colHeaders={originalMap.rpmBreakpoints}
                  colorScale="correction"
                  opacityValues={colorBy === 'samples' ? opacityGrid : undefined}
                  readOnly
                  formatValue={formatCorrection}
                  cellTitle={cellTitle}
                  cellWidth={cellWidth}
                  selection={selection}
                  onSelectionChange={onSelectionChange}
                  onKeyDelegate={onKeyDelegate}
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
            selection={selection}
            onSelectionChange={onSelectionChange}
            onKeyDelegate={onKeyDelegate}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmMode !== null}
        onClose={() => setConfirmMode(null)}
        onConfirm={() => confirmMode && handleApply(confirmMode)}
        title="Aplicar correções no mapa"
        message={`Cada célula com dados será multiplicada pelo fator ${confirmMode === 'direct' ? 'direto' : 'ponderado'} do run “${run.name}”. Células sem dados ficam inalteradas. Isso conta como uma única ação de undo.`}
        confirmLabel="Aplicar"
      />
    </section>
  )
}
