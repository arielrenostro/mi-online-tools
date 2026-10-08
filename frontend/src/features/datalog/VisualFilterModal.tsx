import { useEffect, useState } from 'react'
import { SIGNAL_MAP } from '@/signals/signalRegistry'
import { useVisualFilterStore } from '@/store/visualFilterStore'
import {
  VISUAL_FILTER_SIGNALS, emptyVisualFilter,
  type VisualFilterConfig, type VisualFilterSignal,
} from '@/utils/visualFilter'
import type { LambdaLoopState } from '@/types/correction'

interface Props {
  open: boolean
  onClose: () => void
}

/** Rascunho por linha: campos como texto, para permitir digitação parcial ("-", "0."). */
interface DraftRow { enabled: boolean; min: string; max: string }
interface Draft {
  ranges:     Record<VisualFilterSignal, DraftRow>
  lambdaLoop: { enabled: boolean; states: LambdaLoopState[] }
}

const LAMBDA_LOOP_OPTIONS: { value: LambdaLoopState; label: string }[] = [
  { value: 0, label: 'Aberto' },
  { value: 1, label: 'Fechado' },
  { value: 2, label: 'Fechado + auto-correção' },
]

function toDraft(filter: VisualFilterConfig): Draft {
  const ranges = {} as Draft['ranges']
  for (const sig of VISUAL_FILTER_SIGNALS) {
    const r = filter.ranges[sig]
    ranges[sig] = { enabled: r.enabled, min: r.min === null ? '' : String(r.min), max: r.max === null ? '' : String(r.max) }
  }
  return { ranges, lambdaLoop: { enabled: filter.lambdaLoop.enabled, states: [...filter.lambdaLoop.states] } }
}

/** `''` → `null` (lado aberto); texto não numérico → `undefined` (inválido). */
function parseBound(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isNaN(n) ? undefined : n
}

/** Motivo do erro da linha (só linhas habilitadas), ou null se válida. */
function rowError(row: DraftRow): string | null {
  if (!row.enabled) return null
  const min = parseBound(row.min)
  const max = parseBound(row.max)
  if (min === undefined || max === undefined) return 'Valor inválido'
  if (min !== null && max !== null && min > max) return 'Mínimo maior que o máximo'
  return null
}

/** Lambda Loop habilitado sem nenhum estado marcado (nada passaria). */
function loopError(draft: Draft): string | null {
  const { enabled, states } = draft.lambdaLoop
  return enabled && states.length === 0 ? 'Marque ao menos um estado' : null
}

function toFilter(draft: Draft): VisualFilterConfig {
  const filter = emptyVisualFilter()
  for (const sig of VISUAL_FILTER_SIGNALS) {
    const row = draft.ranges[sig]
    filter.ranges[sig] = { enabled: row.enabled, min: parseBound(row.min) ?? null, max: parseBound(row.max) ?? null }
  }
  filter.lambdaLoop = { enabled: draft.lambdaLoop.enabled, states: [...draft.lambdaLoop.states].sort() }
  return filter
}

export default function VisualFilterModal({ open, onClose }: Props) {
  const applied = useVisualFilterStore(s => s.filter)
  const apply   = useVisualFilterStore(s => s.apply)
  const clear   = useVisualFilterStore(s => s.clear)
  const [draft, setDraft] = useState<Draft>(() => toDraft(applied))

  // Cada abertura parte do que está aplicado; fechar sem aplicar descarta o rascunho.
  useEffect(() => {
    if (open) setDraft(toDraft(useVisualFilterStore.getState().filter))
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const hasError = VISUAL_FILTER_SIGNALS.some(sig => rowError(draft.ranges[sig]) !== null) || loopError(draft) !== null

  function patch(sig: VisualFilterSignal, p: Partial<DraftRow>) {
    setDraft(d => ({ ...d, ranges: { ...d.ranges, [sig]: { ...d.ranges[sig], ...p } } }))
  }

  function patchLoop(p: Partial<Draft['lambdaLoop']>) {
    setDraft(d => ({ ...d, lambdaLoop: { ...d.lambdaLoop, ...p } }))
  }

  function toggleLoopState(state: LambdaLoopState, checked: boolean) {
    const states = checked
      ? [...draft.lambdaLoop.states.filter(s => s !== state), state]
      : draft.lambdaLoop.states.filter(s => s !== state)
    patchLoop({ states, enabled: checked ? true : draft.lambdaLoop.enabled })
  }

  function handleApply() {
    if (hasError) return
    apply(toFilter(draft))
    onClose()
  }

  function handleClear() {
    clear()
    setDraft(toDraft(emptyVisualFilter()))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-label="Filtro visual" className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-100">Filtro visual</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100 text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <p className="text-xs text-gray-400 leading-relaxed">
            Destaca no gráfico, nos dados e no dashboard os pontos que cumprem <strong className="text-gray-200">todos</strong> os
            ranges e estados de Lambda Loop marcados. Enquanto ativo, <strong className="text-gray-200">substitui</strong> o destaque dos filtros de
            correção — que continuam intactos e não afetam o fator de correção. Não é salvo ao recarregar a página.
          </p>

          <div className="space-y-2">
            {VISUAL_FILTER_SIGNALS.map(sig => {
              const row   = draft.ranges[sig]
              const unit  = SIGNAL_MAP.get(sig)?.unit ?? ''
              const error = rowError(row)
              return (
                <div key={sig}>
                  <div className="flex items-center gap-2 text-xs text-gray-300">
                    <label className="flex items-center gap-2 w-36 flex-shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={e => patch(sig, { enabled: e.target.checked })}
                      />
                      <span>{sig}</span>
                    </label>
                    <input
                      type="text" inputMode="decimal" placeholder="mín"
                      aria-label={`${sig} mínimo`}
                      value={row.min}
                      onChange={e => patch(sig, { min: e.target.value, enabled: true })}
                      className="w-24 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-gray-200"
                    />
                    <span className="text-gray-600">até</span>
                    <input
                      type="text" inputMode="decimal" placeholder="máx"
                      aria-label={`${sig} máximo`}
                      value={row.max}
                      onChange={e => patch(sig, { max: e.target.value, enabled: true })}
                      className="w-24 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-gray-200"
                    />
                    <span className="text-gray-500 w-10">{unit}</span>
                  </div>
                  {error && <p className="text-xs text-red-400 ml-[9.5rem] mt-0.5">{error}</p>}
                </div>
              )
            })}

            <div>
              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-gray-300">
                <label className="flex items-center gap-2 w-36 flex-shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.lambdaLoop.enabled}
                    onChange={e => patchLoop({ enabled: e.target.checked })}
                  />
                  <span>Lambda Loop</span>
                </label>
                {LAMBDA_LOOP_OPTIONS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.lambdaLoop.states.includes(opt.value)}
                      onChange={e => toggleLoopState(opt.value, e.target.checked)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              {loopError(draft) && <p className="text-xs text-red-400 ml-[9.5rem] mt-0.5">{loopError(draft)}</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={handleClear}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors"
          >
            Limpar
          </button>
          <button
            onClick={handleApply}
            disabled={hasError}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-sm text-white transition-colors"
          >
            Aplicar
          </button>
        </div>

      </div>
    </div>
  )
}
