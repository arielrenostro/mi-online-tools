# Componente `SyncedChart`

Gráfico de linha ECharts para a aba Gráficos do Datalog. Suporta múltiplos painéis configuráveis pelo usuário, com cursor e zoom sincronizados entre todos os painéis, tooltip unificado e integração bidirecional com o cursor do `TimeRail`.

**Localização:** `frontend/src/components/SyncedChart/`  
**Arquivos:** `SyncedChart.tsx`, `ChartPanel.tsx`, `useSyncedChartLayout.ts`, `useEChartsSync.ts`, `chartPalette.ts`

---

## Props

```typescript
// src/components/SyncedChart/SyncedChart.tsx
import type { ChartLayout, ChartPanel as ChartPanelType, SignalSeries } from '@/types/ui'

/**
 * Série de sinal para um painel.
 * Cada série representa uma coluna do datalog ao longo do tempo.
 */
export interface SignalSeries {
  /** Nome do sinal — coincide com DatalogModel.signals. Ex.: "RPM", "Lambda 1". */
  name: string

  /** Unidade para exibição no eixo Y e tooltip. Ex.: "RPM", "kPa", "λ". */
  unit: string

  /** Array de [timestamp_ms, value] já ordenado cronologicamente. */
  data: [number, number][]

  /** Cor CSS. Se omitido, atribuído automaticamente da paleta global. */
  color?: string

  /** Eixo Y para esta série. Padrão: 'left'. */
  yAxis?: 'left' | 'right'
}

/**
 * Definição de um painel individual de gráfico.
 */
export interface ChartPanel {
  panelId: string

  /** Séries a exibir neste painel. */
  signals: SignalSeries[]

  /** Altura em pixels. Padrão: 200. */
  height?: number

  /** Range fixo do eixo Y. Se omitido, ECharts calcula automaticamente. */
  yMin?: number
  yMax?: number
}

export interface SyncedChartProps {
  /**
   * Lista de painéis. A ordem define a disposição vertical (top → bottom).
   * O layout horizontal (divisão lado a lado) é gerenciado pelo pai via ChartLayout.
   * O SyncedChart em si renderiza uma pilha vertical de painéis independentes
   * todos com o mesmo range do eixo X.
   */
  panels: ChartPanel[]

  /**
   * Instante atual do cursor em ms (vindo do useTimeStore).
   * Renderizado como markLine vertical em todos os painéis.
   */
  cursor_ms: number | null

  /**
   * Range temporal visível no eixo X.
   * Todos os painéis compartilham exatamente este range.
   * Se null, usa o range completo dos dados.
   */
  timeRange: { start_ms: number; end_ms: number }

  /**
   * Chamado quando o usuário move o mouse sobre qualquer painel.
   * O pai persiste via useTimeStore.setCursor — não persiste internamente.
   */
  onCursorChange: (ms: number) => void

  /**
   * Notifica que os sinais de um painel foram alterados via interface de configuração.
   * O pai atualiza o UIStore com o novo layout.
   */
  onPanelSignalsChange?: (panelId: string, signals: string[]) => void

  /**
   * Solicita divisão do painel no layout.
   * direction: 'horizontal' = divide lado a lado; 'vertical' = divide empilhado.
   * O pai atualiza o ChartLayout no UIStore.
   */
  onAddPanel?: (afterPanelId: string, direction: 'horizontal' | 'vertical') => void

  /**
   * Solicita remoção de um painel.
   * Desabilitado quando panels.length === 1.
   */
  onRemovePanel?: (panelId: string) => void
}
```

---

## Layout e Renderização

O `SyncedChart` renderiza uma pilha vertical de `ChartPanel`, cada um com sua própria instância de ECharts. A sincronização entre os painéis é feita via `echarts.connect(groupId)` — a API nativa do ECharts para sincronização de ação entre instâncias.

