import { Fragment, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { SIGNAL_MAP } from '@/signals/signalRegistry'
import { useLogStore } from '@/store/logStore'
import { useFilterStore } from '@/store/filterStore'
import { useFilterMask } from '@/hooks/useFilterMask'
import { evaluateFilter } from '@/utils/filter'
import { runWithBusy } from '@/utils/runWithBusy'
import { draftErrors, draftToFilter, toDraft, type DraftCount, type DraftErrorKey, type DraftNumber, type DraftWindow, type FilterDraft } from '@/utils/filterDraft'
import { DEFAULT_FILTER, FILTER_RANGE_SIGNALS, filtersEqual, type FilterRangeSignal } from '@/types/filter'
import type { LambdaLoopState } from '@/types/correction'

interface Props {
  open: boolean
  onClose: () => void
}

const LAMBDA_LOOP_OPTIONS: { value: LambdaLoopState; label: string }[] = [
  { value: 0, label: 'Aberto' },
  { value: 1, label: 'Fechado' },
  { value: 2, label: 'Fechado + auto-correção' },
]

const LIMITS: { key: 'maxDeltaTps' | 'maxDeltaMap' | 'maxDeltaLambdaTarget'; label: string }[] = [
  { key: 'maxDeltaTps',          label: 'Máx Delta TPS' },
  { key: 'maxDeltaMap',          label: 'Máx Delta MAP' },
  { key: 'maxDeltaLambdaTarget', label: 'Máx |Δ Lambda×Alvo|' },
]

type SkipKey = 'skipClosed' | 'skipOpen' | 'skipBeforeClosed' | 'skipBeforeOpen'

const SKIP_ROWS: { label: string; before: { key: SkipKey; label: string }; after: { key: SkipKey; label: string } }[] = [
  {
    label:  'Closed Loop',
    before: { key: 'skipBeforeClosed', label: 'Pular pontos antes de Closed Loop' },
    after:  { key: 'skipClosed',       label: 'Pular 1ºs pontos após Closed Loop' },
  },
  {
    label:  'Open Loop',
    before: { key: 'skipBeforeOpen', label: 'Pular pontos antes de Open Loop' },
    after:  { key: 'skipOpen',       label: 'Pular 1ºs pontos após Open Loop' },
  },
]

type WindowKey = 'holdPedal' | 'holdMap' | 'stablePedal' | 'stableMap'

interface WindowRow { key: WindowKey; label: string; unit: string }

/** "Descartar após": limite = degrau em 200 ms, pontos = quantos descartar depois. */
const HOLD_ROWS: WindowRow[] = [
  { key: 'holdPedal', label: 'Descartar após degrau de Pedal', unit: '%' },
  { key: 'holdMap',   label: 'Descartar após degrau de MAP',   unit: 'kPa' },
]
/** Estabilidade: limite = amplitude máxima, pontos = tamanho da janela. */
const STABLE_ROWS: WindowRow[] = [
  { key: 'stablePedal', label: 'Estabilidade do Pedal', unit: '%' },
  { key: 'stableMap',   label: 'Estabilidade do MAP',   unit: 'kPa' },
]

/** Colunas da seção Estabilização: rótulo | limite | pontos — mesma largura em todas as linhas. */
const STAB_GRID = 'text-xs text-gray-300 grid grid-cols-[minmax(0,1fr)_7.5rem_7.5rem] gap-x-3 gap-y-2 items-center'

const INPUT = 'bg-gray-950 border border-gray-700 rounded px-2 py-1 text-gray-200 text-xs disabled:opacity-40 disabled:cursor-not-allowed'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function ErrorLine({ message }: { message?: string }) {
  return message ? <p className="text-xs text-red-400 ml-[13rem] mt-0.5">{message}</p> : null
}

/**
 * O corpo só existe enquanto o modal está aberto: cada abertura monta de novo e parte do filtro
 * aplicado (sem piscar o rascunho antigo); fechar sem aplicar descarta o rascunho junto com ele.
 */
export default function FilterModal({ open, onClose }: Props) {
  if (!open) return null
  return <FilterModalBody onClose={onClose} />
}

function FilterModalBody({ onClose }: { onClose: () => void }) {
  const logs               = useLogStore(s => s.logs)
  const applied            = useFilterStore(s => s.filter)
  const apply              = useFilterStore(s => s.apply)
  const showFilteredPoints = useFilterStore(s => s.showFilteredPoints)
  const setShowFiltered    = useFilterStore(s => s.setShowFilteredPoints)
  const appliedMask        = useFilterMask()

  const [draft, setDraft] = useState<FilterDraft>(() => toDraft(applied))
  // A caixa responde na hora; a mudança em si (redesenha todas as telas) roda depois de pintar.
  const [showLocal, setShowLocal] = useState(showFilteredPoints)
  function toggleShowFiltered(value: boolean) {
    setShowLocal(value)
    runWithBusy('Atualizando pontos filtrados…', () => setShowFiltered(value))
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const errors      = useMemo(() => draftErrors(draft), [draft])
  const hasError    = Object.keys(errors).length > 0
  const draftFilter = useMemo(() => draftToFilter(draft), [draft])
  const deferredFilter = useDeferredValue(draftFilter)

  const total         = appliedMask.length
  const appliedPassed = useMemo(() => appliedMask.filter(Boolean).length, [appliedMask])
  const draftPassed   = useMemo(
    () => (hasError ? null : evaluateFilter(logs, deferredFilter).filter(Boolean).length),
    [hasError, logs, deferredFilter],
  )

  const unchanged = filtersEqual(draftFilter, applied) && !hasError

  function patchRange(sig: FilterRangeSignal, p: Partial<FilterDraft['ranges'][FilterRangeSignal]>) {
    setDraft(d => ({ ...d, ranges: { ...d.ranges, [sig]: { ...d.ranges[sig], ...p } } }))
  }
  function patchLoop(p: Partial<FilterDraft['lambdaLoop']>) {
    setDraft(d => ({ ...d, lambdaLoop: { ...d.lambdaLoop, ...p } }))
  }
  function patchNumber(key: 'maxDeltaTps' | 'maxDeltaMap' | 'maxDeltaLambdaTarget' | SkipKey, p: Partial<DraftNumber>) {
    setDraft(d => ({ ...d, [key]: { ...d[key], ...p } }))
  }
  function patchWindow(key: WindowKey, p: Partial<DraftWindow>) {
    setDraft(d => ({ ...d, [key]: { ...d[key], ...p } }))
  }
  function patchCount(key: 'holdGear', p: Partial<DraftCount>) {
    setDraft(d => ({ ...d, [key]: { ...d[key], ...p } }))
  }
  function toggleLoopState(state: LambdaLoopState, checked: boolean) {
    const states = checked
      ? [...draft.lambdaLoop.states.filter(s => s !== state), state]
      : draft.lambdaLoop.states.filter(s => s !== state)
    patchLoop({ states })
  }

  function handleApply() {
    if (hasError || unchanged) return
    // Fecha a dialog primeiro e aplica depois de pintar: aplicar recalcula todas as telas (síncrono),
    // e com tudo no mesmo clique a dialog ficava na tela, travada, até o fim.
    onClose()
    runWithBusy('Aplicando filtro…', () => apply(draftFilter))
  }

  function err(key: DraftErrorKey) { return errors[key] }

  /**
   * Uma linha da grade de Estabilização: interruptor + rótulo | limite + unidade | pontos. É função (não
   * componente): um componente definido aqui seria recriado a cada render e o campo perderia o foco a cada tecla.
   */
  function windowRow({ key, label, unit }: WindowRow, limitName: string) {
    return (
      <Fragment key={key}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" aria-label={label} checked={draft[key].enabled} onChange={e => patchWindow(key, { enabled: e.target.checked })} />
          <span>{label}</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text" inputMode="decimal" aria-label={`${label} (${limitName})`}
            value={draft[key].valueText} disabled={!draft[key].enabled} onChange={e => patchWindow(key, { valueText: e.target.value })}
            className={`w-16 ${INPUT}`}
          />
          <span className="text-gray-500">{unit}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text" inputMode="numeric" aria-label={`${label} (pontos)`}
            value={draft[key].nText} disabled={!draft[key].enabled} onChange={e => patchWindow(key, { nText: e.target.value })}
            className={`w-16 ${INPUT}`}
          />
          <span className="text-gray-500">pontos</span>
        </div>
        {err(key) && <p className="col-span-3 text-xs text-red-400">{err(key)}</p>}
      </Fragment>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-label="Filtro" className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[88vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-100">Filtro</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-100 text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          <p className="text-xs text-gray-400 leading-relaxed">
            Um ponto passa quando cumpre <strong className="text-gray-200">todos</strong> os critérios ligados; os campos de um critério desligado ficam travados. O mesmo filtro
            destaca os pontos no Dashboard, nos Gráficos e nos Dados e escolhe os pontos usados em <strong className="text-gray-200">Gerar
            Correção</strong>. As edições só valem depois de “Aplicar”.
          </p>

          <Section title="Faixas">
            {FILTER_RANGE_SIGNALS.map(sig => {
              const row  = draft.ranges[sig]
              const unit = SIGNAL_MAP.get(sig)?.unit ?? ''
              return (
                <div key={sig}>
                  <div className="flex items-center gap-2 text-xs text-gray-300">
                    <label className="flex items-center gap-2 w-36 flex-shrink-0 cursor-pointer">
                      <input type="checkbox" checked={row.enabled} onChange={e => patchRange(sig, { enabled: e.target.checked })} />
                      <span>{sig}</span>
                    </label>
                    <input
                      type="text" inputMode="decimal" placeholder="mín" aria-label={`${sig} mínimo`}
                      value={row.min} disabled={!row.enabled} onChange={e => patchRange(sig, { min: e.target.value })}
                      className={`w-24 ${INPUT}`}
                    />
                    <span className="text-gray-600">até</span>
                    <input
                      type="text" inputMode="decimal" placeholder="máx" aria-label={`${sig} máximo`}
                      value={row.max} disabled={!row.enabled} onChange={e => patchRange(sig, { max: e.target.value })}
                      className={`w-24 ${INPUT}`}
                    />
                    <span className="text-gray-500 w-10">{unit}</span>
                  </div>
                  <ErrorLine message={err(`range:${sig}`)} />
                </div>
              )
            })}
          </Section>

          <Section title="Lambda Loop">
            <div>
              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-gray-300">
                <label className="flex items-center gap-2 w-36 flex-shrink-0 cursor-pointer">
                  <input type="checkbox" checked={draft.lambdaLoop.enabled} onChange={e => patchLoop({ enabled: e.target.checked })} />
                  <span>Estados aceitos</span>
                </label>
                {LAMBDA_LOOP_OPTIONS.map(opt => (
                  <label key={opt.value} className={`flex items-center gap-1.5 ${draft.lambdaLoop.enabled ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                    <input
                      type="checkbox"
                      checked={draft.lambdaLoop.states.includes(opt.value)}
                      disabled={!draft.lambdaLoop.enabled}
                      onChange={e => toggleLoopState(opt.value, e.target.checked)}
                    />
                    <span className={draft.lambdaLoop.enabled ? '' : 'opacity-40'}>{opt.label}</span>
                  </label>
                ))}
              </div>
              <ErrorLine message={err('lambdaLoop')} />
            </div>
          </Section>

          <Section title="Variação e alvo">
            {LIMITS.map(({ key, label }) => (
              <div key={key}>
                <div className="flex items-center gap-2 text-xs text-gray-300">
                  <label className="flex items-center gap-2 w-52 flex-shrink-0 cursor-pointer">
                    <input type="checkbox" checked={draft[key].enabled} onChange={e => patchNumber(key, { enabled: e.target.checked })} />
                    <span>{label}</span>
                  </label>
                  <input
                    type="text" inputMode="decimal" aria-label={label}
                    value={draft[key].text} disabled={!draft[key].enabled} onChange={e => patchNumber(key, { text: e.target.value })}
                    className={`w-24 ${INPUT}`}
                  />
                </div>
                <ErrorLine message={err(key)} />
              </div>
            ))}
          </Section>

          <Section title="Transições de Lambda Loop">
            {SKIP_ROWS.map(({ label, before, after }) => (
              <div key={label}>
                <div className="flex items-center gap-x-6 gap-y-1 flex-wrap text-xs text-gray-300">
                  <span className="w-24 flex-shrink-0">{label}</span>
                  {[{ ...before, title: 'Antes' }, { ...after, title: 'Depois' }].map(({ key, label: ariaLabel, title }) => (
                    <div key={key} className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" aria-label={ariaLabel} checked={draft[key].enabled} onChange={e => patchNumber(key, { enabled: e.target.checked })} />
                        <span>{title}</span>
                      </label>
                      <input
                        type="text" inputMode="numeric" aria-label={`${ariaLabel} (pontos)`}
                        value={draft[key].text} disabled={!draft[key].enabled} onChange={e => patchNumber(key, { text: e.target.value })}
                        className={`w-20 ${INPUT}`}
                      />
                      <span className="text-gray-500">pontos</span>
                    </div>
                  ))}
                </div>
                <ErrorLine message={err(before.key)} />
                <ErrorLine message={err(after.key)} />
              </div>
            ))}
          </Section>

          <Section title="Estabilização">
            <div className="text-xs text-gray-500 leading-relaxed space-y-1">
              <p>
                Tiram do filtro os pontos em que o lambda ainda está assentando depois de uma mudança brusca.
              </p>
              <p>
                <strong className="text-gray-400">Descartar após degrau ou troca</strong>: quando o Pedal ou o MAP varia mais que o limite em 200 ms
                (ou a marcha muda), o ponto é excluído e também os N pontos seguintes ao fim da variação. Uma rampa lenta não conta como degrau.
                O degrau é medido à parte do Máx Delta TPS/MAP.
              </p>
            </div>
            <div className={STAB_GRID}>
              <span />
              <span className="text-xs text-gray-500">Degrau em 200 ms</span>
              <span className="text-xs text-gray-500">Descartar depois</span>
              {HOLD_ROWS.map(row => windowRow(row, 'degrau'))}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" aria-label="Descartar após troca de marcha" checked={draft.holdGear.enabled} onChange={e => patchCount('holdGear', { enabled: e.target.checked })} />
                <span>Descartar após troca de marcha</span>
              </label>
              <span className="text-gray-600">—</span>
              <div className="flex items-center gap-2">
                <input
                  type="text" inputMode="numeric" aria-label="Descartar após troca de marcha (pontos)"
                  value={draft.holdGear.nText} disabled={!draft.holdGear.enabled} onChange={e => patchCount('holdGear', { nText: e.target.value })}
                  className={`w-16 ${INPUT}`}
                />
                <span className="text-gray-500">pontos</span>
              </div>
              {err('holdGear') && <p className="col-span-3 text-xs text-red-400">{err('holdGear')}</p>}
            </div>

            <p className="text-xs text-gray-500 leading-relaxed pt-2">
              <strong className="text-gray-400">Estabilidade</strong>: exclui o ponto se o sinal variou (máximo − mínimo) mais que o limite nos
              últimos N pontos, o que pega também variações lentas.
            </p>
            <div className={STAB_GRID}>
              <span />
              <span className="text-xs text-gray-500">Amplitude máx.</span>
              <span className="text-xs text-gray-500">Janela</span>
              {STABLE_ROWS.map(row => windowRow(row, 'amplitude'))}
            </div>
          </Section>

          <Section title="Exibição">
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input type="checkbox" checked={showLocal} onChange={e => toggleShowFiltered(e.target.checked)} />
              Mostrar pontos filtrados (esmaecidos) em vez de escondê-los
            </label>
          </Section>

          <p className="text-xs text-gray-500">
            {hasError
              ? 'Corrija os campos em vermelho para ver a prévia.'
              : draftPassed !== null && !unchanged
                ? `Prévia: ${draftPassed.toLocaleString()} de ${total.toLocaleString()} pontos passariam · ${appliedPassed.toLocaleString()} passam no filtro aplicado`
                : `${appliedPassed.toLocaleString()} de ${total.toLocaleString()} pontos passam no filtro aplicado`}
          </p>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={() => setDraft(toDraft(DEFAULT_FILTER))}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors"
          >
            Restaurar padrão
          </button>
          <button
            onClick={handleApply}
            disabled={hasError || unchanged}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-sm text-white transition-colors"
          >
            Aplicar
          </button>
        </div>

      </div>
    </div>
  )
}
