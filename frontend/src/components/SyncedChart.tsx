import React, { useRef, useEffect, useState, useCallback, memo, useMemo, useContext } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import { useUIStore, flattenPanels } from '@/store/uiStore'
import { useTimeStore } from '@/store/timeStore'
import { useDisplayRows, useDisplaySignals } from '@/hooks/useDisplayRows'
import { useFilterStore } from '@/store/filterStore'
import { useFilterMask } from '@/hooks/useFilterMask'
import { SIGNAL_MAP } from '@/signals/signalRegistry'
import { useSignalRangesStore, resolveRange, type SignalRangeOverrides } from '@/store/signalRangesStore'
import { signalOriginHint } from '@/signals/signalOrigin'
import { findLastRow } from '@/utils/findLastRow'
import { sigColor, dimColor as dim } from '@/utils/signalColor'
import { layoutHeight, canResizeHeight, canResizeWidth, hasHorizontalNeighbour } from '@/utils/chartLayoutSize'
import { rightAxisLayout, panelMargins, sharedMargins, AXIS_LABEL_MARGIN, type PlotMargins } from '@/utils/chartAxisLayout'
import { nextWindow, windowRows, type TimeWindow } from '@/utils/chartWindow'
import { useAfterPaint, applyQueue } from '@/hooks/useAfterPaint'
import { flushSync } from 'react-dom'
import { useBusy } from '@/hooks/useBusy'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import type { ChartLayout, ChartPanel } from '@/types/ui'
import type { TimeSelection } from '@/types/datalog'
import type { DatalogRow } from '@/types/datalog'

const GROUP_ID = 'datalog-charts'

function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface Run { start: number; end: number; pass: boolean }

/** Splits a boolean mask into runs of consecutive equal values. */
export function computeRuns(mask: boolean[]): Run[] {
  if (mask.length === 0) return []
  const runs: Run[] = []
  let runStart = 0
  for (let i = 1; i <= mask.length; i++) {
    if (i === mask.length || mask[i] !== mask[runStart]) {
      runs.push({ start: runStart, end: i - 1, pass: mask[runStart] })
      runStart = i
    }
  }
  return runs
}

/**
 * Quando as linhas são só um trecho do log (janelamento), `view` mantém o gráfico igual ao do log
 * inteiro: o eixo X cobre o log todo, não só o trecho carregado. (O eixo Y não precisa de nada:
 * todo sinal tem faixa fixa — a padrão de `SIGNAL_MAP` ou a sobrescrita em `ranges`.)
 */
export interface ChartView {
  xDomain: [number, number]
}