```tsx
// SyncedChart.tsx
const ECHART_GROUP_ID = 'synced-chart-group'

export function SyncedChart({
  panels, cursor_ms, timeRange, onCursorChange,
  onPanelSignalsChange, onAddPanel, onRemovePanel,
}: SyncedChartProps) {
  return (
    <div className="flex flex-col gap-0">
      {panels.map((panel, panelIndex) => (
        <SingleChartPanel
          key={panel.panelId}
          panel={panel}
          groupId={ECHART_GROUP_ID}
          cursor_ms={cursor_ms}
          timeRange={timeRange}
          isLast={panelIndex === panels.length - 1}
          isOnly={panels.length === 1}
          onCursorChange={onCursorChange}
          onSignalsChange={signals => onPanelSignalsChange?.(panel.panelId, signals)}
          onAddPanel={direction => onAddPanel?.(panel.panelId, direction)}
          onRemovePanel={() => onRemovePanel?.(panel.panelId)}
        />
      ))}
    </div>
  )
}
```

---

## Painel Individual

```tsx
// ChartPanel.tsx
function SingleChartPanel({
  panel, groupId, cursor_ms, timeRange,
  isLast, isOnly, onCursorChange,
  onSignalsChange, onAddPanel, onRemovePanel,
}: SingleChartPanelProps) {
  const chartRef = useRef<EChartsInstance | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Registra o grupo de sincronização ao montar
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.group = groupId
      echarts.connect(groupId)
    }
  }, [groupId])

  // Atualiza markLine quando cursor_ms muda (vindo do TimeRail)
  useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.setOption(buildMarkLineOption(cursor_ms), { replaceMerge: ['series'] })
  }, [cursor_ms])

  // Resize responsivo
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(() => chartRef.current?.resize())
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const options = useMemo(
    () => buildPanelOptions(panel, timeRange, cursor_ms, isLast),
    [panel, timeRange, cursor_ms, isLast]
  )

  return (
    <div className="relative border-b border-gray-700 last:border-b-0">
      {/* Barra de controle do painel */}
      <PanelControlBar
        panelId={panel.panelId}
        signals={panel.signals}
        onSignalsChange={onSignalsChange}
        onAddHorizontal={() => onAddPanel('horizontal')}
        onAddVertical={() => onAddPanel('vertical')}
        onRemove={onRemovePanel}
        isOnly={isOnly}
      />

      {/* Gráfico ECharts */}
      <div ref={containerRef} style={{ height: panel.height ?? 200 }}>
        <ReactECharts
          ref={chartRef}
          option={options}
          onEvents={{
            mousemove: (params: any) => {
              // Captura o timestamp quando o mouse está sobre o gráfico
              if (params.componentType === 'series' && params.data) {
                onCursorChange(params.data[0])
              }
            },
          }}
          style={{ width: '100%', height: '100%' }}
          notMerge={false}
          lazyUpdate={true}
        />
      </div>
    </div>
  )
}
```

---

## Configuração ECharts de um Painel

