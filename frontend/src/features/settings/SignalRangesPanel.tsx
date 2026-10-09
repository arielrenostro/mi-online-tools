import { useEffect, useState } from 'react'
import { DraftNumberField } from '@/components/DraftNumberField'
import { DISPLAY_SIGNAL_DEFS } from '@/signals/signalRegistry'
import { signalOriginHint } from '@/signals/signalOrigin'
import { useSignalRangesStore, defaultRange, resolveRange, isValidRange } from '@/store/signalRangesStore'

interface Pair { min: number; max: number }

/**
 * Uma linha por sinal. O store só recebe pares válidos (`min < max`); como a regra é entre os dois
 * campos, a linha guarda os últimos números válidos digitados em cada um (`draft`) e só grava quando o
 * par fecha — até lá os dois campos ficam marcados e a última faixa válida segue valendo nos gráficos.
 */
function RangeRow({ name, unit, resetSignal }: { name: string; unit: string; resetSignal: number }) {
  const overrides = useSignalRangesStore(s => s.overrides)
  const setRange  = useSignalRangesStore(s => s.setRange)
  const resetOne  = useSignalRangesStore(s => s.resetOne)

  const def    = defaultRange(name) as Pair
  const stored = resolveRange(name, overrides) as Pair
  const atDefault = stored.min === def.min && stored.max === def.max

  const [draft, setDraft] = useState<Pair>(stored)
  // Remonta os campos após restaurar para descartar texto inválido em edição.
  const [resetCount, setResetCount] = useState(0)

  // Mudança externa (restaurar, sessão restaurada): o rascunho volta a ser a faixa em vigor. Depende de
  // `resetSignal` porque "Restaurar todas" pode não mudar a faixa em vigor e ainda assim deve descartar
  // um rascunho inválido.
  useEffect(() => { setDraft({ min: stored.min, max: stored.max }) }, [stored.min, stored.max, resetSignal])

  const pairInvalid = !isValidRange(draft.min, draft.max)

  function commit(field: keyof Pair, v: number) {
    const next = { ...draft, [field]: v }
    setDraft(next)
    if (isValidRange(next.min, next.max)) setRange(name, next.min, next.max)
  }

  const key = `${resetSignal}-${resetCount}`
  return (
    <div className="grid grid-cols-[minmax(10rem,1fr)_auto_auto_auto] items-start gap-x-3 gap-y-1 py-1.5 border-b border-gray-800/60">
      <div className="text-xs text-gray-300 pt-1" title={signalOriginHint(name)}>
        {name}{unit && unit !== name && <span className="text-gray-500"> ({unit})</span>}
        {pairInvalid && <div className="text-red-400 mt-0.5">O mínimo deve ser menor que o máximo</div>}
      </div>
      <DraftNumberField
        key={`min-${key}`} label="mín" labelWidth="w-7" value={draft.min}
        forceInvalid={pairInvalid} invalidMessage="Informe um número"
        onCommit={v => commit('min', v as number)}
      />
      <DraftNumberField
        key={`max-${key}`} label="máx" labelWidth="w-7" value={draft.max}
        forceInvalid={pairInvalid} invalidMessage="Informe um número"
        onCommit={v => commit('max', v as number)}
      />
      <button
        onClick={() => { resetOne(name); setDraft(def); setResetCount(c => c + 1) }}
        disabled={atDefault}
        title={`Padrão: ${def.min} a ${def.max}`}
        className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 transition-colors disabled:opacity-40 disabled:hover:bg-gray-700"
      >
        Restaurar
      </button>
    </div>
  )
}

/** Seção "Faixa dos sinais" da tela Configurações: mínimo e máximo do eixo de cada sinal nos gráficos. */
export function SignalRangesPanel() {
  const resetAll = useSignalRangesStore(s => s.resetAll)
  // Remonta as linhas após "Restaurar todas" para descartar texto inválido em edição.
  const [resetSignal, setResetSignal] = useState(0)

  return (
    <section aria-labelledby="ranges-title">
      <div className="flex items-center justify-between mb-3">
        <h2 id="ranges-title" className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Faixa dos sinais</h2>
        <button
          onClick={() => { resetAll(); setResetSignal(c => c + 1) }}
          className="px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 transition-colors"
        >
          Restaurar todas
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Mínimo e máximo do eixo de cada sinal nas abas <strong className="text-gray-300">Gráficos</strong> e{' '}
        <strong className="text-gray-300">XY</strong>. Só enquadram os eixos: não alteram os dados, o filtro nem a correção do mapa.
        Valores fora da faixa ficam cortados na borda do gráfico.
      </p>

      <div>
        {DISPLAY_SIGNAL_DEFS.map(def => (
          <RangeRow key={def.name} name={def.name} unit={def.unit} resetSignal={resetSignal} />
        ))}
      </div>
    </section>
  )
}
