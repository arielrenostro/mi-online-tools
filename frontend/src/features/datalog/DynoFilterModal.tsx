import { useEffect, useState } from 'react'
import { DraftNumberField } from '@/components/DraftNumberField'
import { useDynoStore, GEAR_OPTIONS } from '@/store/dynoStore'
import type { DynoFilters } from '@/store/dynoStore'
import { isDynoRangeInvalid, isGearRestricted } from '@/utils/dynoFilter'
import type { LambdaLoopState } from '@/types/correction'

interface Props {
  open:        boolean
  onClose:     () => void
  /** Linhas que passam nos filtros / linhas dos logs ativos — retorno que o gráfico, coberto pelo overlay, não dá. */
  usedRows:    number
  totalRows:   number
  /** Os logs ativos não trazem o sinal Marcha. */
  noGearData:  boolean
}

const LAMBDA_LOOP_OPTIONS: { value: LambdaLoopState; label: string }[] = [
  { value: 0, label: 'Aberto' },
  { value: 1, label: 'Fechado' },
  { value: 2, label: 'Fechado + auto-correção' },
]

type BoundKey = Exclude<keyof DynoFilters, 'lambdaLoop' | 'gears'>

const finite = (n: number) => Number.isFinite(n)

/**
 * Filtros do dinamômetro e perda de transmissão. Mesma casca do `FilterModal`, mas sem
 * rascunho/Aplicar: cada campo já grava direto no `dynoStore` (só valores válidos) e fechar mantém tudo.
 */
export default function DynoFilterModal({ open, onClose, usedRows, totalRows, noGearData }: Props) {
  const filters   = useDynoStore(s => s.filters)
  const lossPct   = useDynoStore(s => s.lossPct)
  const setFilters   = useDynoStore(s => s.setFilters)
  const setLossPct   = useDynoStore(s => s.setLossPct)
  const resetFilters = useDynoStore(s => s.resetFilters)

  // Remonta os campos após "Restaurar padrões" para descartar texto inválido em edição.
  const [resetCount, setResetCount] = useState(0)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const rangeInvalid = isDynoRangeInvalid(filters)

  function boundField(key: BoundKey, label: string, unit: string, forceInvalid = false) {
    return (
      <DraftNumberField
        key={`${key}-${resetCount}`}
        label={label}
        unit={unit}
        labelWidth="w-36"
        inputBg="bg-gray-950"
        value={filters[key]}
        allowEmpty
        isValid={finite}
        forceInvalid={forceInvalid}
        title="Vazio = sem limite"
        onCommit={v => setFilters({ [key]: v })}
      />
    )
  }

  function toggleLoop(state: LambdaLoopState) {
    const has  = filters.lambdaLoop.includes(state)
    const next = has ? filters.lambdaLoop.filter(s => s !== state) : [...filters.lambdaLoop, state]
    if (next.length === 0) return // mantém ao menos um estado
    setFilters({ lambdaLoop: next as LambdaLoopState[] })
  }

  function toggleGear(gear: number) {
    const has  = filters.gears.includes(gear)
    const next = has ? filters.gears.filter(g => g !== gear) : [...filters.gears, gear]
    if (next.length === 0) return // mantém ao menos uma marcha
    setFilters({ gears: next })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-label="Filtros do dinamômetro" className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-100">Filtros do dinamômetro</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-100 text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <p className="text-xs text-gray-400 leading-relaxed">
            Só as linhas que cumprem <strong className="text-gray-200">todos</strong> os campos preenchidos entram na curva
            (campo vazio = sem limite; todas as marchas marcadas = sem restrição de marcha). Valem só para o
            dinamômetro — não têm relação com os filtros de correção do mapa. As mudanças já valem na hora.
          </p>

          <div className="space-y-2">
            {boundField('minPedal', 'Pedal mín', '%')}
            {boundField('minRpm', 'RPM mín', 'rpm', rangeInvalid)}
            {boundField('maxRpm', 'RPM máx', 'rpm', rangeInvalid)}
            {rangeInvalid && <p className="text-xs text-red-400 ml-[9.5rem]">RPM mínimo maior que o máximo — nenhuma linha qualifica.</p>}
            {boundField('minMap', 'MAP mín', 'kPa')}
            {boundField('minClt', 'CLT mín', 'ºC')}

            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-gray-300 pt-1">
              <span className="w-36 flex-shrink-0">Lambda Loop</span>
              {LAMBDA_LOOP_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.lambdaLoop.includes(opt.value)}
                    onChange={() => toggleLoop(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>

            <div>
              <div
                className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-gray-300"
                title="0 = sem marcha engatada. Todas marcadas = sem restrição de marcha."
              >
                <span className="w-36 flex-shrink-0">Marcha</span>
                {GEAR_OPTIONS.map(gear => (
                  <label key={gear} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.gears.includes(gear)}
                      onChange={() => toggleGear(gear)}
                    />
                    <span>{gear}</span>
                  </label>
                ))}
              </div>
              {noGearData && isGearRestricted(filters) && (
                <p className="text-xs text-yellow-500 ml-[9.5rem] mt-0.5">
                  Os logs ativos não têm informação de marcha — suas linhas ficam de fora.
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <DraftNumberField
              key={`loss-${resetCount}`}
              label="Perda (modo Roda)"
              unit="%"
              labelWidth="w-36"
              inputBg="bg-gray-950"
              value={lossPct}
              isValid={n => Number.isFinite(n) && n >= 0 && n <= 100}
              invalidMessage="Informe de 0 a 100"
              title="Perda de transmissão: no modo Roda, potência e torque são multiplicados por 1 − perda/100"
              onCommit={v => setLossPct(v as number)}
            />
          </div>

          <p className="text-xs text-gray-500">
            {usedRows.toLocaleString()} de {totalRows.toLocaleString()} linhas usadas
          </p>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={() => { resetFilters(); setResetCount(c => c + 1) }}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors"
          >
            Restaurar padrões
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  )
}
