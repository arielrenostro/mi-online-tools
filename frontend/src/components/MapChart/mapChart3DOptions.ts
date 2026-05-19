import 'echarts-gl'

const WARM_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444']

export function build3DOptions(
  data:          number[][],
  rowLabels:     number[],
  colLabels:     number[],
  orientation:   'map_x_rpm' | 'rpm_x_map',
  colorMin:      number,
  colorMax:      number,
  selectedCells: Set<string>,
): any {
  const xVals = orientation === 'map_x_rpm' ? colLabels : rowLabels
  const yVals = orientation === 'map_x_rpm' ? rowLabels : colLabels
  const xName = orientation === 'map_x_rpm' ? 'RPM' : 'MAP (kPa)'
  const yName = orientation === 'map_x_rpm' ? 'MAP (kPa)' : 'RPM'

  const surfaceData: [number, number, number][] = []
  const selectedData: [number, number, number][] = []

  for (let row = 0; row < data.length; row++) {
    for (let col = 0; col < data[row].length; col++) {
      const x = orientation === 'map_x_rpm' ? colLabels[col] : rowLabels[row]
      const y = orientation === 'map_x_rpm' ? rowLabels[row] : colLabels[col]
      const z = data[row][col]
      surfaceData.push([x, y, z])
      if (selectedCells.has(`${row}:${col}`)) {
        selectedData.push([x, y, z])
      }
    }
  }

  const pad = (colorMax - colorMin) * 0.05

  const axisCfg = {
    nameTextStyle: { color: '#9ca3af', fontSize: 11 },
    axisLabel:     { color: '#9ca3af', fontSize: 9 },
    axisLine:      { lineStyle: { color: '#374151' } },
    splitLine:     { lineStyle: { color: '#1f2937', opacity: 0.5 } },
  }

  return {
    backgroundColor: '#111827',
    grid3D: {
      boxWidth:  200,
      boxDepth:  80,
      boxHeight: 60,
      axisLine:  { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#1f2937', opacity: 0.5 } },
      viewControl: { beta: 40, alpha: 20, distance: 260, autoRotate: false },
      light: { main: { intensity: 1.2, shadow: false }, ambient: { intensity: 0.3 } },
    },
    xAxis3D: { type: 'value', name: xName, min: Math.min(...xVals), max: Math.max(...xVals), ...axisCfg },
    yAxis3D: { type: 'value', name: yName, min: Math.min(...yVals), max: Math.max(...yVals), ...axisCfg },
    zAxis3D: { type: 'value', name: 'VE', min: colorMin - pad, max: colorMax + pad, ...axisCfg },
    visualMap: {
      show:    false,
      min:     colorMin - pad,
      max:     colorMax + pad,
      inRange: { color: WARM_COLORS },
    },
    series: [
      {
        type:      'surface',
        data:      surfaceData,
        shading:   'color',
        wireframe: { show: true, lineStyle: { width: 0.4, color: '#374151', opacity: 0.5 } },
      },
      ...(selectedData.length > 0 ? [{
        type:       'scatter3D',
        data:       selectedData,
        symbolSize: 8,
        itemStyle:  { color: '#60a5fa' },
        silent:     true,
      }] : []),
    ],
  }
}
