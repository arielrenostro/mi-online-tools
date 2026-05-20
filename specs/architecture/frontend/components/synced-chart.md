# Componente `SyncedChart`

Gráfico de linha ECharts para a aba Gráficos. Múltiplos painéis configuráveis, cursor e zoom sincronizados entre painéis, tooltip unificado e integração bidirecional com o cursor do `TimeRail`.

**Localização:** `frontend/src/components/SyncedChart/` — `SyncedChart.tsx`, `ChartPanel.tsx`, `useSyncedChartLayout.ts`, `useEChartsSync.ts`, `chartPalette.ts`

## Props

```typescript
/** Série de sinal — uma coluna do datalog ao longo do tempo. */
export interface SignalSeries {
  name:   string             // coincide com DatalogModel.signals. Ex: "RPM"
  unit:   string             // exibição no eixo Y/tooltip. Ex: "kPa", "λ"
  data:   [number, number][] // [timestamp_ms, value], ordenado
  color?: string             // CSS; auto da paleta se omitido
  yAxis?: 'left' | 'right'   // padrão 'left'
}

export interface ChartPanel {
  panelId: string
  signals: SignalSeries[]
  height?: number            // padrão 200
  yMin?: number              // range fixo do eixo Y; auto se omitido
  yMax?: number
}

export interface SyncedChartProps {
  /** Painéis em ordem vertical (top→bottom). O layout horizontal é gerenciado pelo
   *  pai via ChartLayout; o SyncedChart renderiza uma pilha vertical, todos com o
   *  mesmo range de eixo X. */
  panels: ChartPanel[]
  cursor_ms: number | null   // do useTimeStore; markLine vertical em todos os painéis
  timeRange: { start_ms: number; end_ms: number }  // range do eixo X (todos os painéis)
  onCursorChange: (ms: number) => void              // pai persiste via useTimeStore.setCursor
  onPanelSignalsChange?: (panelId: string, signals: string[]) => void
  onAddPanel?: (afterPanelId: string, direction: 'horizontal' | 'vertical') => void
  onRemovePanel?: (panelId: string) => void         // desabilitado quando panels.length === 1
}
```

## Layout e renderização

`SyncedChart` renderiza uma pilha vertical de `ChartPanel`, cada um com sua instância ECharts. Sincronização de zoom via `echarts.connect(groupId)` (API nativa). Cada `SingleChartPanel`:

- Registra o grupo no mount: `chartRef.current.group = groupId; echarts.connect(groupId)`
- Atualiza a markLine quando `cursor_ms` muda (`setOption` + `replaceMerge: ['series']`)
- Resize responsivo via `ResizeObserver`
- `onEvents.mousemove` → `if (params.componentType === 'series' && params.data) onCursorChange(params.data[0])`

## Configuração ECharts de um painel (`useEChartsSync.ts`)

`buildPanelOptions(panel, timeRange, cursor_ms, showXAxisLabels): EChartsOption`

- `backgroundColor: '#111827'`; grid com `right` maior se há eixo Y direito
- **Eixo X** — sempre timestamps ms; `type: 'value'`, `min/max = timeRange`; labels só se `showXAxisLabels`
- **Eixo Y** — esquerdo (`min: panel.yMin ?? 'dataMin'`, `max: panel.yMax ?? 'dataMax'`); direito condicional (`hasRightAxis`), escala independente
- **dataZoom** — `type: 'inside'`, `xAxisIndex: 0`, `startValue/endValue = timeRange`, `zoomOnMouseWheel: true`; sincronizado entre painéis via group
- **tooltip** — `trigger: 'axis'`, `axisPointer` tracejado, `formatter: buildTooltipFormatter(panel.signals)`
- **legend** — visível se `signals.length > 1`
- **séries** — uma `type: 'line'` por sinal (`yAxisIndex` 0/1, `symbol: 'none'`, `sampling: 'lttb'`, `large: true`, `largeThreshold: 1000`) + uma série fantasma `__cursor__` carregando a `markLine` vermelha do cursor

## Sincronização de cursor (hover)

Para evitar flash ao mover o mouse rápido entre painéis, usa um mecanismo de container (não `mouseleave`/`mouseenter` individual):

- **`ChartSyncContext`** — `Map<panelId, EChartsInstance>` via React Context; cada painel registra/desregistra a instância no mount/unmount
- **Container `onPointerMove`** — itera as instâncias para achar qual está sob o ponteiro; converte px→ms (`convertFromPixel({ xAxisIndex: 0 }, [x, 0])`); para cada outra instância converte ms→px e dispara `dispatchAction({ type: 'showTip', x, y })`
- **Container `onPointerLeave`** — `dispatchAction({ type: 'hideTip' })` em todas
- **`echarts.connect(GROUP_ID)`** — usado **apenas** para sincronizar `dataZoom`
- **`markLine`** — cursor vermelho do TimeRail, na primeira série de cada painel; atualizada via `useEffect` quando `cursor_ms` muda

