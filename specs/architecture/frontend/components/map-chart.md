# Componente `MapChart`

Heatmap interativo construído com ECharts que exibe o mapa da ECU em formato visual MAP×RPM ou RPM×MAP. Renderizado via canvas para performance. Exibe overlay de pontos do datalog e sincroniza o estado de célula destacada bidirecionalmente com o `HeatmapTable`.

**Localização:** `frontend/src/components/MapChart/`  
**Arquivos:** `MapChart.tsx`, `useMapChartOptions.ts`, `mapChartColors.ts`

---

## Props

```typescript
// src/components/MapChart/MapChart.tsx
import type { ScatterPoint } from '@/types/ui'

export interface MapChartProps {
  /**
   * Valores das células. Shape: data[row][col].
   * row = índice MAP (0 = MAP maior), col = índice RPM (0 = RPM menor).
   * Mesma shape de MapModel.cells.
   */
  data: number[][]

  /** Breakpoints de MAP (kPa) — labels do eixo vertical. */
  rowLabels: number[]

  /** Breakpoints de RPM — labels do eixo horizontal. */
  colLabels: number[]

  /**
   * Define qual eixo vai para qual lado.
   * - 'map_x_rpm': eixo X = RPM, eixo Y = MAP (kPa). Leitura natural: aumento de RPM → direita.
   * - 'rpm_x_map': eixo X = MAP (kPa), eixo Y = RPM. Visão alternativa rotacionada 90°.
   */
  orientation: 'map_x_rpm' | 'rpm_x_map'

  /**
   * Pontos do datalog plotados como scatter sobre o heatmap.
   * Posicionados nas coordenadas reais de RPM e MAP (não snapped para o breakpoint mais próximo).
   */
  overlayPoints?: ScatterPoint[]

  /**
   * Célula atualmente destacada (hover vindo de HeatmapTable ou do outro MapChart).
   * Controlado externamente pelo componente pai.
   */
  highlightedCell?: { row: number; col: number } | null

  /** Mouse entrou na célula (row, col) do heatmap. */
  onCellHover?: (row: number, col: number) => void

  /** Mouse saiu do área do gráfico. */
  onHoverEnd?: () => void

  /** Clique em uma célula do heatmap. */
  onCellClick?: (row: number, col: number) => void

  /** Altura do componente em pixels. Padrão: 300. */
  height?: number
}
```

```typescript
// Reutilizado de src/types/ui.ts
export interface ScatterPoint {
  rpm: number
  map_kpa: number
  /**
   * Densidade normalizada (0–1) derivada da contagem de amostras na célula correspondente.
   * Controla a opacidade do ponto no overlay.
   * 0 = ponto muito translúcido (poucas amostras), 1 = ponto opaco (muitas amostras).
   */
  density: number
}
```

---

## Configuração ECharts

O componente usa `echarts-for-react` ou a API imperativa do ECharts. A opção principal é construída em `useMapChartOptions.ts`.

### Estrutura das Séries