```typescript
// useEChartsSync.ts
function buildPanelOptions(
  panel: ChartPanel,
  timeRange: { start_ms: number; end_ms: number },
  cursor_ms: number | null,
  showXAxisLabels: boolean,
): EChartsOption {
  const hasRightAxis = panel.signals.some(s => s.yAxis === 'right')
  const palette = getAutoPalette(panel.signals)

  return {
    backgroundColor: '#111827',
    grid: {
      top: 8,
      right: hasRightAxis ? 60 : 20,
      bottom: showXAxisLabels ? 40 : 24,
      left: 60,
    },

    // Eixo X — sempre timestamps em ms
    xAxis: {
      type: 'value',
      min: timeRange.start_ms,
      max: timeRange.end_ms,
      axisLabel: showXAxisLabels ? {
        formatter: (val: number) => formatAxisTime(val),
        color: '#6b7280',
        fontSize: 10,
      } : { show: false },
      splitLine: { lineStyle: { color: '#1f2937' } },
      axisLine: { lineStyle: { color: '#374151' } },
    },

    // Eixo Y esquerdo
    yAxis: [
      {
        type: 'value',
        min: panel.yMin ?? 'dataMin',
        max: panel.yMax ?? 'dataMax',
        axisLabel: {
          color: '#6b7280',
          fontSize: 10,
          formatter: (val: number) => formatYAxisLabel(val),
        },
        splitLine: { lineStyle: { color: '#1f2937' } },
        axisLine: { show: false },
      },
      // Eixo Y direito (condicional)
      ...(hasRightAxis ? [{
        type: 'value' as const,
        min: 'dataMin',
        max: 'dataMax',
        axisLabel: { color: '#6b7280', fontSize: 10 },
        splitLine: { show: false },
      }] : []),
    ],

    // DataZoom — sincronizado entre painéis via group
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        startValue: timeRange.start_ms,
        endValue:   timeRange.end_ms,
        zoomOnMouseWheel: true,
        moveOnMouseMove: false,
      },
    ],

    // Tooltip unificado por eixo
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: { color: '#4b5563', width: 1, type: 'dashed' },
      },
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#f3f4f6', fontSize: 12 },
      formatter: buildTooltipFormatter(panel.signals),
    },

    // Legenda
    legend: {
      show: panel.signals.length > 1,
      top: 2,
      right: 10,
      textStyle: { color: '#9ca3af', fontSize: 10 },
      itemWidth: 12,
      itemHeight: 2,
    },

    // Séries de linha
    series: [
      // Séries de dados
      ...panel.signals.map((sig, i) => ({
        type: 'line' as const,
        name: sig.name,
        data: sig.data,
        yAxisIndex: sig.yAxis === 'right' ? 1 : 0,
        lineStyle: { color: palette[i], width: 1.5 },
        itemStyle: { color: palette[i] },
        symbol: 'none',
        sampling: 'lttb' as const,  // Largest Triangle Three Buckets — downsampling visual
        large: true,
        largeThreshold: 1000,
        smooth: false,
      })),

      // Série fantasma para a markLine do cursor (série sem dados visíveis)
      {
        type: 'line' as const,
        name: '__cursor__',
        data: [],
        markLine: cursor_ms !== null ? {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#ef4444', width: 1.5, type: 'solid' },
          data: [{ xAxis: cursor_ms }],
          label: { show: false },
        } : { data: [] },
      },
    ],
  }
}
```

---

## Sincronização de Cursor

A sincronização do cursor entre painéis usa dois mecanismos complementares:

### 1. ECharts `connect` (tooltip e axisPointer)

O `echarts.connect(groupId)` faz com que o axisPointer (linha vertical de hover) se mova em todos os painéis ao mesmo tempo quando o mouse está em qualquer um deles. Isso é gerenciado automaticamente pelo ECharts sem código adicional, desde que todos os gráficos pertençam ao mesmo grupo.

### 2. `markLine` controlado pelo `cursor_ms` do TimeStore

A markLine vermelha (cursor do TimeRail) é renderizada em todos os painéis via a opção `markLine` da série fantasma `__cursor__`. Quando `cursor_ms` muda (vindo do TimeRail ou do hover em qualquer painel), todos os painéis atualizam sua markLine.

```typescript
// Atualização parcial da option para apenas a markLine (evita re-render completo)
function buildMarkLineOption(cursor_ms: number | null): EChartsOption {
  return {
    series: [{
      name: '__cursor__',
      markLine: cursor_ms !== null ? {
        data: [{ xAxis: cursor_ms }],
      } : { data: [] },
    }],
  }
}

// No useEffect do painel:
useEffect(() => {
  chartRef.current?.setOption(buildMarkLineOption(cursor_ms), {
    replaceMerge: ['series'],
  })
}, [cursor_ms])
```

### Fluxo completo de sincronização

```
Usuário move mouse sobre Painel A
         │
         ▼
  onMouseMove do ECharts
         │
         ▼
  onCursorChange(timestamp_ms)
         │
         ▼
  useTimeStore.setCursor(ms)
         │
         ├─── TimeRail: cursor_ms → CursorLine se move
         │
         ├─── Painel A: markLine atualiza (via useEffect cursor_ms)
         ├─── Painel B: markLine atualiza
         └─── Painel C: markLine atualiza
```

