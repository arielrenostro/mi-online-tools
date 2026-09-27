import { useMemo } from 'react'
import { useLogStore } from '@/store/logStore'
import { useCorrectionStore } from '@/store/correctionStore'
import { useMapStore } from '@/store/mapStore'
import { evaluateCorrectionFilters } from '@/utils/correctionFilters'
import type { CorrectionFilterConfig, LambdaLoopState } from '@/types/correction'

function NumberField({ label, value, onChange, step = 1 }: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-400">
      <span className="w-40 flex-shrink-0">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-24 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-200"
      />
    </label>
  )
}

const LAMBDA_LOOP_OPTIONS: { value: LambdaLoopState; label: string }[] = [
  { value: 0, label: 'Aberto' },
  { value: 1, label: 'Fechado' },
  { value: 2, label: 'Fechado + auto-correção' },
]

export function CorrectionFilterPanel() {
  const logs                  = useLogStore(s => s.logs)
  const originalMap           = useMapStore(s => s.originalMap)
  const draftFilters          = useCorrectionStore(s => s.draftFilters)
  const filters               = useCorrectionStore(s => s.filters)
  const showFilteredPoints    = useCorrectionStore(s => s.showFilteredPoints)
  const setDraftFilters       = useCorrectionStore(s => s.setDraftFilters)
  const applyFilters          = useCorrectionStore(s => s.applyFilters)
  const isFiltersDirty        = useCorrectionStore(s => s.isFiltersDirty())
  const setShowFilteredPoints = useCorrectionStore(s => s.setShowFilteredPoints)
  const generate              = useCorrectionStore(s => s.generate)

  const draftMask = useMemo(() => evaluateCorrectionFilters(logs, draftFilters), [logs, draftFilters])
  const appliedMask = useMemo(() => evaluateCorrectionFilters(logs, filters), [logs, filters])
  const total = draftMask.length
  const draftPassed = draftMask.filter(Boolean).length
  const appliedPassed = appliedMask.filter(Boolean).length

  function setFilter<K extends keyof CorrectionFilterConfig>(key: K, value: CorrectionFilterConfig[K]) {
    setDraftFilters({ [key]: value } as Partial<CorrectionFilterConfig>)
  }

  function toggleLambdaLoop(state: LambdaLoopState) {
    const has = draftFilters.lambdaLoop.includes(state)
    const next = has ? draftFilters.lambdaLoop.filter(v => v !== state) : [...draftFilters.lambdaLoop, state]
    if (next.length === 0) return // keep at least one selected
    setFilter('lambdaLoop', next as LambdaLoopState[])
  }

  const canGenerate = originalMap !== null && appliedPassed > 0

  return (
    <div className="mt-6 pt-5 border-t border-gray-700">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Filtros
      </h3>

      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-40 flex-shrink-0">Lambda Loop</span>
          {LAMBDA_LOOP_OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={draftFilters.lambdaLoop.includes(opt.value)}
                onChange={() => toggleLambdaLoop(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>

        <NumberField label="Mín CLT (°C)" value={draftFilters.minClt} onChange={v => setFilter('minClt', v)} />
        <NumberField label="Mín Lambda" value={draftFilters.minLambda} onChange={v => setFilter('minLambda', v)} step={0.001} />
        <NumberField label="Máx Lambda" value={draftFilters.maxLambda} onChange={v => setFilter('maxLambda', v)} step={0.001} />
        <NumberField label="Máx Delta TPS" value={draftFilters.maxDeltaTps} onChange={v => setFilter('maxDeltaTps', v)} />
        <NumberField label="Máx Delta MAP" value={draftFilters.maxDeltaMap} onChange={v => setFilter('maxDeltaMap', v)} />
        <NumberField label="Máx |Δ Lambda×Alvo|" value={draftFilters.maxDeltaLambdaTarget} onChange={v => setFilter('maxDeltaLambdaTarget', v)} step={0.001} />
        <NumberField label="Pular 1ºs após Closed Loop" value={draftFilters.skipFirstClosedLoop} onChange={v => setFilter('skipFirstClosedLoop', v)} />
        <NumberField label="Pular 1ºs após Open Loop" value={draftFilters.skipFirstOpenLoop} onChange={v => setFilter('skipFirstOpenLoop', v)} />

        <label className="flex items-center gap-2 text-xs text-gray-400 mt-1">
          <input
            type="checkbox"
            checked={showFilteredPoints}
            onChange={e => setShowFilteredPoints(e.target.checked)}
          />
          Mostrar pontos filtrados (esmaecidos) em vez de escondê-los
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-500">
          {isFiltersDirty
            ? `Prévia: ${draftPassed.toLocaleString()} de ${total.toLocaleString()} pontos passariam nestes filtros`
            : `${appliedPassed.toLocaleString()} de ${total.toLocaleString()} pontos passam nos filtros atuais`}
        </p>
        <div className="flex items-center gap-2">
          {isFiltersDirty && (
            <span className="text-xs text-yellow-500">Filtros não aplicados</span>
          )}
          <button
            onClick={applyFilters}
            disabled={!isFiltersDirty}
            className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Aplicar filtros
          </button>
          <button
            onClick={generate}
            disabled={!canGenerate}
            title={!originalMap ? 'Importe um mapa primeiro' : appliedPassed === 0 ? 'Nenhum ponto qualifica com os filtros aplicados' : undefined}
            className="px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-xs text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            Gerar fator de correção
          </button>
        </div>
      </div>
    </div>
  )
}