export function buildOption(
  signals: string[], rows: DatalogRow[], mask: boolean[], showFilteredPoints: boolean, view?: ChartView,
  /** Faixas que o usuário sobrescreveu (Configurações); sem entrada, vale a faixa padrão do sinal. */
  ranges?: SignalRangeOverrides,
  /** Margens comuns a todos os painéis (alinha as áreas de plotagem); sem elas, só as deste painel. */
  margins?: PlotMargins,
): object {
  if (signals.length === 0) return {}

  const rows_ = showFilteredPoints ? rows : rows.filter((_, i) => mask[i])
  const mask_ = showFilteredPoints ? mask : rows_.map(() => true)
  const runs  = computeRuns(mask_)

  const resolved = signals.map(sig => resolveRange(sig, ranges))
  const right    = rightAxisLayout(resolved.slice(1))
  const plot     = margins ?? panelMargins(resolved)
  const yAxes = signals.map((sig, i) => {
    const range = resolved[i]
    return {
      type:      'value',
      min:       range?.min,
      max:       range?.max,
      position:  i === 0 ? 'left' : 'right',
      offset:    i > 0 ? right.offsets[i - 1] : 0,
      axisLabel: { color: sigColor(sig, i), fontSize: 9, margin: AXIS_LABEL_MARGIN },
      axisLine:  { show: true, lineStyle: { color: sigColor(sig, i) } },
      splitLine: { show: i === 0, lineStyle: { color: '#1f2937' } },
    }
  })

  // One series per (signal × contiguous pass/fail run), so excluded stretches render dimmed
  // without any gap — each run's slice includes one trailing point from the next run so the
  // connecting segment between a passing and a failing point is always drawn.
  const series = signals.flatMap((sig, i) => {
    const color     = sigColor(sig, i)
    const dimmed    = dim(color)
    return runs.map(run => {
      const sliceEnd = Math.min(rows_.length - 1, run.end + 1)
      const segRows  = rows_.slice(run.start, sliceEnd + 1)
      return {
        name:       sig,
        type:       'line',
        yAxisIndex: i,
        data:       segRows.map(r => [r.timestamp_ms, r[sig] ?? NaN]),
        symbol:     'none',
        // Sem símbolos: `showSymbol: false` pula o `SymbolDraw` inteiro (que, mesmo com `symbol: 'none'`,
        // diffava e percorria todos os pontos a cada atualização); `silent` e `emphasis` desligados
        // porque nada usa o hover da série (tooltip e cursor vão por `dispatchAction`).
        showSymbol: false,
        silent:     true,
        emphasis:   { disabled: true },
        lineStyle:  { color: run.pass ? color : dimmed, width: 1.5 },
        itemStyle:  { color: run.pass ? color : dimmed },
      }
    })
  })

  return {
    backgroundColor: 'transparent',
    animation: false,
    grid: { left: plot.left, right: plot.right, top: 8, bottom: 28 },
    xAxis: {
      type: 'value',
      min:  view ? view.xDomain[0] : 'dataMin',
      max:  view ? view.xDomain[1] : 'dataMax',
      axisLabel: { formatter: fmtMs, color: '#6b7280', fontSize: 9 },
      splitLine: { show: false },
      axisLine:  { lineStyle: { color: '#374151' } },
    },
    yAxis: yAxes,
    series,
    tooltip: {
      triggerOn:   'mousemove|click',
      trigger:     'axis',
      axisPointer: {
        type: 'line',
        lineStyle: { color: '#6b7280', type: 'dashed' },
        label: {
          backgroundColor: '#1f2937',
          color: '#9ca3af',
          fontSize: 9,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter: (params: any) => fmtMs(params.value as number),
        },
      },
      backgroundColor: 'rgba(17,24,39,0.95)',
      borderColor:     '#374151',
      textStyle:       { color: '#d1d5db', fontSize: 11 },
      formatter(params: any[]) {
        if (!params?.length) return ''
        const t = params[0].value[0] as number
        const row = findLastRow(rows_, t)
        const lines: string[] = [`<span style="color:#6b7280;font-size:10px">t = ${fmtMs(t)}</span>`]
        signals.forEach((sig, i) => {
          const def = SIGNAL_MAP.get(sig)
          const value = row?.[sig]
          const v = typeof value === 'number' && !isNaN(value)
            ? (def ? def.format(value) : value.toFixed(3))
            : '—'
          lines.push(`<span style="color:${sigColor(sig, i)}">${sig}: ${v}</span>`)
        })
        return lines.join('<br/>')
      },
    },
    dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'none' }],
  }
}

// ─── Signal Chip ──────────────────────────────────────────────────────────────

function SignalChip({ signal, idx, onRemove }: { signal: string; idx: number; onRemove: () => void }) {
  return (
    <span
      title={signalOriginHint(signal)}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{
        backgroundColor: sigColor(signal, idx) + '22',
        color:           sigColor(signal, idx),
        border:          `1px solid ${sigColor(signal, idx)}44`,
      }}
    >
      {signal}
      <button onClick={onRemove} className="hover:opacity-60 leading-none ml-0.5">×</button>
    </span>
  )
}

// ─── Add Signal Dropdown ──────────────────────────────────────────────────────

