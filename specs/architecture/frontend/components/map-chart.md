# Componentes `MapChart` e `MapWithChart`

Dois componentes complementares para visualização de mapas da ECU.

- **`MapChart`** — gráfico ECharts standalone (2D linhas ou 3D superfície)
- **`MapWithChart`** — wrapper reutilizável que combina `HeatmapTable` + `MapChart` lado a lado, com sincronização de seleção e largura ajustável via drag

**Localizações:**
- `frontend/src/components/MapChart/` — `MapChart.tsx`, `useMapChartOptions.ts`, `mapChart3DOptions.ts`, `index.ts`
- `frontend/src/components/MapWithChart/` — `MapWithChart.tsx`, `index.ts`

---

## `MapWithChart`

Componente reutilizável que substitui um `<HeatmapTable>` adicionando o gráfico ao lado. Interface idêntica ao `HeatmapTable`, com um prop adicional `chartHeight`.

```typescript
interface MapWithChartProps {
  cells:          (number | boolean | null)[][]
  rowHeaders:     number[]
  colHeaders:     number[]
  colorScale?:    ColorScale
  readOnly?:      boolean
  onCellChange?:  (row: number, col: number, value: number) => void
  onBulkChange?:  (changes: { row: number; col: number; value: number }[]) => void
  modifiedCells?: Set<string>
  formatValue?:   (v: number | boolean | null) => string
  chartHeight?:   number  // padrão: 340
}
```

Layout com drag handle redimensionável:
```
┌─────────────────────────────┐ │ ┌──────────────────────┐
│  HeatmapTable               │ ↕ │  [MAP×RPM][RPM×MAP]  │
│  (overflow-hidden)          │   │  [   2D  ][   3D  ]  │
│  flexBasis: (1-ratio)%      │   │  MapChart            │
└─────────────────────────────┘   │  flexBasis: ratio%   │
                                   └──────────────────────┘
```

O `│ ↕ │` representa o drag handle — arrastar para esquerda expande o gráfico, para direita expande a tabela.

### Proporção salva no localStorage

Chave `miot:map-chart-ratio` (float 0.15–0.75). Padrão: **0.5** (50/50). Salva ao soltar o drag handle (`mouseup`).

### Cálculo de `cellWidth`

Para evitar scroll horizontal ao estreitar a tabela:

```ts
const STICKY_PX = 80  // largura estimada da coluna sticky "MAP↓/RPM→"
const tablePx   = containerWidth * (1 - chartRatio) - 12  // -12 = drag handle
const cellWidth = tablePx > STICKY_PX
  ? Math.max(24, (tablePx - STICKY_PX) / colHeaders.length)
  : undefined
```

Quando `cellWidth` é fornecido, `HeatmapTable` usa `overflow-hidden` (sem scrollbar).

### Sincronização de seleção — tabela → gráfico

`MapWithChart` gerencia `selectedCells: Set<string>` ("row:col") internamente.

- `HeatmapTable` recebe `onSelectionChange(anchor, selEnd)` — disparado por `useEffect` quando a seleção muda
- `MapWithChart` computa o range e passa `selectedCells` para `MapChart`
- Em 2D: pontos selecionados ganham dot azul maior nas linhas
- Em 3D: pontos selecionados ganham esferas azuis (`scatter3D`) sobrepostas à superfície

### Sincronização de seleção — gráfico → tabela

**Clique em ponto**: clicar num símbolo do gráfico 2D dispara `onChartCellClick(cells)` em `MapChart`.

**Seleção por retângulo (box select)**: arrastar em área vazia do gráfico 2D desenha um retângulo de seleção (estilo Windows). Ao soltar, `MapChart` itera todos os pontos, converte suas posições com `convertToPixel({ gridIndex: 0 }, [xi, val])` e seleciona aqueles dentro do retângulo. Chama `onChartCellClick(selectedSet)` com o conjunto resultante. Um overlay `<div>` com borda `#60a5fa` e fundo semitransparente visualiza o retângulo durante o arrasto.

Clicar num símbolo (elemento ECharts) **não** inicia box select — a distinção é feita via event bubbling: o evento ECharts `mousedown` dispara primeiro e seta um flag `symbolHitRef`; o `onMouseDown` do div container checa esse flag.

Tanto o clique quanto o box select chegam em `MapWithChart` como `onChartCellClick`:
- `MapWithChart.handleChartCellClick` converte o `Set<string>` em bounding-box (minRow, maxRow, minCol, maxCol)
- Seta `externalSelection: { anchor, selEnd }` → passado para `HeatmapTable` via prop `externalSelection`
- `HeatmapTable` aplica a seleção internamente via `useEffect`: chama `setAnchor`/`setSelEnd` e foca o container
- A seleção passa pelo caminho normal (`onSelectionChange` → `handleSelectionChange` → `selectedCells` → MapChart dots)
- Células ficam com fundo azul + borda azul no anchor, idêntico à navegação pela tabela
- Após a seleção, Ctrl+I/U/F2 funcionam imediatamente

### Edição por drag no gráfico 2D

