import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { DynoPoint } from '@/utils/dynoCurve'

const POWER_COLOR  = '#60a5fa'
const TORQUE_COLOR = '#fbbf24'
const AXIS_TEXT    = '#9ca3af'

/** Acima disso, símbolos por ponto ficam pesados: desliga os símbolos e usa o modo `large`. */
const SYMBOL_LIMIT = 5000

interface TooltipParam { axisValue?: number | string; seriesName?: string; value?: unknown; color?: string }

export function buildDynoOption(points: DynoPoint[], smoothed: boolean): EChartsOption {
  const many = points.length > SYMBOL_LIMIT
  const series = (name: string, yAxisIndex: number, color: string, pick: (p: DynoPoint) => number) => ({
    name,
    type: 'line' as const,
    yAxisIndex,
    data: points.map(p => [p.rpm, pick(p)]),
    showSymbol: !smoothed && !many,
    symbolSize: 4,
    smooth: smoothed,
    large: many,
    lineStyle: { color, width: 2 },
    itemStyle: { color },
  })

  return {
    backgroundColor: 'transparent',
    animation: false,
    grid: { left: 64, right: 64, top: 40, bottom: 44 },
    legend: { top: 6, textStyle: { color: '#d1d5db' } },
    xAxis: {
      type: 'value', name: 'RPM', nameLocation: 'middle', nameGap: 28, scale: true,
      axisLine: { lineStyle: { color: '#374151' } },
      axisLabel: { color: AXIS_TEXT },
      splitLine: { show: false },
    },
    yAxis: [
      {
        type: 'value', name: 'Potência (cv)', position: 'left', min: 0,
        nameTextStyle: { color: POWER_COLOR }, axisLabel: { color: POWER_COLOR },
        axisLine: { show: true, lineStyle: { color: POWER_COLOR } },
        splitLine: { lineStyle: { color: '#1f2937' } },
      },
      {
        type: 'value', name: 'Torque (kgf·m)', position: 'right', min: 0,
        nameTextStyle: { color: TORQUE_COLOR }, axisLabel: { color: TORQUE_COLOR },
        axisLine: { show: true, lineStyle: { color: TORQUE_COLOR } },
        splitLine: { show: false },
      },
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', label: { backgroundColor: '#1f2937' } },
      backgroundColor: 'rgba(17,24,39,0.95)',
      borderColor: '#374151',
      textStyle: { color: '#d1d5db', fontSize: 11 },
      formatter: (raw: unknown) => {
        const params = (Array.isArray(raw) ? raw : [raw]) as TooltipParam[]
        if (params.length === 0) return ''
        const rpm = Math.round(Number(params[0].axisValue))
        const rows = params.map(p => {
          const v = Array.isArray(p.value) ? Number(p.value[1]) : NaN
          const unit = p.seriesName === 'Potência' ? 'cv' : 'kgf·m'
          return `<div><span style="color:${p.color}">●</span> ${p.seriesName}: <b>${Number.isFinite(v) ? v.toFixed(2) : '—'}</b> ${unit}</div>`
        })
        return `<div>${rpm} rpm</div>${rows.join('')}`
      },
    },
    series: [
      series('Potência', 0, POWER_COLOR,  p => p.power),
      series('Torque',   1, TORQUE_COLOR, p => p.torque),
    ],
  }
}

export function DynoChart({ points, smoothed }: { points: DynoPoint[]; smoothed: boolean }) {
  const option = useMemo(() => buildDynoOption(points, smoothed), [points, smoothed])

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500">
        Nenhum dado nos filtros atuais
      </div>
    )
  }
  return <ReactECharts option={option} notMerge style={{ height: '100%', width: '100%' }} />
}
