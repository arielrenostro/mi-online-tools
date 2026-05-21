# Componentes `MapChart` e `MapWithChart`

- **`MapChart`** — gráfico ECharts standalone (2D linhas ou 3D superfície)
- **`MapWithChart`** — wrapper que combina `HeatmapTable` + `MapChart` lado a lado, com sincronização de seleção e largura ajustável por drag

**Localizações:** `components/MapChart/` (`MapChart.tsx`, `useMapChartOptions.ts`, `mapChart3DOptions.ts`) · `components/MapWithChart/` (`MapWithChart.tsx`)

## `MapWithChart`

Drop-in replacement de `<HeatmapTable>` que adiciona o gráfico ao lado. Interface idêntica + `chartHeight` (padrão 340).

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
  chartHeight?:   number
}
```

Layout: `HeatmapTable` (esquerda) `│ drag handle │` `MapChart` (direita). Arrastar o handle redimensiona; a proporção (`0.15`–`0.75`, padrão `0.5`) persiste em `localStorage` `miot:map-chart-ratio`. A largura por coluna da tabela é calculada para evitar scroll horizontal quando a tabela é estreitada (e a tabela usa `overflow-hidden`).

### Sincronização de seleção

- **Tabela → gráfico:** `MapWithChart` gerencia o `selectedCells: Set<string>`; o `HeatmapTable` dispara `onSelectionChange(anchor, selEnd)`, o wrapper computa o range e passa ao `MapChart` (2D: dot azul maior; 3D: esferas `scatter3D` azuis).
- **Gráfico → tabela:** clicar num ponto 2D, ou **box select** (arrastar em área vazia desenha um retângulo; ao soltar, os pontos dentro são selecionados — clicar num símbolo não inicia box select). O wrapper converte o `Set` em bounding-box e impõe a seleção ao `HeatmapTable` via `externalSelection`, focando o container — assim `Ctrl+I/U/F2` funcionam imediatamente.

### Edição por drag no gráfico 2D

Arrastar um ponto verticalmente mapeia o pixel Y → valor VE (`convertFromPixel`) e dispara `onCellChange(row, col, newVal)` durante o movimento.

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

Switches no topo: **Orientação** `MAP×RPM` / `RPM×MAP` · **Modo** `2D` / `3D`. Ambos persistem em `localStorage` via `useStickyState`:

| Chave | Tipo | Padrão |
|-------|------|--------|
| `miot:map-chart-orientation` | `'map_x_rpm' \| 'rpm_x_map'` | `'map_x_rpm'` |
| `miot:map-chart-mode` | `'2d' \| '3d'` | `'2d'` |
| `miot:map-chart-ratio` | string float `0.15`–`0.75` | `'0.5'` |

### Modo 2D

Uma linha por MAP (orientação `map_x_rpm`, X = RPM) ou por RPM (`rpm_x_map`, X = MAP) — 16 séries. Cores: gradiente warm interpolado entre as N séries. Símbolos selecionados maiores e azuis; não-selecionados pequenos com `opacity: 0.5` (necessário para o ECharts disparar eventos de mouse). Eixo Y com 5% de padding sobre o range dos dados. Tooltip `trigger: 'axis'`.

### Modo 3D

`import 'echarts-gl'` (registra `surface` e `scatter3D`). Série `type: 'surface'` com `wireframe`, eixos `value` com RPM/MAP reais, dados `[[x, y, z]]` (z = VE). Eixo Z + `visualMap` com 5% de padding. Seleção via `scatter3D` sobreposto azul.

## Props adicionados ao `HeatmapTable` para integração

```typescript
onSelectionChange?: (anchor: { r; c } | null, selEnd: { r; c } | null) => void
cellWidth?: number               // largura por coluna em px; overflow-hidden quando definido
externalSelection?: { anchor: { r; c }; selEnd?: { r; c } | null } | null  // impõe a seleção e foca o container
```

## Futuro (fora de escopo)

- Overlay de scatter — pontos do datalog sobre o gráfico (`ScatterPoint[]`)
- Hover sync — mover o mouse no gráfico destaca a célula na tabela
