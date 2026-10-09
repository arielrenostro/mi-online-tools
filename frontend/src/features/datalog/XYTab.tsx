import { useMemo } from 'react'
import { XYChart } from '@/components/XYChart'
import { useDisplayRows, useDisplaySignals } from '@/hooks/useDisplayRows'
import { useFilterMask } from '@/hooks/useFilterMask'
import { useFilterStore } from '@/store/filterStore'
import { useTimeStore } from '@/store/timeStore'
import { useXYStore, DEFAULT_XY_SETTINGS } from '@/store/xyStore'
import { buildXYSeries, cursorPoints } from '@/utils/xySeries'
import { sigColor } from '@/utils/signalColor'

const SELECT_CLASS =
  'h-6 rounded border border-gray-700 bg-gray-900 text-xs text-gray-300 px-1.5 hover:border-gray-500 focus:outline-none focus:border-blue-500'

export function XYTab() {
  const rows      = useDisplayRows()
  const signals   = useDisplaySignals()
  const mask      = useFilterMask()
  const showFiltered = useFilterStore(s => s.showFilteredPoints)
  const selection = useTimeStore(s => s.selection)
  const cursor_ms = useTimeStore(s => s.cursor_ms)

  const savedX = useXYStore(s => s.xSignal)
  const savedY = useXYStore(s => s.ySignals)
  const setX    = useXYStore(s => s.setX)
  const addY    = useXYStore(s => s.addY)
  const removeY = useXYStore(s => s.removeY)
  const showMean    = useXYStore(s => s.showMean)
  const showMax     = useXYStore(s => s.showMax)
  const showMin     = useXYStore(s => s.showMin)
  const setShowMean = useXYStore(s => s.setShowMean)
  const setShowMax  = useXYStore(s => s.setShowMax)
  const setShowMin  = useXYStore(s => s.setShowMin)
  const curves = useMemo(() => ({ mean: showMean, max: showMax, min: showMin }), [showMean, showMax, showMin])

  // A escolha salva pode citar sinal que os logs ativos não têm (ex.: Marcha): ele só deixa de ser
  // desenhado — continua salvo e volta quando o sinal volta. Sem nenhum Y disponível a lista fica vazia
  // (e a aba pede para adicionar um); o X indisponível cai em RPM.
  const xSignal = signals.includes(savedX) ? savedX : DEFAULT_XY_SETTINGS.xSignal
  const ySignals = useMemo(() => savedY.filter(s => signals.includes(s)), [savedY, signals])

  const series = useMemo(
    () => buildXYSeries(rows, mask, selection, xSignal, ySignals, showFiltered),
    [rows, mask, selection, xSignal, ySignals, showFiltered],
  )
  const cursor = useMemo(
    () => cursorPoints(rows, cursor_ms, xSignal, ySignals),
    [rows, cursor_ms, xSignal, ySignals],
  )

  const shown   = series.reduce((n, s) => n + s.pass.length, 0)
  const dimmed  = series.reduce((n, s) => n + s.fail.length, 0)
  const addable = signals.filter(s => !ySignals.includes(s))

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-gray-800 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-xs text-gray-400">
          X
          <select
            value={xSignal}
            onChange={e => setX(e.target.value)}
            className={SELECT_CLASS}
            aria-label="Sinal do eixo X"
          >
            {signals.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
          <span>Y</span>
          {ySignals.map((sig, i) => (
            <span
              key={sig}
              className="inline-flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-full border text-gray-200"
              style={{ borderColor: sigColor(sig, i) }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: sigColor(sig, i) }} />
              {sig}
              <button
                onClick={() => removeY(sig)}
                title={`Remover ${sig}`}
                aria-label={`Remover ${sig}`}
                className="w-4 h-4 flex items-center justify-center rounded-full text-gray-500 hover:text-white"
              >
                ×
              </button>
            </span>
          ))}
          <select
            value=""
            onChange={e => { if (e.target.value) addY(e.target.value) }}
            disabled={addable.length === 0}
            className={SELECT_CLASS}
            aria-label="Adicionar sinal ao eixo Y"
          >
            <option value="">+ Adicionar Y</option>
            {addable.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {([
          ['Linha média',  showMean, setShowMean, 'a média de cada sinal do eixo Y em cada faixa de X'],
          ['Linha máxima', showMax,  setShowMax,  'o maior valor de cada sinal do eixo Y em cada faixa de X'],
          ['Linha mínima', showMin,  setShowMin,  'o menor valor de cada sinal do eixo Y em cada faixa de X'],
        ] as const).map(([label, checked, set, what]) => (
          <label
            key={label}
            className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none"
            title={`Traça ${what} (só pontos que passam no filtro)`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={e => set(e.target.checked)}
              className="accent-blue-500"
            />
            {label}
          </label>
        ))}

        <span className="text-xs text-gray-500">
          {shown.toLocaleString()} pontos
          {dimmed > 0 ? ` · ${dimmed.toLocaleString()} fora do filtro` : ''}
          {selection ? ' (dentro da seleção de tempo)' : ''}
        </span>
      </div>

      <div className="flex-1 min-h-0 p-2">
        {ySignals.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-500">
            Adicione um sinal ao eixo Y para ver o gráfico
          </div>
        ) : (
          <XYChart series={series} xSignal={xSignal} curves={curves} cursor={cursor} />
        )}
      </div>
    </div>
  )
}
