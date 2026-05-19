import type { EChartsOption } from 'echarts'

type RGB = [number, number, number]

const WARM_STOPS: RGB[] = [
  [59,  130, 246],
  [34,  197, 94],
  [234, 179, 8],
  [239, 68,  68],
]

function warmColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  const seg     = clamped * (WARM_STOPS.length - 1)
  const i       = Math.min(Math.floor(seg), WARM_STOPS.length - 2)
  const frac    = seg - i
  const a = WARM_STOPS[i], b = WARM_STOPS[i + 1]
  const r  = Math.round(a[0] + (b[0] - a[0]) * frac)
  const g  = Math.round(a[1] + (b[1] - a[1]) * frac)
  const bl = Math.round(a[2] + (b[2] - a[2]) * frac)
  return `rgb(${r},${g},${bl})`
}

export function build2DOptions(
  data:          number[][],
  rowLabels:     number[],
  colLabels:     number[],
  orientation:   'map_x_rpm' | 'rpm_x_map',
  selectedCells: Set<string>,
): EChartsOption {
  // map_x_rpm: X = RPM, one line per MAP row
  // rpm_x_map: X = MAP, one line per RPM column
  const xLabels      = orientation === 'map_x_rpm' ? colLabels : rowLabels
  const seriesLabels = orientation === 'map_x_rpm' ? rowLabels : colLabels
  const xName        = orientation === 'map_x_rpm' ? 'RPM' : 'MAP (kPa)'
  const seriesUnit   = orientation === 'map_x_rpm' ? ' kPa' : ''

  const nSeries = seriesLabels.length

  const allVals = data.flat().filter((v): v is number => typeof v === 'number')
  const allMin  = allVals.length ? Math.min(...allVals) : 0
  const allMax  = allVals.length ? Math.max(...allVals) : 100
  const axisPad = (allMax - allMin) * 0.05

  const series: EChartsOption['series'] = seriesLabels.map((label, si) => {
    const color = warmColor(si / Math.max(nSeries - 1, 1))

    const dataPoints = xLabels.map((_, xi) => {
      const row = orientation === 'map_x_rpm' ? si : xi
      const col = orientation === 'map_x_rpm' ? xi : si
      const isSelected = selectedCells.has(`${row}:${col}`)
      return {
        value:      data[row]?.[col] ?? null,
        symbol:     'rect',
        symbolSize: isSelected ? 7 : 3,
        itemStyle:  isSelected ? { color: '#60a5fa' } : { color, opacity: 0.5 },
      }
    })

    return {
      type:       'line' as const,
      name:       `${label}${seriesUnit}`,
      data:       dataPoints,
      smooth:    false,
      lineStyle: { color, width: 1.5 },
      itemStyle: { color },
    }
  })

  return {
    backgroundColor: '#111827',
    animation: false,
    grid: { top: 24, right: 16, bottom: 44, left: 56 },
    xAxis: {
      type:         'category',
      data:         xLabels.map(String),
      name:         xName,
      nameLocation: 'middle',
      nameGap:      28,
      nameTextStyle: { color: '#9ca3af', fontSize: 11 },
      axisLabel:    { color: '#9ca3af', fontSize: 9 },
      splitLine:    { lineStyle: { color: '#1f2937' } },
      axisLine:     { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type:      'value',
      name:      'VE',
      nameLocation: 'middle',
      nameGap:   40,
      nameTextStyle: { color: '#9ca3af', fontSize: 11 },
      axisLabel: { color: '#9ca3af', fontSize: 9 },
      splitLine: { lineStyle: { color: '#1f2937' } },
      axisLine:  { lineStyle: { color: '#374151' } },
      min:       allMin - axisPad,
      max:       allMax + axisPad,
    },
    tooltip: {
      trigger:         'axis',
      backgroundColor: '#1f2937',
      borderColor:     '#374151',
      textStyle:       { color: '#f3f4f6', fontSize: 11 },
      formatter(params: any) {
        const pts = Array.isArray(params) ? params : [params]
        if (!pts.length) return ''
        const xi    = pts[0].dataIndex
        const xVal  = xLabels[xi]
        const head  = orientation === 'map_x_rpm'
          ? `<b>RPM:</b> ${xVal}`
          : `<b>MAP:</b> ${xVal} kPa`
        const rows  = pts
          .filter((p: any) => p.value != null)
          .map((p: any) => {
            const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px"></span>`
            return `${dot}${p.seriesName}: <b>${p.value}</b>`
          })
          .join('<br/>')
        return `<div style="line-height:1.6">${head}<br/>${rows}</div>`
      },
    },
    series,
  }
}
