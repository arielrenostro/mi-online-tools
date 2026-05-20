# Componentes `MapChart` e `MapWithChart`

- **`MapChart`** — gráfico ECharts standalone (2D linhas ou 3D superfície)
- **`MapWithChart`** — wrapper que combina `HeatmapTable` + `MapChart` lado a lado, com sincronização de seleção e largura ajustável por drag

**Localizações:** `components/MapChart/` (`MapChart.tsx`, `useMapChartOptions.ts`, `mapChart3DOptions.ts`, `index.ts`) · `components/MapWithChart/` (`MapWithChart.tsx`, `index.ts`)

## `MapWithChart`

Substitui um `<HeatmapTable>` adicionando o gráfico ao lado. Interface idêntica + prop `chartHeight`.

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
  chartHeight?:   number  // padrão 340
}
```

Layout: `HeatmapTable` (esquerda) `│ ↕ │` drag handle `│` `MapChart` (direita). Arrastar para a esquerda expande o gráfico.

### Proporção (localStorage)

Chave `miot:map-chart-ratio` (float 0.15–0.75). Padrão **0.5**. Salva ao soltar o drag handle.

### Cálculo de `cellWidth`

Evita scroll horizontal ao estreitar a tabela:

```ts
const STICKY_PX = 80  // largura estimada da coluna sticky "MAP↓/RPM→"
const tablePx   = containerWidth * (1 - chartRatio) - 12  // -12 = drag handle
const cellWidth = tablePx > STICKY_PX
  ? Math.max(24, (tablePx - STICKY_PX) / colHeaders.length)
  : undefined
```

Quando `cellWidth` é definido, `HeatmapTable` usa `overflow-hidden` (sem scrollbar).

### Sincronização de seleção

- **Tabela → gráfico:** `MapWithChart` gerencia `selectedCells: Set<string>` ("row:col"). `HeatmapTable` dispara `onSelectionChange(anchor, selEnd)`; `MapWithChart` computa o range e passa `selectedCells` para `MapChart`. 2D: pontos selecionados ganham dot azul maior; 3D: esferas azuis (`scatter3D`).
- **Gráfico → tabela:** clicar num ponto 2D dispara `onChartCellClick(cells)`. **Box select**: arrastar em área vazia desenha um retângulo (estilo Windows); ao soltar, `MapChart` converte posições com `convertToPixel({ gridIndex: 0 }, [xi, val])` e seleciona os pontos dentro. Clicar num símbolo **não** inicia box select — distinção via flag `symbolHitRef` setado no `mousedown` do ECharts.
- `MapWithChart.handleChartCellClick` converte o `Set<string>` em bounding-box (minRow/maxRow/minCol/maxCol), seta `externalSelection: { anchor, selEnd }` → `HeatmapTable` aplica via `useEffect` (`setAnchor`/`setSelEnd` + foca o container). Após a seleção, `Ctrl+I/U/F2` funcionam imediatamente.

### Edição por drag no gráfico 2D

Arrastar um ponto verticalmente: `mousedown` no ponto → `dragRef` registra `{row, col}`; `window.mousemove` → `convertFromPixel({ gridIndex: 0 }, [pixX, pixY])` mapeia pixel Y → valor VE → `onCellChange(row, col, newVal)`; `window.mouseup` → limpa `dragRef`.

## `MapChart`

```typescript
interface MapChartProps {
  data:               number[][]   // cells[row][col], row 0 = menor MAP
  rowLabels:          number[]     // MAP breakpoints (kPa)
  colLabels:          number[]     // RPM breakpoints
  selectedCells?:     Set<string>  // "row:col" — dot azul
  height?:            number       // padrão 340
  onCellChange?:      (row: number, col: number, value: number) => void
  onChartCellClick?:  (cells: Set<string>) => void
}
```

### Estado interno + persistência

```typescript
const [orientation, setOrientation] = useStickyState<Orientation>('miot:map-chart-orientation', 'map_x_rpm')
const [mode, setMode]               = useStickyState<Mode>('miot:map-chart-mode', '2d')
```

`useStickyState` lê do localStorage e persiste ao alterar.

Switches no topo: Orientação `MAP×RPM`/`RPM×MAP` · Modo `2D`/`3D`.

| Chave localStorage | Tipo | Padrão |
|--------------------|------|--------|
| `miot:map-chart-orientation` | `'map_x_rpm' \| 'rpm_x_map'` | `'map_x_rpm'` |
| `miot:map-chart-mode` | `'2d' \| '3d'` | `'2d'` |
| `miot:map-chart-ratio` | string (float 0.15–0.75) | `'0.5'` |

## Modo 2D (`useMapChartOptions.ts`)

`build2DOptions(data, rowLabels, colLabels, orientation, selectedCells): EChartsOption`

- **`map_x_rpm`**: X = RPM (category), Y = VE (value), uma linha por MAP (16 séries)
- **`rpm_x_map`**: X = MAP (category), Y = VE (value), uma linha por RPM (16 séries)
- **Cores**: gradiente warm (`#3b82f6 → #22c55e → #eab308 → #ef4444`) interpolado entre as N séries
- **Símbolos**: selecionados `symbolSize: 7`, cor `#60a5fa`; não-selecionados `symbolSize: 3`, cor da série, `opacity: 0.5` (necessário para ECharts disparar eventos de mouse)
- **Eixo Y**: `min = floor(allMin - 5%)`, `max = ceil(allMax + 5%)`
- Tooltip `trigger: 'axis'` — RPM/MAP + valores VE de todas as séries na linha do cursor

## Modo 3D (`mapChart3DOptions.ts`)

`build3DOptions(data, rowLabels, colLabels, orientation, colorMin, colorMax, selectedCells)` — usa `import 'echarts-gl'` (registra `surface` e `scatter3D`; sem tipos TS oficiais).

- Série principal `type: 'surface'` com `wireframe: { show: true }`
- Eixos `'value'` com RPM/MAP reais; dados `[[x, y, z], ...]` (x/y reais, z = VE)
- Eixo Z + visualMap: `min = colorMin - 5%`, `max = colorMax + 5%`
- Seleção: série `scatter3D` sobreposta, cor `#60a5fa`

## `HeatmapTable` — props adicionados para integração

```typescript
onSelectionChange?: (anchor: { r: number; c: number } | null,
                     selEnd: { r: number; c: number } | null) => void
cellWidth?: number               // largura por coluna em px; overflow-hidden quando definido
externalSelection?: {            // impõe anchor/selEnd internos e foca o container
  anchor: { r: number; c: number }
  selEnd?: { r: number; c: number } | null
} | null
```

## Uso

```tsx
import MapWithChart from '@/components/MapWithChart'

// Drop-in replacement de HeatmapTable
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

## Futuro (fora de escopo)

- Overlay de scatter — pontos do datalog sobre o gráfico (`ScatterPoint[]`)
- Hover sync — mover o mouse no gráfico destaca a célula na tabela
