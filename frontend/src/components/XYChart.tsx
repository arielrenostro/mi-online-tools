import { useEffect, useMemo, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import { useAfterPaint } from '@/hooks/useAfterPaint'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import type { ECharts, EChartsOption } from 'echarts'
import { SIGNAL_MAP } from '@/signals/signalRegistry'
import { sigColor, dimColor, meanLineColor, ENVELOPE_LINE_COLOR } from '@/utils/signalColor'
import { hasXYPoints, bandCurve, type BandStat, type XYPoint, type XYSeriesData } from '@/utils/xySeries'

const AXIS_TEXT  = '#9ca3af'
/** Largura reservada a cada eixo Y (rótulos + nome), em px. */
const AXIS_WIDTH = 60
/** Acima disso o ECharts desenha em modo `large` (sem estilo por ponto). */
const LARGE_THRESHOLD = 2000

const cursorId = (i: number) => `cursor-${i}`

/** Faixa de X das faixas da curva média: a padrão do sinal, ou (sem ela) a dos dados que passam. */
function xRange(series: XYSeriesData[], min?: number, max?: number): [number, number] {
  if (min !== undefined && max !== undefined) return [min, max]
  let lo = Infinity, hi = -Infinity
  for (const s of series) for (const [x] of s.pass) { if (x < lo) lo = x; if (x > hi) hi = x }
  return [lo, hi]
}

/** `Nome (unidade)`, sem parênteses quando o sinal não tem unidade ou ela repete o nome (RPM). */
function axisLabel(signal: string): string {
  const unit = SIGNAL_MAP.get(signal)?.unit
  return unit && unit !== signal ? `${signal} (${unit})` : signal
}

function formatValue(signal: string, v: number): string {
  const def = SIGNAL_MAP.get(signal)
  return def ? def.format(v) : v.toFixed(3)
}

interface TooltipParam { seriesName?: string; seriesId?: string; value?: unknown; color?: string }

/**
 * Opção do ECharts da nuvem de pontos. Cada Y tem seu eixo (faixa padrão do sinal, como nos Gráficos),
 * alternando esquerda/direita; e até duas séries — a dos pontos que passam no filtro (cor cheia) e, se
 * houver, a dos que falham (esmaecida, desenhada por baixo). O marcador do cursor vai em séries à parte
 * (`cursor-<i>`, vazias aqui) atualizadas por `cursorUpdate`, para mover o cursor não reconstruir a nuvem.
 * Com `curves`, cada Y ganha séries `line` (`mean-<i>`, `max-<i>`, `min-<i>`) com a média, o máximo e o
 * mínimo de Y em cada faixa de X (ver `bandCurve`), só dos pontos que passam no filtro — os esmaecidos não
 * entram — no eixo da própria série.
 */
/** Quais curvas por faixa de X desenhar. */
export interface XYCurves { mean: boolean; max: boolean; min: boolean }
export const NO_CURVES: XYCurves = { mean: false, max: false, min: false }

const STAT_LABEL: Record<BandStat, string> = { mean: 'média', max: 'máximo', min: 'mínimo' }

export function buildXYOption(series: XYSeriesData[], xSignal: string, curves: XYCurves = NO_CURVES): EChartsOption {
  const xDef = SIGNAL_MAP.get(xSignal)
  const leftCount  = Math.ceil(series.length / 2)
  const rightCount = Math.floor(series.length / 2)

  const yAxis = series.map((s, i) => {
    const def   = SIGNAL_MAP.get(s.signal)
    const color = sigColor(s.signal, i)
    return {
      type:     'value' as const,
      min:      def?.min,
      max:      def?.max,
      position: i % 2 === 0 ? 'left' as const : 'right' as const,
      offset:   Math.floor(i / 2) * AXIS_WIDTH,
      name:     axisLabel(s.signal),
      nameLocation: 'middle' as const,
      nameGap:  AXIS_WIDTH - 24,
      nameTextStyle: { color, fontSize: 10 },
      axisLabel: { color, fontSize: 9 },
      axisLine:  { show: true, lineStyle: { color } },
      splitLine: { show: i === 0, lineStyle: { color: '#1f2937' } },
    }
  })

  const scatter = (id: string, name: string, yAxisIndex: number, data: XYPoint[], color: string, z: number) => ({
    id, name,
    type: 'scatter' as const,
    yAxisIndex,
    data,
    symbolSize: 3,
    large: true,
    largeThreshold: LARGE_THRESHOLD,
    z,
    itemStyle: { color },
  })

  const dataSeries = series.flatMap((s, i) => {
    const color = sigColor(s.signal, i)
    const out = []
    if (s.fail.length > 0) out.push(scatter(`y-${i}-fail`, s.signal, i, s.fail, dimColor(color), 1))
    out.push(scatter(`y-${i}-pass`, s.signal, i, s.pass, color, 2))
    return out
  })

  // Curvas por faixa de X (só dos pontos que passam). A nuvem tem a cor da série: a média é vermelha e
  // tracejada (marcadores na cor do sinal: com vários Y todas são vermelhas); máximo e mínimo são
  // pontilhadas em cinza-claro. Todas com halo escuro e `z` acima dos pontos.
  const [lo, hi] = xRange(series, xDef?.min, xDef?.max)
  const curveSeries = (stat: BandStat, on: boolean) => !on ? [] : series.flatMap((s, i) => {
    const data = bandCurve(s.pass, lo, hi, stat)
    if (data.length === 0) return []
    const seriesColor = sigColor(s.signal, i)
    const mean  = stat === 'mean'
    const color = mean ? meanLineColor(seriesColor) : ENVELOPE_LINE_COLOR
    return [{
      id: `${stat}-${i}`, name: s.signal,
      type: 'line' as const,
      yAxisIndex: i,
      data,
      symbol: 'circle', symbolSize: mean ? 5 : 4,
      z: mean ? 5 : 4,
      lineStyle: { color, width: mean ? 2.5 : 2, type: mean ? 'dashed' as const : 'dotted' as const, shadowColor: 'rgba(0,0,0,0.9)', shadowBlur: 6 },
      itemStyle: { color: seriesColor, borderColor: color, borderWidth: 1.5 },
    }]
  })
  const bandSeries = [...curveSeries('max', curves.max), ...curveSeries('min', curves.min), ...curveSeries('mean', curves.mean)]

  const cursorSeries = series.map((s, i) => ({
    id: cursorId(i), name: s.signal,
    type: 'scatter' as const,
    yAxisIndex: i,
    data: [] as XYPoint[],
    symbolSize: 12,
    z: 10,
    silent: true,
    itemStyle: { color: sigColor(s.signal, i), borderColor: '#ffffff', borderWidth: 2 },
  }))

  return {
    backgroundColor: 'transparent',
    animation: false,
    grid: { left: leftCount * AXIS_WIDTH + 4, right: rightCount > 0 ? rightCount * AXIS_WIDTH + 4 : 20, top: 16, bottom: 48 },
    xAxis: {
      type: 'value', min: xDef?.min, max: xDef?.max,
      name: axisLabel(xSignal), nameLocation: 'middle', nameGap: 28,
      nameTextStyle: { color: AXIS_TEXT, fontSize: 10 },
      axisLabel: { color: AXIS_TEXT, fontSize: 9 },
      axisLine:  { lineStyle: { color: '#374151' } },
      splitLine: { show: true, lineStyle: { color: '#1f2937' } },
    },
    yAxis,
    series: [...dataSeries, ...bandSeries, ...cursorSeries],
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(17,24,39,0.95)',
      borderColor: '#374151',
      textStyle: { color: '#d1d5db', fontSize: 11 },
      formatter: (raw: unknown) => {
        const p = raw as TooltipParam
        const v = Array.isArray(p.value) ? p.value : []
        if (v.length < 2 || !p.seriesName) return ''
        const stat = (['mean', 'max', 'min'] as const).find(k => p.seriesId?.startsWith(`${k}-`))
        const out = p.seriesId?.endsWith('-fail') ? ' <span style="color:#9ca3af">(fora do filtro)</span>' : ''
        const label = stat ? `${STAT_LABEL[stat]} de <b>${p.seriesName}</b>` : `<b>${p.seriesName}</b>`
        const xLabel = xSignal
        return `<div><span style="color:${p.color}">●</span> ${label}: ${formatValue(p.seriesName, Number(v[1]))}${out}</div>`
          + `<div style="color:#9ca3af">${xLabel}: ${formatValue(xSignal, Number(v[0]))}</div>`
      },
    },
  }
}