## Sincronização de zoom com o TimeRail

Zoom (scroll) em qualquer painel → evento `datazoom` capturado → propagado ao `useTimeStore`:

```typescript
inst.on('datazoom', (params) => {
  const start = params.batch?.[0]?.startValue ?? params.startValue
  const end   = params.batch?.[0]?.endValue   ?? params.endValue
  if (start == null || end == null) { clearChartZoom(); return }
  if ((end - start) / totalRange > 0.99) { clearChartZoom(); return }  // ~100% → zoom padrão
  setChartZoom(start, end)
})
```

`timeStore.chartZoom` é consumido pelo `TimeRail` para o **viewport band** (overlay escuro fora do zoom). O zoom é puramente visual — **não** modifica `timeStore.selection`.

## Tooltip

Cada painel exibe seu tooltip com os valores das próprias séries (ECharts sincroniza o disparo via `trigger: 'axis'`).

```typescript
function buildTooltipFormatter(signals: SignalSeries[]) {
  return function(params: any[]) {
    if (!params.length) return ''
    const timeLabel = formatAxisTime(params[0]?.axisValue as number)
    const rows = params
      .filter(p => p.seriesName !== '__cursor__')
      .map(p => {
        const sig = signals.find(s => s.name === p.seriesName)
        const value = Array.isArray(p.data) ? p.data[1] : p.data
        // ECharts já interpola — value é o valor interpolado
        const formatted = typeof value === 'number'
          ? value.toFixed(sig?.unit === 'λ' ? 3 : 1) : '—'
        return `<linha com cor, nome e ${formatted} ${sig?.unit ?? ''}>`
      }).join('')
    return `<container com ${timeLabel} e ${rows}>`
  }
}
```

## Configuração de sinais por painel (`PanelControlBar`)

Cada painel tem uma barra de controle no topo:
- Chips dos sinais ativos (`SignalChip` com `×` para remover)
- `AddSignalDropdown` — adicionar sinal a partir de `useLogStore(selectAllSignals)`
- Botões `↔` (dividir lado a lado), `↕` (dividir empilhado), `✕` (remover painel — oculto quando `isOnly`)

## Paleta automática (`chartPalette.ts`)

```typescript
const PALETTE = ['#60a5fa', '#f97316', '#34d399', '#f472b6',
                 '#a78bfa', '#fbbf24', '#2dd4bf', '#fb923c']

/** Cor explícita da série se houver; senão a próxima da paleta. */
export function getAutoPalette(signals: SignalSeries[]): string[] {
  let i = 0
  return signals.map(sig => sig.color ?? PALETTE[i++ % PALETTE.length])
}
```

## Múltiplos eixos Y

Série com `yAxis: 'right'` aponta para `yAxisIndex: 1` — segundo eixo Y com escala independente. O usuário não configura `yAxis` diretamente; o pai define a partir do `DatalogModel`. Padrão: todos no eixo esquerdo. Eixo direito é para sinais de escalas muito diferentes (RPM 0–7000 + Lambda 0.7–1.3 no mesmo painel).

## Eixo X compartilhado

Label do eixo X em todos os painéis. Formato `MM:SS` (zero-padded), ou `HH:MM:SS` para logs > 1 h. Mesmo formatter no tooltip.

```typescript
function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return h > 0
    ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}
// 80000ms → "01:20" | 3725000ms → "01:02:05"
```

## Performance

- Canvas — eficiente para dezenas de milhares de pontos
- `sampling: 'lttb'` (Largest Triangle Three Buckets) — downsampling visual que preserva picos/vales/inflexões; essencial para datalogs de alta frequência (pode ter 100k+ pontos)
- Atualização parcial: para mudar só o cursor, `setOption({ series: [{ name: '__cursor__', markLine: {...} }] }, { replaceMerge: ['series'] })` — não recalcula o resto

## Integração com `ChartsTab` e `useUIStore`

`ChartsTab` lê `chartsHeight` do `useUIStore` e renderiza `SyncedChart` + um `ResizeHandle` (alça de drag vertical no rodapé, `Math.max(200, Math.min(1200, ...))`). O `DatalogPage` tem `overflow-auto` — quando `chartsHeight` excede o espaço, a página scrolla.

## Exemplo mínimo

```tsx
const panels: ChartPanel[] = [{
  panelId: 'panel-1', height: 250,
  signals: [
    { name: 'RPM', unit: 'RPM', data: rpmData, color: '#60a5fa' },
    { name: 'MAP', unit: 'kPa', data: mapData, color: '#f97316', yAxis: 'right' },
  ],
}]

<SyncedChart panels={panels} cursor_ms={cursor_ms}
  timeRange={{ start_ms: 0, end_ms: 900000 }} onCursorChange={setCursor} />
```
