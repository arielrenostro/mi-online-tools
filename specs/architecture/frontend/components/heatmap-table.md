# Componente `HeatmapTable`

Tabela interativa N×M com gradiente de cores, edição inline, seleção múltipla e navegação por teclado. Componente central — usado em seis contextos na aba VE.

**Localização:** `frontend/src/components/HeatmapTable/` — `HeatmapTable.tsx`, `HeatmapCell.tsx`, `useHeatmapSelection.ts`, `useHeatmapKeyboard.ts`, `colorScales.ts`

## Props

```typescript
/** Metadados por célula, gerados pela aba VE a partir do TuningOutput. Ausência = estado normal. */
export interface CellMeta {
  modified?:     boolean  // modificada (usuário ou auto-tuning) — ponto vermelho canto sup. dir.
  warning?:      string   // mensagem de warning no tooltip (monotonicidade, gradiente)
  noData?:       boolean  // sem dados do log — fundo listrado diagonal cinza
  extrapolated?: boolean  // preenchida por regra de extrapolação — seta canto inf. dir.
}

/** Tooltip — sempre completo; o modo de heatmap determina a cor, não o conteúdo. */
export interface TooltipContent {
  primary:    { label: string; value: string }[]
  secondary?: string   // nota em itálico. Ex.: "Extrapolado por regra RPM 400"
}

export interface HeatmapTableProps {
  /** data[row][col]. number = valor (VE raw 100–9999, confidence 0–1, amostras);
   *  boolean = escala 'convergence'; null = sem dados. */
  data: (number | boolean | null)[][]
  rowLabels: number[]          // MAP (kPa), de cima (maior) para baixo
  colLabels: number[]          // RPM, da esquerda (menor) para a direita
  colorScale: ColorScale
  editable?: boolean           // edição inline via duplo clique/Enter. Padrão false
  cellMeta?: CellMeta[][]      // cellMeta[row][col]
  selectedCells?: Set<string>  // "row:col"; controlado externamente
  hoveredCell?: { row: number; col: number } | null  // sincronizado com MapChart
  onCellClick?:       (row: number, col: number) => void
  onCellChange?:      (row: number, col: number, value: number) => void  // só se válido e confirmado
  onSelectionChange?: (cells: Set<string>) => void
  onHover?:           (row: number, col: number) => void
  onHoverEnd?:        () => void
  tooltip?:           (row: number, col: number) => TooltipContent | null
}
```

O componente NÃO atualiza `data` internamente — o pai atualiza via store.

## Escalas de Cor (`colorScales.ts`)

Cada escala recebe um valor + limites globais e retorna `rgb(r, g, b)`.

### `warm` — Azul → Verde → Amarelo → Vermelho

Mapa editável, original, VE Lambda. Três segmentos lineares.

```typescript
export function warmScale(value: number, min: number, max: number): string {
  const t = max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)))
  let r: number, g: number, b: number
  if (t < 0.33) {            // azul (0,0,255) → verde (0,255,0)
    const s = t / 0.33
    r = 0; g = Math.round(s * 255); b = Math.round((1 - s) * 255)
  } else if (t < 0.67) {     // verde → amarelo (255,255,0)
    const s = (t - 0.33) / 0.34
    r = Math.round(s * 255); g = 255; b = 0
  } else {                   // amarelo → vermelho (255,0,0)
    const s = (t - 0.67) / 0.33
    r = 255; g = Math.round((1 - s) * 255); b = 0
  }
  return `rgb(${r}, ${g}, ${b})`
}

/** min/max globais de um dataset, ignorando null e boolean. */
export function globalMinMax(data: (number | boolean | null)[][]): { min: number; max: number } {
  let min = Infinity, max = -Infinity
  for (const row of data) for (const cell of row) {
    if (typeof cell === 'number') { if (cell < min) min = cell; if (cell > max) max = cell }
  }
  return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max }
}
```

### `diverging` — Azul (neg) → Branco (zero) → Vermelho (pos)

Mapa de correção %. `absMax = max(|min|, |max|)` — satura igualmente nos dois lados.

```typescript
export function divergingScale(value: number, absMax: number): string {
  const t = absMax === 0 ? 0 : Math.max(-1, Math.min(1, value / absMax))
  if (t < 0) {        // negativo: branco → azul
    const s = -t
    return `rgb(${Math.round((1 - s) * 255)}, ${Math.round((1 - s) * 255)}, 255)`
  } else if (t > 0) { // positivo: branco → vermelho
    return `rgb(255, ${Math.round((1 - t) * 255)}, ${Math.round((1 - t) * 255)})`
  }
  return 'rgb(255, 255, 255)'
}
```