---

## Sincronização de Zoom

O zoom via scroll e pan é sincronizado automaticamente pelo ECharts `connect` + `dataZoom`. Quando o usuário faz zoom em um painel, o `dataZoom` propaga para todos os outros do mesmo grupo.

**Importante:** o zoom sincronizado é puramente visual — ele NÃO chama `onSelectionChange` no `useTimeStore`. A seleção do TimeRail é uma operação explícita do usuário, não um zoom de visualização.

```typescript
// O range do dataZoom é inicializado com timeRange mas pode ser modificado pelo usuário
// O componente pai NÃO precisa ouvir mudanças de dataZoom — é estado local do ECharts
dataZoom: [{
  type: 'inside',
  startValue: timeRange.start_ms,
  endValue:   timeRange.end_ms,
}]
```

Quando `timeRange` muda (ex.: usuário altera a seleção no TimeRail), o painel reseta o dataZoom:

```typescript
useEffect(() => {
  chartRef.current?.dispatchAction({
    type: 'dataZoom',
    startValue: timeRange.start_ms,
    endValue: timeRange.end_ms,
  })
}, [timeRange])
```

---

## Tooltip

Cada painel exibe seu próprio tooltip com os valores das suas séries. O ECharts sincroniza o disparo dos tooltips entre painéis do mesmo grupo via `tooltip.trigger: 'axis'`.

```typescript
function buildTooltipFormatter(signals: SignalSeries[]) {
  return function(params: any[]) {
    if (!params.length) return ''

    const timestamp_ms = params[0]?.axisValue as number
    const timeLabel = formatAxisTime(timestamp_ms)

    const rows = params
      .filter(p => p.seriesName !== '__cursor__')
      .map(p => {
        const sig = signals.find(s => s.name === p.seriesName)
        const value = Array.isArray(p.data) ? p.data[1] : p.data

        // Interpolação linear entre os dois pontos mais próximos
        // (o ECharts já faz isso — value é o valor interpolado)
        const formatted = typeof value === 'number'
          ? value.toFixed(sig?.unit === 'λ' ? 3 : 1)
          : '—'

        return `
          <div style="display:flex; justify-content:space-between; gap:16px; color:#d1d5db">
            <span style="color:${p.color}">■</span>
            <span style="flex:1">${p.seriesName}</span>
            <span style="font-family:monospace; font-weight:600">${formatted} <span style="color:#6b7280">${sig?.unit ?? ''}</span></span>
          </div>
        `
      }).join('')

    return `
      <div style="background:#1f2937; border:1px solid #374151; border-radius:6px; padding:10px; min-width:160px">
        <div style="color:#9ca3af; font-size:11px; margin-bottom:6px; font-family:monospace">${timeLabel}</div>
        ${rows}
      </div>
    `
  }
}
```

---

## Configuração de Sinais por Painel

Cada painel tem uma barra de controle no topo com chips de sinais e um botão de adição:

```tsx
// PanelControlBar.tsx
function PanelControlBar({
  panelId, signals, onSignalsChange,
  onAddHorizontal, onAddVertical, onRemove, isOnly,
}: PanelControlBarProps) {
  const availableSensors = useLogStore(selectAllSignals)

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-gray-850 border-b border-gray-700">
      {/* Chips de sinais ativos */}
      <div className="flex flex-wrap gap-1 flex-1">
        {signals.map(sig => (
          <SignalChip
            key={sig.name}
            name={sig.name}
            color={sig.color}
            onRemove={() => onSignalsChange(signals.filter(s => s.name !== sig.name).map(s => s.name))}
          />
        ))}

        {/* Botão para adicionar sinal */}
        <AddSignalDropdown
          availableSensors={availableSensors}
          currentSignals={signals.map(s => s.name)}
          onAdd={sensor => onSignalsChange([...signals.map(s => s.name), sensor])}
        />
      </div>

      {/* Ações do painel */}
      <div className="flex items-center gap-1 flex-none">
        <button
          onClick={onAddHorizontal}
          title="Dividir lado a lado"
          className="text-gray-500 hover:text-gray-200 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700"
        >
          ↔
        </button>
        <button
          onClick={onAddVertical}
          title="Dividir empilhado"
          className="text-gray-500 hover:text-gray-200 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700"
        >
          ↕
        </button>
        {!isOnly && (
          <button
            onClick={onRemove}
            title="Remover painel"
            className="text-gray-600 hover:text-red-400 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
```