/** Atualização por merge dos marcadores do cursor (um ponto, ou nenhum, por sinal Y). */
export function cursorUpdate(cursor: (XYPoint | null)[]): { series: { id: string; data: XYPoint[] }[] } {
  return { series: cursor.map((p, i) => ({ id: cursorId(i), data: p ? [p] : [] })) }
}

interface Props {
  series:   XYSeriesData[]
  xSignal:  string
  curves:   XYCurves
  /** Um ponto por sinal Y (mesma ordem de `series`), ou `null`. */
  cursor:  (XYPoint | null)[]
}

export function XYChart({ series, xSignal, curves, cursor }: Props) {
  const option = useMemo(() => buildXYOption(series, xSignal, curves), [series, xSignal, curves])
  // Aplicar a nuvem é síncrono e pesado: só depois de pintar o "Carregando…" (ver `useAfterPaint`).
  const { shown: shownOption, pending } = useAfterPaint(option)
  const instRef   = useRef<ECharts | null>(null)
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor
  const empty = !hasXYPoints(series)

  const applyCursor = () => {
    const inst = instRef.current
    if (inst && !inst.isDisposed()) inst.setOption(cursorUpdate(cursorRef.current))
  }

  // O option é aplicado com `notMerge` (zera os marcadores), então reaplica o cursor a cada novo option
  // e a cada movimento do cursor — por merge, sem reconstruir a nuvem. Na montagem o gráfico só recebe
  // o option depois (assíncrono): o primeiro cursor vai em `onChartReady`, nunca antes das séries existirem.
  useEffect(() => {
    if (empty) { instRef.current = null; return }
    applyCursor()
  }, [shownOption, cursor, empty])

  if (empty) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500">
        Nenhum dado nos filtros atuais
      </div>
    )
  }
  return (
    <div className="relative h-full w-full">
      {shownOption && (
        <ReactECharts
          option={shownOption}
          notMerge
          onChartReady={inst => { instRef.current = inst; applyCursor() }}
          style={{ height: '100%', width: '100%' }}
        />
      )}
      {pending && <LoadingOverlay />}
    </div>
  )
}