### `confidence` — Vermelho → Amarelo → Verde

Confidence (0–1) e CV (invertido: `confidenceScale(1 - cv / cv_threshold)` → cv=0 verde, cv≥threshold vermelho).

```typescript
export function confidenceScale(value: number): string {
  const t = Math.max(0, Math.min(1, value))  // 0=vermelho, 0.5=amarelo, 1=verde
  let r: number, g: number
  if (t < 0.5) { r = 255; g = Math.round(t * 2 * 255) }                   // vermelho→amarelo
  else { r = Math.round((1 - (t - 0.5) * 2) * 255); g = 255 }             // amarelo→verde
  return `rgb(${r}, ${g}, 0)`
}
```

### `coverage` — Cinza → Azul Saturado

Contagem de amostras (0 = sem dados, ≥`saturationAt` = cobertura plena).

```typescript
export function coverageScale(value: number, saturationAt = 100): string {
  if (value <= 0) return 'rgb(80, 80, 80)'  // cinza — sem dados
  const t = Math.min(1, value / saturationAt)
  // cinza claro (160,160,160) → azul saturado (30,100,220)
  return `rgb(${Math.round(160 - t*130)}, ${Math.round(160 - t*60)}, ${Math.round(160 + t*60)})`
}
```

### `convergence` — Cinza (null) / Âmbar (false) / Verde (true)

```typescript
export function convergenceScale(value: boolean | null): string {
  if (value === null) return 'rgb(80, 80, 80)'   // cinza — sem dados
  if (value === false) return '#f59e0b'           // âmbar — não convergiu
  return '#22c55e'                                // verde — convergiu
}
```

### Despacho

```typescript
export function getCellColor(
  value: number | boolean | null, colorScale: ColorScale,
  context: { min: number; max: number; absMax: number }
): string {
  if (value === null) return 'rgb(45, 45, 45)'
  switch (colorScale) {
    case 'warm':
      return typeof value === 'number' ? warmScale(value, context.min, context.max) : 'rgb(45,45,45)'
    case 'diverging':
      return typeof value === 'number' ? divergingScale(value, context.absMax) : 'rgb(45,45,45)'
    case 'confidence':
      return typeof value === 'number' ? confidenceScale(value) : 'rgb(45,45,45)'
    case 'coverage':
      return typeof value === 'number' ? coverageScale(value) : 'rgb(45,45,45)'
    case 'convergence':
      return typeof value === 'boolean' ? convergenceScale(value) : convergenceScale(null)
  }
}
```

## Estados visuais de célula

Cada célula é um `<div>` `position: relative` que combina indicadores simultaneamente.

| Estado | Visual |
|--------|--------|
| **Normal** | Fundo da escala; texto centralizado, cor branca/preta por luminância (`(0.299r+0.587g+0.114b)/255 > 0.5` → escuro); fonte `text-xs` |
| **Hover** | `filter: brightness(1.25)`, `ring-2 ring-white ring-inset`. Se selecionada+hovered, o estilo de seleção prevalece |
| **Selecionada** | `ring-2 ring-white ring-inset` + `outline outline-2 outline-blue-500 outline-offset-1`; fundo mantém a cor da escala. Em retângulo, o outline só nas bordas externas |
| **Modificada** | Ponto vermelho 6px no canto sup. dir. (`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-500`) |
| **Warning** | `outline outline-2 outline-orange-400 outline-dashed` + ícone `⚠` (`text-[8px]` âmbar) no canto sup. esq.; tooltip destaca a mensagem. Se selecionada, outline azul prevalece mas `⚠` permanece |
| **Sem Dados** | Fundo `repeating-linear-gradient(-45deg, #404040, #404040 3px, #2a2a2a 3px, #2a2a2a 8px)`; texto "—"; não editável mesmo com `editable=true` |
| **Extrapolada** | Ícone `↗` no canto inf. dir. (`text-[8px] text-gray-400`); valor extrapolado exibido; tooltip `secondary` = "Calculado por regra [nome]". Coexiste com `modified` |

## Edição de células

Ativada por duplo clique ou `Enter` com 1+ células selecionadas (bulk se múltiplas). O modo de edição substitui o texto por um `<input type="text">` centralizado (`autoFocus`).

### Formatos aceitos