```tsx
// SignalChip.tsx
function SignalChip({ name, color, onRemove }: SignalChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: `${color}20`, color, borderColor: color, border: '1px solid' }}
    >
      {name}
      <button onClick={onRemove} className="hover:opacity-70">
        <span className="sr-only">Remover {name}</span>×
      </button>
    </span>
  )
}
```

---

## Paleta Automática de Cores

```typescript
// chartPalette.ts
const PALETTE = [
  '#60a5fa',  // blue-400
  '#f97316',  // orange-500
  '#34d399',  // emerald-400
  '#f472b6',  // pink-400
  '#a78bfa',  // violet-400
  '#fbbf24',  // amber-400
  '#2dd4bf',  // teal-400
  '#fb923c',  // orange-400
]

/**
 * Retorna uma paleta de cores para as séries do painel.
 * Usa a cor explícita da série se fornecida; caso contrário, usa a próxima da paleta.
 */
export function getAutoPalette(signals: SignalSeries[]): string[] {
  let paletteIndex = 0
  return signals.map(sig => {
    if (sig.color) return sig.color
    return PALETTE[paletteIndex++ % PALETTE.length]
  })
}
```

---

## Múltiplos Eixos Y

Quando uma série tem `yAxis: 'right'`, o ECharts cria um segundo eixo Y no painel:

```typescript
// No buildPanelOptions, a série com yAxis 'right' aponta para yAxisIndex: 1
series: [
  { name: 'RPM', yAxisIndex: 0, data: [...] },
  { name: 'MAP', yAxisIndex: 1, data: [...] },  // yAxis: 'right'
]

// Os dois eixos Y têm escalas independentes — não compartilham range
yAxis: [
  { type: 'value', name: 'RPM' },    // yAxisIndex 0 — esquerda
  { type: 'value', name: 'kPa' },    // yAxisIndex 1 — direita
]
```

O usuário não configura `yAxis` diretamente — o pai define isso a partir das propriedades dos sinais no `DatalogModel`. Por padrão, todos os sinais usam o eixo esquerdo. A configuração de eixo direito é reservada para sinais com escalas muito diferentes (ex.: RPM 0–7000 e Lambda 0.7–1.3 no mesmo painel).

---

## Eixo X Compartilhado

O label do eixo X é exibido apenas no **último painel** (painel mais abaixo), pois todos compartilham o mesmo range. Nos demais painéis, os ticks e grid ainda existem, mas o label textual é ocultado:

```typescript
// No buildPanelOptions:
xAxis: {
  axisLabel: showXAxisLabels ? {
    formatter: (val: number) => formatAxisTime(val),
    color: '#6b7280',
    fontSize: 10,
  } : {
    show: false,  // ticks ocultos, mas grid ainda renderizado
  },
}

// showXAxisLabels = (panelIndex === panels.length - 1)
```

```typescript
// timeRailUtils.ts — compartilhado com TimeRail
export function formatAxisTime(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
```

---

## Performance

O ECharts renderiza via canvas — eficiente para dezenas de milhares de pontos. Para séries muito densas, o `sampling: 'lttb'` reduz os pontos renderizados sem alterar visualmente o shape do sinal.

### LTTB (Largest Triangle Three Buckets)

```typescript
// Na série ECharts:
{
  type: 'line',
  sampling: 'lttb',  // ECharts 5+ suporta nativamente
  data: sig.data,    // pode ter 100k+ pontos — ECharts faz o downsampling
}
```