```typescript
// useMapChartOptions.ts
import type { EChartsOption } from 'echarts'

export function buildMapChartOptions(props: MapChartProps & { colorMin: number; colorMax: number }): EChartsOption {
  const { data, rowLabels, colLabels, orientation, overlayPoints, highlightedCell, colorMin, colorMax } = props

  // Converte a matriz para o formato de série heatmap do ECharts: [colIdx, rowIdx, value]
  const heatmapData: [number, number, number][] = []
  for (let row = 0; row < data.length; row++) {
    for (let col = 0; col < data[row].length; col++) {
      if (orientation === 'map_x_rpm') {
        // Eixo X = RPM (colIdx), Eixo Y = MAP (rowIdx)
        heatmapData.push([col, row, data[row][col]])
      } else {
        // Eixo X = MAP (rowIdx), Eixo Y = RPM (colIdx)
        heatmapData.push([row, col, data[row][col]])
      }
    }
  }

  // Constrói dados do scatter (overlay de pontos do log)
  const scatterData = overlayPoints?.map(pt => {
    if (orientation === 'map_x_rpm') {
      return { value: [pt.rpm, pt.map_kpa], opacity: pt.density }
    } else {
      return { value: [pt.map_kpa, pt.rpm], opacity: pt.density }
    }
  }) ?? []

  const xAxisData = orientation === 'map_x_rpm' ? colLabels : rowLabels  // RPM ou MAP
  const yAxisData = orientation === 'map_x_rpm' ? rowLabels : colLabels  // MAP ou RPM
  const xAxisName = orientation === 'map_x_rpm' ? 'RPM' : 'MAP (kPa)'
  const yAxisName = orientation === 'map_x_rpm' ? 'MAP (kPa)' : 'RPM'

  return {
    grid: { top: 20, right: 20, bottom: 40, left: 60 },
    xAxis: {
      type: 'category',
      data: xAxisData.map(String),
      name: xAxisName,
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: { color: '#9ca3af', fontSize: 10 },
      splitLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'category',
      data: yAxisData.map(String),
      name: yAxisName,
      nameLocation: 'middle',
      nameGap: 40,
      axisLabel: { color: '#9ca3af', fontSize: 10 },
      splitLine: { lineStyle: { color: '#374151' } },
    },
    visualMap: {
      min: colorMin,
      max: colorMax,
      show: false,
      // Gradiente idêntico à escala 'warm' do HeatmapTable
      inRange: {
        color: [
          '#0000ff',  // azul (min)
          '#00ff00',  // verde
          '#ffff00',  // amarelo
          '#ff0000',  // vermelho (max)
        ],
      },
    },
    series: [
      // Série 1: Heatmap
      {
        type: 'heatmap',
        data: heatmapData,
        emphasis: {
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 2,
          },
        },
        label: { show: false },  // labels dentro das células não são exibidos no chart
      },
      // Série 2: Scatter de pontos do log (opcional)
      ...(overlayPoints && overlayPoints.length > 0 ? [{
        type: 'scatter' as const,
        data: scatterData,
        symbol: 'circle',
        symbolSize: 4,
        itemStyle: {
          color: 'rgba(255, 255, 255, 0.6)',
        },
        // Opacidade individual por ponto via encode ou itemStyle customizado
      }] : []),
    ],
    tooltip: {
      trigger: 'item',
      formatter: buildTooltipFormatter(orientation, rowLabels, colLabels, overlayPoints),
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#f3f4f6', fontSize: 12 },
    },
    backgroundColor: '#111827',
  }
}
```

### Escala de Cor

A escala `warm` usada pelo `MapChart` é **calibrada sobre o mesmo min/max global** do mapa editável, garantindo que as cores sejam idênticas às do `HeatmapTable`. O pai calcula min/max e passa como props adicionais:

```tsx
// features/tuning/ve/VETab.tsx
const { min: colorMin, max: colorMax } = useMemo(
  () => globalMinMax(editableMap ?? []),
  [editableMap]
)

// Ambos os MapCharts recebem o mesmo colorMin/colorMax:
<MapChart data={editableMap} colorMin={colorMin} colorMax={colorMax} ... />
<MapChart data={editableMap} colorMin={colorMin} colorMax={colorMax} orientation="rpm_x_map" ... />
```

Isso garante que uma célula com valor 800 terá exatamente a mesma cor no heatmap ECharts e na tabela React.

---

## Orientações

### `map_x_rpm` (padrão, exibido à esquerda)

```
Eixo Y (MAP kPa) ↑         200 │ ███ ██▓ ██░ ...
                            180 │ ██▓ ███ ██▓ ...
                            ... │
                             10 │ ░░░ ░░░ ░░░ ...
                                └──────────────────→ Eixo X (RPM)
                                  400 800 1200 ...
```

### `rpm_x_map` (exibido à direita)