| Formato | Exemplo | Comportamento |
|---------|---------|---------------|
| Inteiro puro/com sinal | `850`, `+850` | Valor = 850 |
| Percentual relativo | `+5%`, `-3%` | `Math.round(currentValue × (1 ± pct/100))` |
| Float | `850.7` | `Math.round` → 850 |

```typescript
function parseEditInput(raw: string, currentValue: number): number | null {
  const trimmed = raw.trim()
  const pctMatch = trimmed.match(/^([+-]\d+(?:\.\d+)?)%$/)
  if (pctMatch) return Math.round(currentValue * (1 + parseFloat(pctMatch[1]) / 100))
  const num = parseFloat(trimmed)
  return !isNaN(num) ? Math.round(num) : null
}

const MIN_VALUE = 100, MAX_VALUE = 9999
function validateEditResult(value: number | null): boolean {
  return value !== null && value >= MIN_VALUE && value <= MAX_VALUE
}
```

Resultado inválido: `<input>` com `border-red-500 ring-1 ring-red-500`, valor NÃO confirmado, campo permanece em edição. `Escape` sempre cancela.

### Navegação durante edição

| Tecla | Ação |
|-------|------|
| `Enter` | Confirma (se válido) → célula abaixo |
| `Tab` / `Shift+Tab` | Confirma → célula à direita / esquerda |
| `Escape` | Cancela, restaura valor anterior |
| Clique fora | Confirma (se válido) |

### Edição em bulk

Múltiplas células + `Enter` → campo de edição como overlay flutuante (`fixed top-4 left-1/2`, não inline). Aplica o valor a cada célula usando o valor atual de cada uma como base para percentuais. Cada aplicação passa pela validação 100–9999; valores fora do range são clampeados (não ignorados).

## Seleção múltipla (`useHeatmapSelection.ts`)

| Interação | Resultado |
|-----------|-----------|
| Clique simples | Só a célula clicada; âncora = clicada |
| `Shift+Clique` | Retângulo do âncora até a clicada |
| `Ctrl/Cmd+Clique` | Adiciona/remove célula individual; âncora = clicada |
| Arrastar | Seleção por retângulo em tempo real |
| `Enter` com ≥2 células | Edição bulk |

```typescript
function computeRectangleSelection(
  anchor: { row: number; col: number }, current: { row: number; col: number }
): Set<string> {
  const minRow = Math.min(anchor.row, current.row), maxRow = Math.max(anchor.row, current.row)
  const minCol = Math.min(anchor.col, current.col), maxCol = Math.max(anchor.col, current.col)
  const cells = new Set<string>()
  for (let r = minRow; r <= maxRow; r++)
    for (let c = minCol; c <= maxCol; c++) cells.add(`${r}:${c}`)
  return cells
}
```

Drag selection: `onMouseDown` (sem Shift/Ctrl) → `setIsDragging(true)`, `dragStart={row,col}`, seleção inicial = célula clicada. `onMouseEnter` durante drag → `computeRectangleSelection(dragStart, {row,col})`. `mouseup` global (via `useEffect` + `window` listener) → `setIsDragging(false)`.

## Navegação por teclado (`useHeatmapKeyboard.ts`)

Requer `tabIndex={0}` no `HeatmapTable`. Fora do modo de edição:

| Tecla | Ação |
|-------|------|
| `Arrow*` | Move a seleção |
| `Shift+Arrow*` | Estende o retângulo |
| `Tab` / `Shift+Tab` | Próxima/anterior célula; quebra de linha automática |
| `Home` / `End` | Primeira/última coluna da linha |
| `PageUp` / `PageDown` | Primeira/última linha da coluna |
| `Enter` | Edição (se `editable` e 1 célula) ou edição bulk (múltiplas) |
| `Escape` | Limpa seleção |

