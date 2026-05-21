# Componente `SyncedChart`

Gráfico de linha ECharts da aba Gráficos. Múltiplos painéis configuráveis, cursor e zoom sincronizados entre painéis, tooltip unificado e integração bidirecional com o `TimeRail`.

**Arquivo:** `frontend/src/components/SyncedChart.tsx`

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
  /** Painéis em ordem vertical (top→bottom); todos compartilham o mesmo range de eixo X. */
  panels: ChartPanel[]
  cursor_ms: number | null   // do useTimeStore; markLine vertical em todos os painéis
  timeRange: { start_ms: number; end_ms: number }  // range do eixo X
  onCursorChange: (ms: number) => void             // pai persiste via useTimeStore.setCursor
  onPanelSignalsChange?: (panelId: string, signals: string[]) => void
  onAddPanel?: (afterPanelId: string, direction: 'horizontal' | 'vertical') => void
  onRemovePanel?: (panelId: string) => void        // desabilitado quando panels.length === 1
}
```

## Renderização

Pilha vertical de painéis, cada um com sua instância ECharts (canvas). Por painel:

- **Eixo X** — timestamps ms (`type: 'value'`, `min/max = timeRange`); labels só no painel inferior
- **Eixo Y** — esquerdo (`panel.yMin/yMax` ou auto); direito condicional, escala independente, para sinais de escalas díspares (RPM + Lambda no mesmo painel)
- **Séries** — uma `type: 'line'` por sinal (`symbol: 'none'`, `sampling: 'lttb'`, `large: true`); o `lttb` (Largest Triangle Three Buckets) faz downsampling visual preservando picos/vales — essencial para logs de 100k+ pontos
- **markLine** vermelha do cursor; atualizada por `setOption` parcial quando `cursor_ms` muda (não recalcula o resto)
- **legend** visível se há >1 sinal; **tooltip** `trigger: 'axis'`
- Resize responsivo via `ResizeObserver`

## Sincronização entre painéis

- **Zoom (eixo X)** — `echarts.connect(groupId)` sincroniza o estado visual de zoom entre painéis; o evento `datazoom`, porém, só dispara na instância que originou a interação (não é propagado às demais). Por isso o listener é registrado individualmente em cada instância via `registerChart`.
- **Cursor/tooltip** — gerenciados pelo container pai (não por `mouseenter`/`mouseleave` individuais, que causariam flash entre painéis): um React Context registra cada instância ECharts; o container converte px↔ms e dispara `showTip`/`hideTip` em todas as instâncias

## Integração com o `TimeRail` (`useTimeStore`)

Conceito unificado: **`selection`** representa simultaneamente o zoom dos gráficos e o intervalo de análise. É bidirecional:

- Scroll/pan num painel → evento `datazoom` → `setSelection(start, end)` (ou `clearSelection()` se voltou a ~100%)
- CTRL+drag num painel → retângulo azul semitransparente durante o drag → `setSelection` ao soltar (threshold mínimo ~200ms)
- Alteração de `selection` (ex.: drag no TimeRail) → `dispatchAction({ type: 'dataZoom' })` nos painéis
- `clearSelection` / Escape → painéis voltam a 0–100%

O `TimeRail` consome `selection` para o ViewportBand e a SelectionBand.

**Cursor:** clicar em qualquer painel chama `setCursor` na posição; com CTRL pressionado, mover o mouse atualiza o cursor continuamente.

## Tooltip

`trigger: 'axis'` sincroniza o disparo entre painéis. Cada painel formata as próprias séries: tempo (`MM:SS`, ou `HH:MM:SS` para logs > 1h) + uma linha por sinal com cor, nome e valor (3 casas para `λ`, 1 casa para os demais). ECharts interpola o valor no instante apontado.

## Configuração de sinais por painel

Cada painel tem uma barra de controle no topo:
- Chips dos sinais ativos (com `×` para remover)
- Dropdown para adicionar sinal (fonte: `useLogStore(selectAllSignals)`)
- Botões: `↔` divide lado a lado · `+ ↓` divide empilhado · `✕` remove painel (oculto quando é o único)

**`+ ↓`:** mede a altura atual do painel e a passa como `extraHeight` para `addChartPanel(panelId, 'vertical', extraHeight)`; a store insere o novo painel com split 0.5 e aumenta `chartsHeight` por `extraHeight`, mantendo ambos do mesmo tamanho.

## Paleta automática

Série sem `color` recebe a próxima cor de uma paleta fixa de 8 cores. Eixo direito (`yAxis: 'right'`) → `yAxisIndex: 1`; o pai define `yAxis` a partir do `DatalogModel`, o usuário não configura.

## Integração com `ChartsTab` / `useUIStore`

`ChartsTab` lê `chartsHeight` do `useUIStore` e renderiza o `SyncedChart` + uma alça de redimensionamento vertical no rodapé (clampada 200–1200px). `DatalogPage` tem `overflow-auto`.
