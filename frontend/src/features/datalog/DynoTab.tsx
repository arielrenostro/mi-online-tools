import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DynoChart } from '@/components/DynoChart'
import DynoFilterModal from './DynoFilterModal'
import { useDisplayRows, useDisplaySignals } from '@/hooks/useDisplayRows'
import { useDynoStore } from '@/store/dynoStore'
import { useTimeStore } from '@/store/timeStore'
import { selectDynoRows, isDynoRangeInvalid, isGearRestricted } from '@/utils/dynoFilter'
import { buildRawCurve, buildSmoothedCurve, applyLoss } from '@/utils/dynoCurve'

function Segmented<T extends string>({ value, options, onChange }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded border border-gray-700 overflow-hidden text-xs" role="group">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={
            value === o.value
              ? 'px-3 py-1 bg-blue-700 text-white'
              : 'px-3 py-1 bg-gray-900 text-gray-400 hover:text-gray-200'
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function DynoTab() {
  const rows      = useDisplayRows()
  const signals   = useDisplaySignals()
  const selection = useTimeStore(s => s.selection)

  const filters   = useDynoStore(s => s.filters)
  const mode      = useDynoStore(s => s.mode)
  const lossPct   = useDynoStore(s => s.lossPct)
  const smoothing = useDynoStore(s => s.smoothing)
  const setMode      = useDynoStore(s => s.setMode)
  const setSmoothing = useDynoStore(s => s.setSmoothing)

  const [filtersOpen, setFiltersOpen] = useState(false)

  // Pipeline em etapas memoizadas pelos seus insumos: mexer na perda ou em Roda/Motor não refaz o
  // filtro nem o binning.
  const selected = useMemo(() => selectDynoRows(rows, filters, selection), [rows, filters, selection])
  const curve = useMemo(
    () => smoothing === 'raw' ? buildRawCurve(selected) : buildSmoothedCurve(selected),
    [selected, smoothing],
  )
  const points = useMemo(() => mode === 'wheel' ? applyLoss(curve, lossPct) : curve, [curve, mode, lossPct])

  const rangeInvalid = isDynoRangeInvalid(filters)
  const noGearData   = isGearRestricted(filters) && !signals.includes('Marcha')

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-gray-800 px-4 py-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <button
            onClick={() => setFiltersOpen(true)}
            className="px-2.5 h-6 flex items-center rounded-full border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 text-xs font-medium transition-colors"
          >
            Filtros
          </button>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[{ value: 'engine', label: 'Motor' }, { value: 'wheel', label: 'Roda' }]}
          />
          <Segmented
            value={smoothing}
            onChange={setSmoothing}
            options={[{ value: 'raw', label: 'Bruto' }, { value: 'smoothed', label: 'Suavizado' }]}
          />
          <span className="text-xs text-gray-500">
            {selected.length.toLocaleString()} de {rows.length.toLocaleString()} linhas usadas
            {selection ? ' (dentro da seleção de tempo)' : ''}
            {mode === 'wheel' ? ` · roda com ${lossPct}% de perda` : ''}
          </span>
        </div>
        <p className="text-[11px] text-gray-600">
          Potência e torque são calculados a partir das constantes definidas em{' '}
          <Link to="/settings" className="text-gray-500 hover:text-gray-300 underline">Configurações</Link>.
        </p>
        {noGearData && (
          <p className="text-xs text-yellow-500">
            Os logs ativos não têm informação de marcha (CSV sem a coluna) — linhas deles ficam de fora enquanto houver restrição de marcha.
          </p>
        )}
        {rangeInvalid && (
          <p className="text-xs text-red-400">RPM mínimo maior que o máximo nos filtros — nenhuma linha qualifica.</p>
        )}
      </div>

      <div className="flex-1 min-h-0 p-2">
        <DynoChart points={points} smoothed={smoothing === 'smoothed'} />
      </div>

      <DynoFilterModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        usedRows={selected.length}
        totalRows={rows.length}
        noGearData={noGearData}
      />
    </div>
  )
}