```typescript
export function useHeatmapKeyboard({ rows, cols, selectedCells, onSelectionChange,
                                     onEditStart, editable }: HeatmapKeyboardOptions) {
  const anchorRef = useRef<{ row: number; col: number } | null>(null)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedCells || selectedCells.size === 0) return
    const lastKey = [...selectedCells][selectedCells.size - 1]
    const [lastRow, lastCol] = lastKey.split(':').map(Number)

    // Helper: aplica a seleção (estende com Shift, ou seleciona célula única)
    const apply = (newRow: number, newCol: number) => {
      if (e.shiftKey && anchorRef.current)
        onSelectionChange(computeRectangleSelection(anchorRef.current, { row: newRow, col: newCol }))
      else {
        anchorRef.current = { row: newRow, col: newCol }
        onSelectionChange(new Set([`${newRow}:${newCol}`]))
      }
    }

    switch (e.key) {
      case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight': {
        e.preventDefault()
        const d = { ArrowUp: { dr:-1, dc:0 }, ArrowDown: { dr:1, dc:0 },
                    ArrowLeft: { dr:0, dc:-1 }, ArrowRight: { dr:0, dc:1 } }[e.key]!
        apply(Math.max(0, Math.min(rows-1, lastRow+d.dr)),
              Math.max(0, Math.min(cols-1, lastCol+d.dc)))
        break
      }
      case 'Home': e.preventDefault(); apply(lastRow, 0); break
      case 'End':  e.preventDefault(); apply(lastRow, cols-1); break
      case 'PageUp':
        e.preventDefault()
        anchorRef.current = { row: 0, col: lastCol }
        onSelectionChange(new Set([`0:${lastCol}`])); break
      case 'PageDown':
        e.preventDefault()
        anchorRef.current = { row: rows-1, col: lastCol }
        onSelectionChange(new Set([`${rows-1}:${lastCol}`])); break
      case 'Enter':  e.preventDefault(); if (editable) onEditStart(); break
      case 'Escape': e.preventDefault(); onSelectionChange(new Set()); break
    }
  }, [selectedCells, onSelectionChange, onEditStart, editable, rows, cols])

  return { handleKeyDown }
}
```

> Nota: no spec original `Home`/`End` com Shift estendem o retângulo; o helper `apply` acima preserva esse comportamento.

## Performance

Mapa tem no máximo 16×16 = 256 células — sem virtualização. Mas hover/tooltip mudam com alta frequência:

- `HeatmapCell` é `React.memo` com comparação customizada (re-renderiza só se `value`, `bgColor`, `isSelected`, `isHovered` ou os campos de `meta` mudarem)
- O `HeatmapTable` calcula `bgColor` e booleanos de estado em `useMemo` e passa como **primitivos** (não objetos anônimos):

```tsx
const { min, max } = useMemo(() => globalMinMax(data), [data])
const absMax = useMemo(() => Math.max(Math.abs(min), Math.abs(max)), [min, max])
const colorContext = useMemo(() => ({ min, max, absMax }), [min, max, absMax])
const cellColors = useMemo(() =>
  data.map(row => row.map(value => getCellColor(value, colorScale, colorContext))),
  [data, colorScale, colorContext])
```

## Header (labels sticky)

Headers de RPM (`<thead sticky top-0>`) e labels de MAP (`<td sticky left-0>`). Z-index: célula de canto `z-30`, header RPM `z-20`, label MAP `z-10`, células de dados abaixo.

## Tooltip

Usa `<Tooltip>` do shadcn/ui (`delayDuration={300}`). Renderiza `tooltipContent.primary` como linhas label+valor; `tooltipContent.secondary` em itálico com borda superior.

## Usos na Aba VE

| Instância | `colorScale` | `editable` | `cellMeta` | Fonte |
|-----------|-------------|------------|------------|-------|
| Mapa Original | `warm` | `false` | — | `originalMap.cells` |
| Mapa Editável | `warm` | `true` | `modified`, `noData`, `extrapolated`, `warning` | `editableMap` |
| Análise › VE Lambda | `warm` | `false` | `noData` | `tuningOutput.veLambdaMap` |
| Análise › Amostras | `coverage` | `false` | `noData` | `tuningOutput.sampleCountMap` |
| Análise › Confiança | `confidence` | `false` | `noData` | `tuningOutput.confidenceMap` |
| Análise › CV | `confidence` (invertido) | `false` | `noData` | `tuningOutput.cvMap` — `confidenceScale(1 - cv/cv_threshold)` |
| Análise › Correção % | `diverging` | `false` | `noData` | `tuningOutput.correctionPctMap` |
| Análise › Convergência | `convergence` | `false` | `noData` | `tuningOutput.convergenceMap` |

### Montagem de `cellMeta` e `tooltip` (Mapa Editável)

O pai (`VETab.tsx`) monta `cellMeta` e `tooltip` em `useMemo`/`useCallback` a partir de `TuningOutput` + `editableMap`:
- `cellMeta`: `modified` = `editableMap[r][c] !== originalMap.cells[r][c]`; `noData`/`extrapolated`/`warning` derivados de `cellsNoData`, `cellsExtrapolated`, `monotonicityWarnings`, `gradientWarnings`
- `tooltip`: linhas `primary` com RPM, MAP, Valor atual e — se há `output` — VE Lambda, Amostras, Confiança, CV, Correção, Convergida