function AddSignalDropdown({ available, onAdd }: { available: string[]; onAdd: (s: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (available.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200"
      >
        + Sinal ▾
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-gray-800 border border-gray-700 rounded shadow-xl min-w-36 py-1 max-h-60 overflow-y-auto">
          {available.map(sig => (
            <button
              key={sig}
              title={signalOriginHint(sig)}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
              onClick={() => { onAdd(sig); setOpen(false) }}
            >
              {sig}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Size Buttons ─────────────────────────────────────────────────────────────

function SizeButtons({ label, what, onDecrease, onIncrease, canDecrease, canIncrease }: {
  label: string; what: 'altura' | 'largura'
  onDecrease: () => void; onIncrease: () => void
  canDecrease: boolean; canIncrease: boolean
}) {
  const cls = 'px-1.5 py-0.5 text-xs text-gray-500 hover:text-gray-200 border border-gray-700 hover:border-gray-500 rounded ' +
    'disabled:opacity-30 disabled:hover:text-gray-500 disabled:hover:border-gray-700 disabled:cursor-not-allowed'
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="text-xs text-gray-600 select-none">{label}</span>
      <button onClick={onDecrease} disabled={!canDecrease} title={`Diminuir ${what}`} className={cls}>−</button>
      <button onClick={onIncrease} disabled={!canIncrease} title={`Aumentar ${what}`} className={cls}>+</button>
    </span>
  )
}

// ─── Panel View ───────────────────────────────────────────────────────────────

const PanelView = memo(function PanelView({
  panel,
  rows,
  cursor_ms,
  allSignals,
  panelCount,
  mask,
  showFilteredPoints,
  view,
}: {
  panel:      ChartPanel
  rows:       DatalogRow[]
  cursor_ms:  number | null
  allSignals: string[]
  panelCount: number
  mask:       boolean[]
  showFilteredPoints: boolean
  view:       ChartView | undefined
}) {
  const chartRef    = useRef<ReactECharts>(null)
  const cursorRef   = useRef(cursor_ms)
  cursorRef.current = cursor_ms

  const syncCtx = useContext(ChartSyncContext)
  // Vem do contexto (cópia congelada com o resto das entradas): editar uma faixa em Configurações não
  // reconstrói os gráficos escondidos; a volta à aba aplica uma única vez.
  const ranges  = syncCtx?.ranges
  const margins = syncCtx?.margins

  const updatePanelSignals = useUIStore(s => s.updatePanelSignals)
  const addChartPanel      = useUIStore(s => s.addChartPanel)
  const removeChartPanel   = useUIStore(s => s.removeChartPanel)
  const resizeHeight       = useUIStore(s => s.resizePanelHeight)
  const resizeWidth        = useUIStore(s => s.resizePanelWidth)
  const id = panel.panelId
  // booleanos: o painel só re-renderiza quando um botão muda de estado
  const canTaller  = useUIStore(s => canResizeHeight(s.chartLayout, id, 1))
  const canShorter = useUIStore(s => canResizeHeight(s.chartLayout, id, -1))
  const hasNeighbour = useUIStore(s => hasHorizontalNeighbour(s.chartLayout, id))
  const canWider   = useUIStore(s => canResizeWidth(s.chartLayout, id, 1))
  const canNarrower = useUIStore(s => canResizeWidth(s.chartLayout, id, -1))

  const available = allSignals.filter(s => !panel.signals.includes(s))

  const option = useMemo(
    () => buildOption(panel.signals, rows, mask, showFilteredPoints, view, ranges, margins),
    [panel.signals, rows, mask, showFilteredPoints, view, ranges, margins],
  )
  // O ECharts processa o `option` de forma síncrona (centenas de ms por painel num log grande): aplica
  // só depois de pintar o "Carregando…", em vez de congelar a tela com o gráfico antigo.
  const { shown: shownOption, pending: optionPending } = useAfterPaint(option)
  const zooming = syncCtx?.zooming.has(panel.panelId) ?? false
  const pending = optionPending || zooming

  const applyMarkLine = useCallback((inst: echarts.ECharts, ms: number | null) => {
    if (panel.signals.length === 0) return
    inst.setOption({
      series: [{
        markLine: ms !== null ? {
          silent:    true,
          symbol:    ['none', 'none'],
          lineStyle: { color: '#ef4444', width: 1.5, type: 'solid' },
          data:      [{ xAxis: ms }],
          label:     { show: false },
        } : { data: [] },
      }],
    })
  }, [panel.signals.length])

  // Re-apply cursor whenever option rebuilds or cursor moves
  useEffect(() => {
    const inst = chartRef.current?.getEchartsInstance?.()
    if (inst) applyMarkLine(inst, cursor_ms)
  }, [cursor_ms, shownOption, applyMarkLine])

  const onChartReady = useCallback((inst: echarts.ECharts) => {
    inst.group = GROUP_ID
    echarts.connect(GROUP_ID)
    applyMarkLine(inst, cursorRef.current)
    syncCtx?.registerChart(panel.panelId, inst)
    syncCtx?.applySelectionZoom(inst)
  }, [applyMarkLine, syncCtx, panel.panelId])

  // `notMerge` reinicia o dataZoom a cada novo `option` (e um painel recém-criado nasce a 100%):
  // reaplica o intervalo da seleção sempre que o gráfico é reconstruído.
  useEffect(() => {
    const inst = chartRef.current?.getEchartsInstance?.()
    if (inst) syncCtx?.applySelectionZoom(inst)
  }, [shownOption, syncCtx])

  // Unregister on unmount
  useEffect(() => {
    return () => { syncCtx?.unregisterChart(panel.panelId) }
  }, [syncCtx, panel.panelId])

  // Re-register when syncCtx changes (ensures datazoom listener is attached after context refresh)
  useEffect(() => {
    const inst = chartRef.current?.getEchartsInstance?.()
    if (inst && syncCtx) syncCtx.registerChart(panel.panelId, inst)
  }, [syncCtx, panel.panelId])

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 overflow-hidden border border-gray-700 rounded">
      {/* Control bar */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-900 border-b border-gray-700 flex-shrink-0 flex-wrap">
        {panel.signals.map((sig, i) => (
          <SignalChip
            key={sig}
            signal={sig}
            idx={i}
            onRemove={() => updatePanelSignals(panel.panelId, panel.signals.filter(s => s !== sig))}
          />
        ))}
        <AddSignalDropdown
          available={available}
          onAdd={sig => updatePanelSignals(panel.panelId, [...panel.signals, sig])}
        />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
          <SizeButtons
            label="↕" what="altura"
            onDecrease={() => resizeHeight(id, -1)} onIncrease={() => resizeHeight(id, 1)}
            canDecrease={canShorter} canIncrease={canTaller}
          />
          {hasNeighbour && (
            <SizeButtons
              label="⟷" what="largura"
              onDecrease={() => resizeWidth(id, -1)} onIncrease={() => resizeWidth(id, 1)}
              canDecrease={canNarrower} canIncrease={canWider}
            />
          )}
          <span className="w-px h-4 bg-gray-700 mx-0.5" />
          <button
            onClick={() => addChartPanel(panel.panelId, 'horizontal')}
            title="Dividir lado a lado"
            className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-gray-200 border border-gray-700 hover:border-gray-500 rounded"
          >↔</button>
          <button
            onClick={() => addChartPanel(panel.panelId, 'vertical')}
            title="Adicionar abaixo"
            className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-gray-200 border border-gray-700 hover:border-gray-500 rounded"
          >+ ↓</button>
          {panelCount > 1 && (
            <button
              onClick={() => removeChartPanel(panel.panelId)}
              title="Remover painel"
              className="px-1.5 py-0.5 text-xs text-red-500 hover:text-red-300 border border-gray-700 hover:border-red-700 rounded"
            >✕</button>
          )}
        </div>
      </div>

      {/* Chart area */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {panel.signals.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            Adicione um sinal acima
          </div>
        ) : (
          <>
            {shownOption && (
              <ReactECharts
                ref={chartRef}
                option={shownOption}
                notMerge={true}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
                onChartReady={onChartReady}
              />
            )}
            {pending && <LoadingOverlay />}
          </>
        )}
      </div>
    </div>
  )
})

// ─── Layout Renderer ──────────────────────────────────────────────────────────

function LayoutRenderer({
  layout,
  rows,
  cursor_ms,
  allSignals,
  panelCount,
  mask,
  showFilteredPoints,
  view,
}: {
  layout:     ChartLayout
  rows:       DatalogRow[]
  cursor_ms:  number | null
  allSignals: string[]
  panelCount: number
  mask:       boolean[]
  showFilteredPoints: boolean
  view:       ChartView | undefined
}) {
  if (layout.type === 'panel') {
    return (
      <PanelView
        panel={layout}
        rows={rows}
        cursor_ms={cursor_ms}
        allSignals={allSignals}
        panelCount={panelCount}
        mask={mask}
        showFilteredPoints={showFilteredPoints}
        view={view}
      />
    )
  }

  const commonProps = { rows, cursor_ms, allSignals, panelCount, mask, showFilteredPoints, view }

  // Altura: cada filho de uma pilha cresce na proporção da própria altura (base 0), o que é exato
  // quando o contêiner mede a soma; numa coluna mais baixa que a linha, estica proporcionalmente.
  if (layout.direction === 'vertical') {
    return (
      <div className="flex flex-col h-full">
        {layout.children.map((child, i) => (
          <div key={i} style={{ flex: `${layoutHeight(child)} 1 0px`, minHeight: 0, minWidth: 0 }}>
            <LayoutRenderer layout={child} {...commonProps} />
          </div>
        ))}
      </div>
    )
  }

  // Largura: o `ratio` reparte o espaço entre os dois lados; a soma é sempre a largura disponível.
  const ratio = layout.ratio
  return (
    <div className="flex flex-row gap-1 h-full">
      <div style={{ flex: `${ratio} 1 0px`, minHeight: 0, minWidth: 0 }}>
        <LayoutRenderer layout={layout.children[0]} {...commonProps} />
      </div>
      <div style={{ flex: `${1 - ratio} 1 0px`, minHeight: 0, minWidth: 0 }}>
        <LayoutRenderer layout={layout.children[1]} {...commonProps} />
      </div>
    </div>
  )
}

// ─── CTRL+drag state ──────────────────────────────────────────────────────────

type CtrlDrag =
  | { active: false }
  | { active: true; inst: echarts.ECharts; chartRect: DOMRect
      startClientX: number; currentClientX: number
      startMs: number; currentMs: number }

// ─── SyncedChart (export) ─────────────────────────────────────────────────────
// Context to share chart instances for cross-chart hover sync
const ChartSyncContext = React.createContext<{
  registerChart:   (id: string, inst: echarts.ECharts) => void
  unregisterChart: (id: string) => void
  /** Aplica a seleção atual (ou o intervalo completo) ao zoom de um gráfico recém-criado/reconstruído. */
  applySelectionZoom: (inst: echarts.ECharts) => void
  /** Painéis cujo zoom está esperando a vez (mostram o "Carregando…"). */
  zooming: ReadonlySet<string>
  instancesRef:    React.MutableRefObject<Map<string, echarts.ECharts>>
  /** Faixas sobrescritas pelo usuário (Configurações), no mesmo instante congelado das demais entradas. */
  ranges: SignalRangeOverrides
  /** Margens esquerda/direita comuns a todos os painéis (a maior de cada lado). */
  margins: PlotMargins | undefined
} | null>(null)

/**
 * `active` = a aba Gráficos está à vista. Escondida (as outras abas do Datalog mantêm este componente
 * montado), ele trabalha sobre uma cópia congelada das entradas: nada muda, então nenhum gráfico se
 * reconstrói nem recebe zoom enquanto não se vê; ao voltar, o que mudou nesse meio-tempo é aplicado
 * uma única vez.
 */
export function SyncedChart({ active = true }: { active?: boolean }) {
  const live = {
    chartLayout:        useUIStore(s => s.chartLayout),
    cursor_ms:          useTimeStore(s => s.cursor_ms),
    selection:          useTimeStore(s => s.selection),
    allRows:            useDisplayRows(active),
    allSignals:         useDisplaySignals(),
    ranges:             useSignalRangesStore(s => s.overrides),
    mask:               useFilterMask(),
    showFilteredPoints: useFilterStore(s => s.showFilteredPoints),
  }
  const frozenRef = useRef(live)
  if (active) frozenRef.current = live
  const { chartLayout, cursor_ms, selection, allRows, allSignals, mask, showFilteredPoints, ranges } = frozenRef.current

  const setCursor      = useTimeStore(s => s.setCursor)
  const setSelection   = useTimeStore(s => s.setSelection)
  const clearSelection = useTimeStore(s => s.clearSelection)
  const panelCount     = flattenPanels(chartLayout).length
  const totalHeight    = useMemo(() => layoutHeight(chartLayout), [chartLayout])

  // ── Janelamento: cada painel recebe só o trecho do log perto do intervalo visível ───────────────
  // A janela carregada só é refeita quando o intervalo visível sai dela (ou o zoom fecha bastante):
  // refazer a cada gesto reconstruiria o gráfico (`notMerge`) o tempo todo.
  const domain = useMemo<TimeWindow | null>(
    () => allRows.length > 0
      ? { start_ms: allRows[0].timestamp_ms, end_ms: allRows[allRows.length - 1].timestamp_ms }
      : null,
    [allRows],
  )
  const loadedWindowRef = useRef<TimeWindow | null>(null)
  const loadedWindow = useMemo(() => {
    const next = domain ? nextWindow(loadedWindowRef.current, selection ?? domain, domain) : null
    loadedWindowRef.current = next
    return next
  }, [selection, domain])
  const windowed = useMemo(() => windowRows(allRows, mask, loadedWindow), [allRows, mask, loadedWindow])
  const view = useMemo<ChartView | undefined>(
    () => domain ? { xDomain: [domain.start_ms, domain.end_ms] } : undefined,
    [domain],
  )

  const allRowsRef         = useRef(allRows)
  useEffect(() => { allRowsRef.current = allRows }, [allRows])

  const instancesRef       = useRef<Map<string, echarts.ECharts>>(new Map())
  const zoomListenersRef   = useRef<Map<string, (p: unknown) => void>>(new Map())
  const updatingFromExternal = useRef(false)

  // ── CTRL key tracking ────────────────────────────────────────────────────────
  const [ctrlHeld, setCtrlHeld] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const ctrlDragRef = useRef<CtrlDrag>({ active: false })
  const [ctrlDrag, _setCtrlDrag] = useState<CtrlDrag>({ active: false })
  const setCtrlDrag = useCallback((d: CtrlDrag) => { ctrlDragRef.current = d; _setCtrlDrag(d) }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Control') setCtrlHeld(true) }
    const up   = (e: KeyboardEvent) => {
      if (e.key === 'Control') { setCtrlHeld(false); setCtrlDrag({ active: false }) }
    }
    document.addEventListener('keydown', down)
    document.addEventListener('keyup', up)
    return () => { document.removeEventListener('keydown', down); document.removeEventListener('keyup', up) }
  }, [setCtrlDrag])

  // ── selection → ECharts sync (TimeRail/clear → chart zoom) ──────────────────
  // O dispatch roda sob `updatingFromExternal` para o handler de `datazoom` não devolver ao store
  // (e, no caso de intervalo completo, limpar) uma seleção que acabou de vir dele.
  const selectionRef = useRef(selection)
  selectionRef.current = selection

  const dispatchZoom = useCallback((instances: echarts.ECharts[], sel: typeof selection) => {
    if (instances.length === 0) return
    updatingFromExternal.current = true
    // Um `dispatchAction` num gráfico do grupo conectado (`echarts.connect`) se propaga aos outros
    // cinco: despachar em cada um fazia o mesmo zoom 6x (medido: ~1,3 s contra ~0,2 s). Cada gráfico
    // recebe o zoom uma única vez, com a propagação desligada durante a chamada.
    instances.forEach(inst => {
      const group = inst.group
      inst.group = ''
      try {
        inst.dispatchAction(sel
          ? { type: 'dataZoom', startValue: sel.start_ms, endValue: sel.end_ms }
          : { type: 'dataZoom', start: 0, end: 100 })
      } finally {
        inst.group = group
      }
    })
    requestAnimationFrame(() => { updatingFromExternal.current = false })
  }, [])

  // O zoom de cada gráfico custa dezenas de ms: roda depois de pintar o "Carregando…", um gráfico por
  // quadro (fila compartilhada), em vez de todos juntos logo após o commit — que travava a tela antes
  // de o indicador aparecer. Mudança que veio do próprio gráfico (roda/arrasto) já foi propagada pelo
  // `echarts.connect`: não é reaplicada.
  const [zooming, setZooming] = useState<ReadonlySet<string>>(() => new Set())
  const fromChartRef = useRef<TimeSelection | 'clear' | null>(null)
  useBusy(zooming.size > 0)

  useEffect(() => {
    const origin = fromChartRef.current
    fromChartRef.current = null
    if (origin === 'clear' ? selection === null
        : origin !== null && selection !== null
          && Math.abs(origin.start_ms - selection.start_ms) < 1 && Math.abs(origin.end_ms - selection.end_ms) < 1) return

    const entries = Array.from(instancesRef.current.entries()).filter(([, i]) => !i.isDisposed())
    if (entries.length === 0) return
    setZooming(new Set(entries.map(([id]) => id)))
    let cancelled = false
    let first = 0, second = 0
    first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        entries.forEach(([id, inst]) => applyQueue.enqueue(() => {
          if (cancelled) return false
          if (!inst.isDisposed()) dispatchZoom([inst], selection)
          flushSync(() => setZooming(prev => { const n = new Set(prev); n.delete(id); return n }))
          return true
        }))
      })
    })
    return () => { cancelled = true; cancelAnimationFrame(first); cancelAnimationFrame(second) }
  }, [selection, dispatchZoom])

  // Gráfico novo/reconstruído nasce a 100%: só precisa de ação quando há seleção.
  const applySelectionZoom = useCallback((inst: echarts.ECharts) => {
    const sel = selectionRef.current
    if (sel && !inst.isDisposed()) dispatchZoom([inst], sel)
  }, [dispatchZoom])

  // ── ECharts instances registry + datazoom → store ────────────────────────────
  // echarts.connect propaga o zoom visual entre painéis, mas o evento datazoom
  // só dispara na instância que originou a interação. Por isso o listener deve
  // ser registrado em cada instância individualmente.
  const registerChart = useCallback((id: string, inst: echarts.ECharts) => {
    instancesRef.current.set(id, inst)
    const prev = zoomListenersRef.current.get(id)
    if (prev) inst.off('datazoom', prev)
    const handler = (params: unknown) => {
      if (updatingFromExternal.current) return
      const p = params as {
        batch?: { startValue?: number; endValue?: number; start?: number; end?: number }[]
        startValue?: number; endValue?: number; start?: number; end?: number
      }
      const startPct = p.batch?.[0]?.start ?? p.start
      const endPct   = p.batch?.[0]?.end   ?? p.end
      if (startPct !== undefined && endPct !== undefined && startPct <= 0.5 && endPct >= 99.5) {
        fromChartRef.current = 'clear'
        clearSelection(); return
      }
      let startVal: number | null = p.batch?.[0]?.startValue ?? p.startValue ?? null
      let endVal:   number | null = p.batch?.[0]?.endValue   ?? p.endValue   ?? null
      if (startVal == null || endVal == null) {
        // ECharts inside datazoom envia só start/end percentuais (0–100); converter
        if (startPct == null || endPct == null) return
        const rows = allRowsRef.current
        const tMin = rows[0]?.timestamp_ms ?? 0
        const tMax = rows[rows.length - 1]?.timestamp_ms ?? 0
        if (tMax <= tMin) return
        startVal = tMin + (startPct / 100) * (tMax - tMin)
        endVal   = tMin + (endPct / 100)   * (tMax - tMin)
      }
      fromChartRef.current = { start_ms: Math.max(0, startVal), end_ms: Math.max(0, endVal) }
      setSelection(startVal, endVal)
    }
    inst.on('datazoom', handler)
    zoomListenersRef.current.set(id, handler)
  }, [setSelection, clearSelection])

  const unregisterChart = useCallback((id: string) => {
    const inst = instancesRef.current.get(id)
    instancesRef.current.delete(id)
    const handler = zoomListenersRef.current.get(id)
    if (handler && inst) inst.off('datazoom', handler)
    zoomListenersRef.current.delete(id)
  }, [])

  // ── CTRL+drag handlers ────────────────────────────────────────────────────────
  const handleOverlayMouseDown = useCallback((e: React.MouseEvent) => {
    if (!ctrlHeld) return
    const instances = Array.from(instancesRef.current.values()).filter(i => !i.isDisposed())
    for (const inst of instances) {
      const rect = inst.getDom().getBoundingClientRect()
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top  && e.clientY <= rect.bottom) {
        e.preventDefault()
        const startMs = inst.convertFromPixel({ xAxisIndex: 0 }, e.clientX - rect.left) as number
        setCtrlDrag({ active: true, inst, chartRect: rect,
          startClientX: e.clientX, currentClientX: e.clientX, startMs, currentMs: startMs })
        return
      }
    }
  }, [ctrlHeld, setCtrlDrag])

  useEffect(() => {
    if (!ctrlDrag.active) return
    const onMove = (e: MouseEvent) => {
      const d = ctrlDragRef.current
      if (!d.active) return
      const px = Math.max(0, Math.min(d.chartRect.width, e.clientX - d.chartRect.left))
      const ms = d.inst.convertFromPixel({ xAxisIndex: 0 }, px) as number
      setCtrlDrag({ ...d, currentClientX: e.clientX, currentMs: ms })
    }
    const onUp = () => {
      const d = ctrlDragRef.current
      if (!d.active) return
      const startMs = Math.min(d.startMs, d.currentMs)
      const endMs   = Math.max(d.startMs, d.currentMs)
      if (endMs - startMs > 200) setSelection(startMs, endMs)
      setCtrlDrag({ active: false })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [ctrlDrag.active, setSelection, setCtrlDrag])

  // ── Shared: find time at client position ─────────────────────────────────────
  const getTimeAtClient = useCallback((clientX: number, clientY: number): number | null => {
    const instances = Array.from(instancesRef.current.values()).filter(i => !i.isDisposed())
    for (const inst of instances) {
      const dom = inst.getDom()
      const rect = dom.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right &&
          clientY >= rect.top  && clientY <= rect.bottom) {
        return inst.convertFromPixel({ xAxisIndex: 0 }, clientX - rect.left) as number
      }
    }
    return null
  }, [])

  // ── Click → move TimeRail cursor ─────────────────────────────────────────────
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const timeMs = getTimeAtClient(e.clientX, e.clientY)
    if (timeMs !== null) setCursor(timeMs)
  }, [getTimeAtClient, setCursor])

  // ── Pointer hover sync across panels ─────────────────────────────────────────
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (ctrlDragRef.current.active) return
    const instances = Array.from(instancesRef.current.values()).filter(i => !i.isDisposed())
    if (instances.length === 0) return

    const timeMs = getTimeAtClient(e.clientX, e.clientY)
    if (timeMs === null) return

    if (ctrlHeld) setCursor(timeMs)

    for (const inst of instances) {
      const pixelX = inst.convertToPixel({ xAxisIndex: 0 }, timeMs)
      const dom = inst.getDom()
      const rect = dom.getBoundingClientRect()
      if (pixelX != null) {
        inst.dispatchAction({ type: 'showTip', x: pixelX as number, y: rect.height / 2 })
      }
    }
  }, [ctrlHeld, getTimeAtClient, setCursor])

  const handlePointerLeave = useCallback(() => {
    const instances = Array.from(instancesRef.current.values()).filter(i => !i.isDisposed())
    for (const inst of instances) {
      inst.dispatchAction({ type: 'hideTip' })
    }
  }, [])

  // Margem comum a todos os painéis. Dois passos de propósito: `m` muda de referência a cada edição do
  // layout, mas o objeto entregue só muda quando left/right mudam — senão todo painel reconstruiria o
  // gráfico a cada sinal adicionado/removido, mesmo sem alterar a margem.
  const m = useMemo(
    () => sharedMargins(flattenPanels(chartLayout).map(p => p.signals.map(sig => resolveRange(sig, ranges)))),
    [chartLayout, ranges],
  )
  const marginLeft = m?.left
  const marginRight = m?.right
  const margins = useMemo<PlotMargins | undefined>(
    () => marginLeft === undefined || marginRight === undefined ? undefined : { left: marginLeft, right: marginRight },
    [marginLeft, marginRight],
  )

  const ctx = useMemo(
    () => ({ registerChart, unregisterChart, applySelectionZoom, zooming, instancesRef, ranges, margins }),
    [registerChart, unregisterChart, applySelectionZoom, zooming, ranges, margins],
  )

  // ── Selection rectangle position ──────────────────────────────────────────────
  const selectionRect = useMemo(() => {
    if (!ctrlDrag.active || !containerRef.current) return null
    const contLeft = containerRef.current.getBoundingClientRect().left
    return {
      left:  Math.min(ctrlDrag.startClientX, ctrlDrag.currentClientX) - contLeft,
      width: Math.abs(ctrlDrag.currentClientX - ctrlDrag.startClientX),
    }
  }, [ctrlDrag])

  return (
    <ChartSyncContext.Provider value={ctx}>
      <div
        ref={containerRef}
        className="relative"
        style={{ height: totalHeight }}
        onClick={handleContainerClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <LayoutRenderer
          layout={chartLayout}
          rows={windowed.rows}
          cursor_ms={cursor_ms}
          allSignals={allSignals}
          panelCount={panelCount}
          mask={windowed.mask}
          showFilteredPoints={showFilteredPoints}
          view={view}
        />

        {/* CTRL+drag overlay — captura eventos só quando CTRL pressionado */}
        <div
          className="absolute inset-0"
          style={{ pointerEvents: ctrlHeld ? 'all' : 'none',
                   cursor: ctrlHeld ? 'crosshair' : 'default', zIndex: 20 }}
          onMouseDown={handleOverlayMouseDown}
        >
          {selectionRect && (
            <div
              className="absolute top-0 bottom-0 bg-blue-500/15 border-x border-blue-400/50 pointer-events-none"
              style={{ left: selectionRect.left, width: selectionRect.width }}
            />
          )}
        </div>
      </div>
    </ChartSyncContext.Provider>
  )
}