```
Eixo Y (RPM) ↑             6800 │ ███ ██▓ ██░ ...
                            6200 │ ██▓ ███ ██▓ ...
                             ... │
                             400 │ ░░░ ░░░ ░░░ ...
                                 └──────────────────→ Eixo X (MAP kPa)
                                   10  20  30 ...
```

As duas instâncias são exibidas lado a lado na seção Gráficos da aba VE. O hover em uma destaca a mesma célula na outra (via `highlightedCell` controlado pelo pai).

---

## Overlay de Scatter

Os pontos do log são plotados sobre o heatmap nas coordenadas **reais** de RPM e MAP, sem snap para breakpoints. Isso permite visualizar a distribuição real das amostras dentro de cada célula.

### Geração dos pontos a partir do datalog

```typescript
// Em VETab.tsx ou hook useVETuning.ts — calculado fora do MapChart
function buildOverlayPoints(
  rows: DatalogRow[],
  sampleCountMap: number[][],
  rpmBreakpoints: number[],
  mapBreakpoints: number[]
): ScatterPoint[] {
  // Máximo de amostras por célula para normalizar a opacidade
  const maxSamples = Math.max(...sampleCountMap.flat(), 1)

  return rows.map(row => {
    // Encontra a célula mais próxima para obter a contagem de amostras
    const rpmIdx = findClosestIndex(row.rpm, rpmBreakpoints)
    const mapIdx = findClosestIndex(row.mapKpa, mapBreakpoints)
    const density = sampleCountMap[mapIdx]?.[rpmIdx] / maxSamples ?? 0

    return {
      rpm: row.rpm,
      map_kpa: row.mapKpa,
      density: Math.max(0.05, Math.min(1, density)),  // mínimo 5% de opacidade
    }
  })
}
```

### Limitação de pontos

Para evitar poluição visual, é recomendável amostrar os pontos do overlay quando o log tem muitas linhas:

```typescript
function sampleOverlayPoints(points: ScatterPoint[], maxPoints: number = 2000): ScatterPoint[] {
  if (points.length <= maxPoints) return points
  const step = Math.ceil(points.length / maxPoints)
  return points.filter((_, i) => i % step === 0)
}
```

---

## Célula Destacada (`highlightedCell`)

A célula destacada recebe um tratamento especial via a API do ECharts. Como o ECharts não tem um mecanismo nativo de "destacar célula por índice externo", usamos a abordagem de adicionar uma `markArea` ou reconfigurar a ênfase:

```typescript
// Quando highlightedCell muda, o componente dispara uma action do ECharts
useEffect(() => {
  if (!chartRef.current || !highlightedCell) return

  const { row, col } = highlightedCell

  // Converter índice de célula para coordenadas do eixo
  const xVal = orientation === 'map_x_rpm'
    ? String(colLabels[col])   // RPM
    : String(rowLabels[row])   // MAP

  const yVal = orientation === 'map_x_rpm'
    ? String(rowLabels[row])   // MAP
    : String(colLabels[col])   // RPM

  chartRef.current.dispatchAction({
    type: 'highlight',
    seriesIndex: 0,
    dataIndex: highlightedCell
      ? data[0].length * highlightedCell.row + highlightedCell.col
      : undefined,
  })
}, [highlightedCell, orientation, rowLabels, colLabels])
```

Alternativamente, adicionar `markArea` com coordenadas da célula:

```typescript
// Abordagem via markArea — mais confiável que dispatchAction
const markArea = highlightedCell ? {
  silent: true,
  itemStyle: { borderColor: '#ffffff', borderWidth: 2, color: 'transparent' },
  data: [[
    { xAxis: String(xVal), yAxis: String(yVal) },
    { xAxis: String(xVal), yAxis: String(yVal) },
  ]],
} : undefined
```

---

## Tooltip ECharts