O LTTB preserva os picos, vales e inflexões mais visualmente significativos. Para o datalog de ECU (RPM, MAP, Lambda), que tipicamente tem alta frequência de amostragem, isso é essencial para performance sem perda de informação visual.

### Atualização Parcial de Opções

Para evitar re-renderizar todo o gráfico quando apenas o cursor muda, usar `setOption` com `replaceMerge`:

```typescript
// Apenas atualiza a série do cursor — não recalcula o resto
chartRef.current?.setOption({
  series: [{ name: '__cursor__', markLine: { data: [{ xAxis: cursor_ms }] } }]
}, { replaceMerge: ['series'] })
```

---

## Integração com `ChartsTab` e `useUIStore`

```tsx
// features/datalog/charts/ChartsTab.tsx
import { SyncedChart } from '@/components/SyncedChart'
import { useTimeStore }  from '@/store/timeStore'
import { useUIStore }    from '@/store/uiStore'
import { useLogStore, selectAllRows, selectAllSignals } from '@/store/logStore'

function ChartsTab() {
  const cursor_ms    = useTimeStore(s => s.cursor_ms)
  const selection    = useTimeStore(s => s.selection)
  const setCursor    = useTimeStore(s => s.setCursor)
  const chartLayout  = useUIStore(s => s.chartLayout)
  const updateLayout = useUIStore(s => s.setChartLayout)
  const allRows      = useLogStore(selectAllRows)
  const allSignals   = useLogStore(selectAllSignals)

  // Converte o ChartLayout em flat list de panels para o SyncedChart
  const panels = useMemo<ChartPanel[]>(() => {
    return flattenLayout(chartLayout).map(panel => ({
      panelId: panel.panelId,
      height: 200,
      signals: panel.signals.map(sigName => {
        const data = extractSignalData(allRows, sigName)
        return {
          name: sigName,
          unit: getSignalUnit(sigName),
          data,
          color: getSignalColor(sigName),
        }
      }),
    }))
  }, [chartLayout, allRows])

  // Range temporal: seleção do TimeRail ou range completo
  const timeRange = useMemo(() => {
    if (selection) return selection
    const totalDuration = allRows[allRows.length - 1]?.timestamp_ms ?? 0
    return { start_ms: 0, end_ms: totalDuration }
  }, [selection, allRows])

  return (
    <div className="h-full overflow-auto">
      {panels.length === 0 ? (
        <EmptyChartsPlaceholder onAdd={() => updateLayout(createInitialLayout())} />
      ) : (
        <SyncedChart
          panels={panels}
          cursor_ms={cursor_ms}
          timeRange={timeRange}
          onCursorChange={setCursor}
          onPanelSignalsChange={(panelId, signals) => {
            updateLayout(updatePanelSignals(chartLayout, panelId, signals))
          }}
          onAddPanel={(afterPanelId, direction) => {
            updateLayout(splitPanel(chartLayout, afterPanelId, direction))
          }}
          onRemovePanel={panelId => {
            updateLayout(removePanel(chartLayout, panelId))
          }}
        />
      )}
    </div>
  )
}
```

---

## Exemplo de Uso Mínimo

```tsx
// Uso simplificado com um único painel
import { SyncedChart } from '@/components/SyncedChart'

function SimpleExample() {
  const [cursor_ms, setCursor] = useState<number | null>(null)

  const panels: ChartPanel[] = [{
    panelId: 'panel-1',
    height: 250,
    signals: [
      {
        name: 'RPM',
        unit: 'RPM',
        data: rpmData,       // [timestamp_ms, rpm][]
        color: '#60a5fa',
      },
      {
        name: 'MAP',
        unit: 'kPa',
        data: mapData,       // [timestamp_ms, map_kpa][]
        color: '#f97316',
        yAxis: 'right',      // eixo direito — escala independente
      },
    ],
  }]

  return (
    <SyncedChart
      panels={panels}
      cursor_ms={cursor_ms}
      timeRange={{ start_ms: 0, end_ms: 900000 }}  // 15 min
      onCursorChange={setCursor}
    />
  )
}
```