`MapWithChart` passa `onCellChange` para `MapChart`. Ao arrastar um ponto verticalmente:
- ECharts dispara `mousedown` no ponto → `dragRef` registra `{row, col}`
- `window.mousemove` → `convertFromPixel({ gridIndex: 0 }, [pixX, pixY])` mapeia pixel Y → valor VE
- `onCellChange(row, col, newVal)` é chamado a cada movimento
- `window.mouseup` → `dragRef` é limpo

---

## `MapChart`

### Props

```typescript
interface MapChartProps {
  data:               number[][]   // cells[row][col], row 0 = menor MAP
  rowLabels:          number[]     // MAP breakpoints (kPa)
  colLabels:          number[]     // RPM breakpoints
  selectedCells?:     Set<string>  // "row:col" — células com dot azul
  height?:            number       // padrão: 340
  onCellChange?:      (row: number, col: number, value: number) => void
  onChartCellClick?:  (cells: Set<string>) => void
}
```

### Estado interno + persistência

```typescript
const [orientation, setOrientation] = useStickyState<Orientation>('miot:map-chart-orientation', 'map_x_rpm')
const [mode,        setMode]        = useStickyState<Mode>('miot:map-chart-mode', '2d')
```

`useStickyState` lê o valor inicial do localStorage e persiste automaticamente ao alterar. Padrão: `'map_x_rpm'` + `'2d'`.

### Switches no topo

- **Orientação**: `MAP×RPM` | `RPM×MAP`
- **Modo**: `2D` | `3D`

### localStorage keys

| Chave | Tipo | Padrão |
|-------|------|--------|
| `miot:map-chart-orientation` | `'map_x_rpm' \| 'rpm_x_map'` | `'map_x_rpm'` |
| `miot:map-chart-mode` | `'2d' \| '3d'` | `'2d'` |
| `miot:map-chart-ratio` | string (float 0.15–0.75) | `'0.5'` |

---

## `useMapChartOptions.ts` — Modo 2D (linhas)

```typescript
export function build2DOptions(
  data:          number[][],
  rowLabels:     number[],
  colLabels:     number[],
  orientation:   'map_x_rpm' | 'rpm_x_map',
  selectedCells: Set<string>,
): EChartsOption
```

**`map_x_rpm`**: eixo X = RPM (category), eixo Y = VE (value), **uma linha por condição de MAP** (16 séries).  
**`rpm_x_map`**: eixo X = MAP (category), eixo Y = VE (value), **uma linha por condição de RPM** (16 séries).

**Cores**: gradiente warm (`#3b82f6 → #22c55e → #eab308 → #ef4444`) interpolado entre as N séries.

**Símbolos nos pontos**:
- Selecionados: `symbolSize: 7`, `itemStyle.color: '#60a5fa'` (azul)
- Não-selecionados: `symbolSize: 3`, `itemStyle.color: <cor-da-série>`, `opacity: 0.5` — necessário para ECharts disparar eventos de mouse

**Eixo Y**: `min = floor(allMin - 5%)`, `max = ceil(allMax + 5%)` — margem de 5% além dos dados.

Tooltip: `trigger: 'axis'` — exibe RPM ou MAP + valores VE de todas as séries na linha do cursor.

---

## `mapChart3DOptions.ts` — Modo 3D (superfície)

```typescript
import 'echarts-gl'  // side-effect: registra 'surface' e 'scatter3D'

export function build3DOptions(
  data:          number[][],
  rowLabels:     number[],
  colLabels:     number[],
  orientation:   'map_x_rpm' | 'rpm_x_map',
  colorMin:      number,
  colorMax:      number,
  selectedCells: Set<string>,
): any  // echarts-gl não tem tipos TypeScript oficiais
```

Série principal: `type: 'surface'` com `wireframe: { show: true }`.  
Eixos de tipo `'value'` com os valores reais de RPM e MAP (não categoria).  
Dados: `[[x, y, z], ...]` onde x/y são os valores reais dos breakpoints e z é o valor VE.

**Eixo Z + visualMap**: `min = colorMin - 5%`, `max = colorMax + 5%` — margem de 5% além dos dados.

**Destaque de seleção**: série `scatter3D` sobreposta com `itemStyle.color: '#60a5fa'`.

---

## `HeatmapTable` — props adicionados para integração

```typescript
onSelectionChange?: (
  anchor: { r: number; c: number } | null,
  selEnd: { r: number; c: number } | null
) => void

cellWidth?: number         // largura por coluna em px; usa overflow-hidden quando definido
externalSelection?: {      // impõe anchor/selEnd internos e foca o container
  anchor: { r: number; c: number }
  selEnd?: { r: number; c: number } | null
} | null
```

---

## Uso

```tsx
import MapWithChart from '@/components/MapWithChart'

// Drop-in replacement para HeatmapTable — mesma interface
<MapWithChart
  cells={editableMap}
  rowHeaders={originalMap.mapBreakpoints}
  colHeaders={originalMap.rpmBreakpoints}
  colorScale="warm"
  onCellChange={updateCell}
  onBulkChange={bulkUpdateCells}
  modifiedCells={modifiedCells}
/>
```

---

## Futuro (fora do escopo atual)

- **Overlay de scatter** — pontos do datalog plotados sobre o gráfico (`ScatterPoint[]` em `src/types/ui.ts`)
- **Hover sync** — mover o mouse no gráfico destaca a célula na tabela