```typescript
function buildTooltipFormatter(
  orientation: 'map_x_rpm' | 'rpm_x_map',
  rowLabels: number[],
  colLabels: number[],
  overlayPoints?: ScatterPoint[]
) {
  return function(params: any) {
    if (params.seriesType === 'heatmap') {
      const [xIdx, yIdx, value] = params.data

      const rpm    = orientation === 'map_x_rpm' ? colLabels[xIdx] : colLabels[yIdx]
      const mapKpa = orientation === 'map_x_rpm' ? rowLabels[yIdx] : rowLabels[xIdx]

      // Estima amostras na região (se overlayPoints disponível)
      let samplesLine = ''
      if (overlayPoints && overlayPoints.length > 0) {
        // Conta pontos dentro dos limites da célula (usa half-step entre breakpoints)
        const nearbyPoints = overlayPoints.filter(pt =>
          Math.abs(pt.rpm - rpm) < 250 && Math.abs(pt.map_kpa - mapKpa) < 8
        )
        samplesLine = nearbyPoints.length > 0
          ? `<br/>Amostras nesta região: ~${nearbyPoints.length}`
          : ''
      }

      return `
        <div style="line-height: 1.8">
          <strong>RPM:</strong> ${rpm} &nbsp;|&nbsp;
          <strong>MAP:</strong> ${mapKpa} kPa<br/>
          <strong>Valor:</strong> ${value}${samplesLine}
        </div>
      `
    }
    return ''  // sem tooltip para pontos scatter
  }
}
```

---

## Eventos e Sincronização

### Captura de eventos do ECharts

```tsx
// MapChart.tsx
function MapChart({ onCellHover, onHoverEnd, onCellClick, orientation, rowLabels, colLabels, ...props }: MapChartProps) {
  const chartRef = useRef<EChartsInstance | null>(null)

  const onChartEvents = useMemo(() => ({
    mousemove: (params: any) => {
      if (params.seriesType !== 'heatmap') return
      const [xIdx, yIdx] = params.data

      // Converte de volta para índices row/col do mapa
      const row = orientation === 'map_x_rpm' ? yIdx : xIdx
      const col = orientation === 'map_x_rpm' ? xIdx : yIdx

      onCellHover?.(row, col)
    },
    mouseout: () => {
      onHoverEnd?.()
    },
    click: (params: any) => {
      if (params.seriesType !== 'heatmap') return
      const [xIdx, yIdx] = params.data
      const row = orientation === 'map_x_rpm' ? yIdx : xIdx
      const col = orientation === 'map_x_rpm' ? xIdx : yIdx
      onCellClick?.(row, col)
    },
  }), [onCellHover, onHoverEnd, onCellClick, orientation])

  return (
    <ReactECharts
      ref={chartRef}
      option={options}
      onEvents={onChartEvents}
      style={{ height: props.height ?? 300, width: '100%' }}
      notMerge={false}
      lazyUpdate={true}
    />
  )
}
```

### Sincronização bidirecional com HeatmapTable

O estado `highlightedCell` é gerenciado pelo componente pai (ex.: `VETab`):

```tsx
// features/tuning/ve/VETab.tsx — seção Gráficos
function ChartsSection() {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)

  const handleCellHover = useCallback((row: number, col: number) => {
    setHoveredCell({ row, col })
  }, [])

  const handleHoverEnd = useCallback(() => {
    setHoveredCell(null)
  }, [])

  return (
    <div className="grid grid-cols-2 gap-4">
      <MapChart
        data={editableMap}
        rowLabels={mapBreakpoints}
        colLabels={rpmBreakpoints}
        orientation="map_x_rpm"
        overlayPoints={overlayPoints}
        highlightedCell={hoveredCell}
        onCellHover={handleCellHover}
        onHoverEnd={handleHoverEnd}
        onCellClick={handleChartCellClick}
        height={300}
      />
      <MapChart
        data={editableMap}
        rowLabels={mapBreakpoints}
        colLabels={rpmBreakpoints}
        orientation="rpm_x_map"
        overlayPoints={overlayPoints}
        highlightedCell={hoveredCell}
        onCellHover={handleCellHover}
        onHoverEnd={handleHoverEnd}
        onCellClick={handleChartCellClick}
        height={300}
      />
    </div>
  )
}
```

Hover em qualquer dos dois MapCharts atualiza `hoveredCell`, que é passado para ambos e também para o `HeatmapTable` acima via `hoveredCell` prop. O HeatmapTable faz o caminho inverso: `onHover` → `setHoveredCell` → ambos os MapCharts recebem o highlight.

---

## Responsividade

O ECharts detecta mudanças no tamanho do container via `ResizeObserver` quando configurado com `option.responsive: true`. Para garantir o redimensionamento correto:

```tsx
// MapChart.tsx
useEffect(() => {
  if (!containerRef.current || !chartRef.current) return

  const observer = new ResizeObserver(() => {
    chartRef.current?.resize()
  })

  observer.observe(containerRef.current)
  return () => observer.disconnect()
}, [])

return (
  <div ref={containerRef} style={{ width: '100%' }}>
    <ReactECharts ... />
  </div>
)
```

Quando usado com `echarts-for-react`, o wrapper já gerencia o `resize` automaticamente via `onChartReady`. Verificar a versão da biblioteca usada.

---

## Integração com as Props do HeatmapTable

| Evento do MapChart | Efeito no HeatmapTable |
|-------------------|------------------------|
| `onCellHover(row, col)` | `hoveredCell` do HeatmapTable é atualizado → célula ganha borda branca |
| `onCellClick(row, col)` | `selectedCells` do HeatmapTable é atualizado → célula ganha outline azul |
| `onHoverEnd()` | `hoveredCell = null` → HeatmapTable remove highlight |

| Evento do HeatmapTable | Efeito no MapChart |
|------------------------|-------------------|
| `onHover(row, col)` | `highlightedCell` do MapChart é atualizado → célula ganha borda branca |
| `onHoverEnd()` | `highlightedCell = null` → MapChart remove highlight |
| `onCellClick(row, col)` | Não afeta diretamente o MapChart (seleção é gerenciada pelo HeatmapTable) |

---

## Exemplo de Uso Completo

```tsx
import { MapChart } from '@/components/MapChart'
import { useMapStore }    from '@/store/mapStore'
import { useTuningStore } from '@/store/tuningStore'
import { globalMinMax }   from '@/components/HeatmapTable/colorScales'
import { useMemo, useState, useCallback } from 'react'

function VEChartsSection() {
  const originalMap  = useMapStore(s => s.originalMap)
  const editableMap  = useMapStore(s => s.editableMap)
  const tuningOutput = useTuningStore(s => s.lastOutput)

  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)

  const { min: colorMin, max: colorMax } = useMemo(
    () => globalMinMax(editableMap ?? []),
    [editableMap]
  )

  const overlayPoints = useMemo(() => {
    if (!tuningOutput || !originalMap) return undefined
    // Gera pontos usando sampleCountMap para densidade
    // (lógica completa na seção "Overlay de Scatter")
    return buildOverlayPoints(/* ... */)
  }, [tuningOutput, originalMap])

  const handleCellHover = useCallback((row: number, col: number) => {
    setHoveredCell({ row, col })
  }, [])

  if (!editableMap || !originalMap) return null

  return (
    <section className="grid grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-2">MAP × RPM</h3>
        <MapChart
          data={editableMap}
          rowLabels={originalMap.mapBreakpoints}
          colLabels={originalMap.rpmBreakpoints}
          orientation="map_x_rpm"
          overlayPoints={overlayPoints}
          highlightedCell={hoveredCell}
          onCellHover={handleCellHover}
          onHoverEnd={() => setHoveredCell(null)}
          height={320}
        />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-2">RPM × MAP</h3>
        <MapChart
          data={editableMap}
          rowLabels={originalMap.mapBreakpoints}
          colLabels={originalMap.rpmBreakpoints}
          orientation="rpm_x_map"
          overlayPoints={overlayPoints}
          highlightedCell={hoveredCell}
          onCellHover={handleCellHover}
          onHoverEnd={() => setHoveredCell(null)}
          height={320}
        />
      </div>
    </section>
  )
}
```
