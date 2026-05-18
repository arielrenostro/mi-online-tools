# Componente `HeatmapTable`

Tabela interativa N×M que exibe valores de mapa da ECU com gradiente de cores, edição inline, seleção múltipla e navegação por teclado. É o componente mais central do projeto — usado em seis contextos diferentes na aba VE.

**Localização:** `frontend/src/components/HeatmapTable/`  
**Arquivos:** `HeatmapTable.tsx`, `HeatmapCell.tsx`, `useHeatmapSelection.ts`, `useHeatmapKeyboard.ts`, `colorScales.ts`

---

## Props

```typescript
// src/components/HeatmapTable/HeatmapTable.tsx

import type { ColorScale, TooltipContent } from '@/types/ui'

/**
 * Metadados adicionais por célula, gerados pela aba VE a partir do TuningOutput.
 * Todos os campos são opcionais — ausência = estado normal da célula.
 */
export interface CellMeta {
  /** Célula foi modificada pelo usuário ou pelo auto-tuning. Exibe ponto vermelho no canto superior direito. */
  modified?: boolean

  /** Mensagem de warning a exibir no tooltip (monotonicidade, gradiente excessivo). */
  warning?: string

  /** Célula sem dados do log — fundo listrado diagonal cinza. */
  noData?: boolean

  /** Célula preenchida por uma das regras de extrapolação — ícone de seta no canto inferior direito. */
  extrapolated?: boolean
}

/**
 * Estrutura do tooltip exibido ao hover em cada célula.
 * O tooltip é sempre completo — o modo ativo de heatmap determina a cor,
 * não o que é exibido no tooltip.
 */
export interface TooltipContent {
  /** Linhas principais do tooltip: label + valor formatado. */
  primary: { label: string; value: string }[]

  /** Nota extra exibida em itálico abaixo das linhas principais.
   *  Ex.: "Extrapolado por regra RPM 400" ou "Célula sem dados no log". */
  secondary?: string
}

export interface HeatmapTableProps {
  /**
   * Matriz de valores das células. Shape: data[row][col].
   * - number: valor numérico (mapa VE raw 100–9999, confidence 0–1, amostras, etc.)
   * - boolean: usado na escala 'convergence' (true = convergiu, false = não convergiu)
   * - null: célula sem dados (para escalas que suportam — confidence, convergence, etc.)
   */
  data: (number | boolean | null)[][]

  /** Breakpoints de MAP (kPa) — labels das linhas, de cima (MAP maior) para baixo. */
  rowLabels: number[]

  /** Breakpoints de RPM — labels das colunas, da esquerda (RPM menor) para a direita. */
  colLabels: number[]

  /** Algoritmo de mapeamento valor → cor. Ver seção "Escalas de Cor". */
  colorScale: ColorScale

  /**
   * Se true, habilita edição inline via duplo clique ou Enter.
   * Padrão: false.
   */
  editable?: boolean

  /**
   * Metadados por célula. Shape: cellMeta[row][col].
   * Ausência de cellMeta ou cellMeta[row][col] undefined = sem metadados.
   */
  cellMeta?: CellMeta[][]

  /**
   * Conjunto de células selecionadas pelo usuário. Formato: "row:col".
   * Ex.: new Set(["0:3", "0:4", "1:3"]) = retângulo de 2×2.
   * Controlado externamente — o componente chama onSelectionChange.
   */
  selectedCells?: Set<string>

  /**
   * Célula atualmente sob hover, sincronizada com MapChart.
   * Controlada externamente — permite que hover no MapChart destaque a célula aqui.
   */
  hoveredCell?: { row: number; col: number } | null

  /** Clique simples em uma célula (após seleção ser calculada). */
  onCellClick?: (row: number, col: number) => void

  /**
   * Confirmação de edição. Chamado somente quando o valor é válido e confirmado.
   * O componente NÃO atualiza data internamente — o pai atualiza via store.
   */
  onCellChange?: (row: number, col: number, value: number) => void

  /**
   * Nova seleção calculada. O pai persiste no estado e passa de volta via selectedCells.
   * null = seleção limpa.
   */
  onSelectionChange?: (cells: Set<string>) => void

  /** Mouse entrou na célula (row, col). Usado para sincronizar com MapChart. */
  onHover?: (row: number, col: number) => void

  /** Mouse saiu de todas as células. */
  onHoverEnd?: () => void

  /**
   * Função que retorna o conteúdo do tooltip para uma célula.
   * null = sem tooltip para esta célula.
   * O pai monta o TooltipContent a partir de TuningOutput + data atual.
   */
  tooltip?: (row: number, col: number) => TooltipContent | null
}
```

---

## Escalas de Cor

Implementadas em `colorScales.ts`. Cada escala recebe um valor e os limites globais do dataset, e retorna uma string CSS `rgb(r, g, b)`.

### `warm` — Azul → Verde → Amarelo → Vermelho

Usada para: mapa editável, mapa original, VE Lambda diagnóstico.

```typescript
// colorScales.ts
export function warmScale(value: number, min: number, max: number): string {
  // Normaliza para [0, 1]
  const t = max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)))

  // Três segmentos de interpolação linear:
  // [0.00, 0.33]: azul (0,0,255) → verde (0,255,0)
  // [0.33, 0.67]: verde (0,255,0) → amarelo (255,255,0)
  // [0.67, 1.00]: amarelo (255,255,0) → vermelho (255,0,0)

  let r: number, g: number, b: number

  if (t < 0.33) {
    const s = t / 0.33
    r = 0
    g = Math.round(s * 255)
    b = Math.round((1 - s) * 255)
  } else if (t < 0.67) {
    const s = (t - 0.33) / 0.34
    r = Math.round(s * 255)
    g = 255
    b = 0
  } else {
    const s = (t - 0.67) / 0.33
    r = 255
    g = Math.round((1 - s) * 255)
    b = 0
  }

  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Calcula min e max globais de um dataset para normalização.
 * Ignora null e boolean.
 */
export function globalMinMax(data: (number | boolean | null)[][]): { min: number; max: number } {
  let min = Infinity, max = -Infinity
  for (const row of data) {
    for (const cell of row) {
      if (typeof cell === 'number') {
        if (cell < min) min = cell
        if (cell > max) max = cell
      }
    }
  }
  return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max }
}
```

### `diverging` — Azul (negativo) → Branco (zero) → Vermelho (positivo)

Usada para: mapa de correção % (valores positivos e negativos centrados em zero).

```typescript
export function divergingScale(value: number, absMax: number): string {
  // absMax = max(|min|, |max|) calculado globalmente — satura igualmente nos dois lados
  const t = absMax === 0 ? 0 : Math.max(-1, Math.min(1, value / absMax))

  if (t < 0) {
    // Negativo: branco → azul
    const s = -t  // 0 = branco, 1 = azul puro
    return `rgb(${Math.round((1 - s) * 255)}, ${Math.round((1 - s) * 255)}, 255)`
  } else if (t > 0) {
    // Positivo: branco → vermelho
    const s = t
    return `rgb(255, ${Math.round((1 - s) * 255)}, ${Math.round((1 - s) * 255)})`
  } else {
    return 'rgb(255, 255, 255)'
  }
}

// Uso no HeatmapTable com colorScale='diverging':
// absMax = Math.max(Math.abs(globalMin), Math.abs(globalMax))
// cor = divergingScale(value, absMax)
```

### `confidence` — Vermelho → Amarelo → Verde

Usada para: confidence (0–1) e CV (invertido: 0=verde, ≥cv_threshold=vermelho).

```typescript
export function confidenceScale(value: number): string {
  // value ∈ [0, 1]; 0 = vermelho, 0.5 = amarelo, 1 = verde
  const t = Math.max(0, Math.min(1, value))

  let r: number, g: number

  if (t < 0.5) {
    // Vermelho → Amarelo
    r = 255
    g = Math.round(t * 2 * 255)
  } else {
    // Amarelo → Verde
    r = Math.round((1 - (t - 0.5) * 2) * 255)
    g = 255
  }

  return `rgb(${r}, ${g}, 0)`
}

// Para CV (invertido): confidenceScale(1 - cv / cv_threshold)
// cv=0 → confidence=1.0 → verde (melhor)
// cv=cv_threshold → confidence=0.0 → vermelho (pior)
```

### `coverage` — Cinza → Azul Saturado

Usada para: contagem de amostras (0 = sem dados, ≥100 = cobertura plena).

```typescript
export function coverageScale(value: number, saturationAt: number = 100): string {
  // value ∈ [0, saturationAt]; abaixo de 0 → cinza; acima de saturationAt → azul saturado
  if (value <= 0) return 'rgb(80, 80, 80)'  // cinza escuro — sem dados

  const t = Math.min(1, value / saturationAt)

  // Cinza claro (160, 160, 160) → Azul saturado (30, 100, 220)
  const r = Math.round(160 - t * 130)
  const g = Math.round(160 - t * 60)
  const b = Math.round(160 + t * 60)

  return `rgb(${r}, ${g}, ${b})`
}
```

### `convergence` — Cinza (null) / Amarelo (false) / Verde (true)

Usada para: mapa de convergência (booleano por célula).

```typescript
export function convergenceScale(value: boolean | null): string {
  if (value === null) return 'rgb(80, 80, 80)'    // cinza — sem dados
  if (value === false) return '#f59e0b'            // âmbar — não convergiu
  return '#22c55e'                                 // verde — convergiu
}
```

### Função de despacho

```typescript
export function getCellColor(
  value: number | boolean | null,
  colorScale: ColorScale,
  context: { min: number; max: number; absMax: number }
): string {
  if (value === null) return 'rgb(45, 45, 45)'  // células null em todas as escalas

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

---

## Estados Visuais de Célula

Cada célula é um elemento `<div>` com `position: relative` que combina múltiplos indicadores visuais simultaneamente.

### Normal

- **Fundo:** cor calculada pela escala ativa
- **Texto:** valor formatado (inteiro ou 2 casas decimais conforme contexto), centralizado, cor automática (branco ou preto) baseado na luminância do fundo
- **Tamanho de fonte:** `text-xs` (Tailwind) — compacto para caber o valor sem overflow

```typescript
// Cálculo de cor do texto baseado em luminância relativa do fundo
function getTextColor(bgRgb: string): 'text-white' | 'text-gray-900' {
  const [r, g, b] = bgRgb.match(/\d+/g)!.map(Number)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? 'text-gray-900' : 'text-white'
}
```

### Hover

- Aplicado quando `hoveredCell` corresponde à célula OU quando o mouse está fisicamente sobre ela
- `filter: brightness(1.25)` sobre o fundo
- Borda interna branca de 2px: `ring-2 ring-white ring-inset`
- Cursor: `cursor-pointer` (ou `cursor-text` quando em modo edição)
- **Ordem de prioridade:** se a célula está selecionada E hovered, o estilo de seleção prevalece

### Selecionada

- Borda interna branca: `ring-2 ring-white ring-inset`
- Outline externo azul: `outline outline-2 outline-blue-500 outline-offset-1`
- O fundo mantém a cor da escala (não muda para azul sólido)
- Quando múltiplas células estão selecionadas em retângulo, o outline aparece apenas nas bordas externas do retângulo (implementado com CSS `box-shadow` combinado via lógica de borda)

### Modificada (`cellMeta.modified`)

- Indicador visual: ponto vermelho sólido de 6px no canto superior direito
- CSS: `absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-500`
- Posição: `position: absolute`, sem afetar o layout do texto
- Exibido simultaneamente com qualquer outro estado (hover, selecionada, etc.)

### Warning (`cellMeta.warning`)

- Borda laranja pontilhada: `outline outline-2 outline-orange-400 outline-dashed`
- Ícone `⚠` em fonte `text-[8px]` no canto superior esquerdo, cor âmbar
- O tooltip inclui a mensagem do warning em destaque (fundo âmbar claro)
- Quando a célula também está selecionada: o outline azul de seleção prevalece sobre o laranja, mas o ícone `⚠` continua visível

### Sem Dados (`cellMeta.noData`)

- Fundo listrado diagonal cinza: `background: repeating-linear-gradient(-45deg, #404040, #404040 3px, #2a2a2a 3px, #2a2a2a 8px)`
- Texto "—" centralizado em vez do valor numérico
- Não é editável mesmo que `editable={true}` (o handler de duplo clique não dispara)
- Escala de cor não se aplica — o fundo listrado substitui completamente

### Extrapolada (`cellMeta.extrapolated`)

- Ícone de seta diagonal `↗` no canto inferior direito, em cinza claro
- CSS: `absolute bottom-0.5 right-0.5 text-[8px] text-gray-400`
- O valor exibido é o valor extrapolado (não "—")
- Tooltip inclui nota: "secondary" = "Calculado por regra [nome da regra]"
- Pode coexistir com `modified` — ambos os indicadores aparecem

---

## Edição de Células

### Lifecycle Completo

```
célula selecionada (foco no componente)
      │
      ├── duplo clique na célula
      │     └── ativa modo de edição inline
      │
      └── tecla Enter com 1 ou mais células selecionadas
            └── ativa modo de edição inline (bulk se múltiplas)
```

O modo de edição substitui o texto da célula por um `<input type="text">` centralizado:

```tsx
// HeatmapCell.tsx — modo de edição
<input
  ref={inputRef}
  className="w-full h-full text-center text-xs bg-transparent border-none outline-none text-white"
  defaultValue={String(currentValue)}
  onKeyDown={handleEditKeyDown}
  onBlur={handleEditBlur}
  autoFocus
/>
```

### Formatos Aceitos na Entrada

| Formato | Exemplo | Comportamento |
|---------|---------|---------------|
| Inteiro puro | `850` | Novo valor = 850 |
| Inteiro com sinal | `+850` | Novo valor = 850 |
| Percentual relativo positivo | `+5%` | `Math.round(currentValue * 1.05)` |
| Percentual relativo negativo | `-3%` | `Math.round(currentValue * 0.97)` |
| Float (truncado) | `850.7` | Novo valor = 850 (Math.round) |

```typescript
function parseEditInput(raw: string, currentValue: number): number | null {
  const trimmed = raw.trim()

  // Percentual relativo: +N% ou -N%
  const pctMatch = trimmed.match(/^([+-]\d+(?:\.\d+)?)%$/)
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1])
    return Math.round(currentValue * (1 + pct / 100))
  }

  // Inteiro ou float
  const num = parseFloat(trimmed)
  if (!isNaN(num)) return Math.round(num)

  return null  // entrada inválida
}
```

### Validação

```typescript
const MIN_VALUE = 100
const MAX_VALUE = 9999

function validateEditResult(value: number | null): boolean {
  if (value === null) return false
  return value >= MIN_VALUE && value <= MAX_VALUE
}
```

- Resultado inválido: o `<input>` recebe classe `border-red-500 ring-1 ring-red-500`, o valor NÃO é confirmado
- O campo permanece em edição para que o usuário corrija
- Escape sempre cancela, independentemente do estado de validação

### Navegação durante Edição

| Tecla | Ação |
|-------|------|
| `Enter` | Confirma o valor (se válido) → move para a célula **abaixo** |
| `Tab` | Confirma o valor (se válido) → move para a célula à **direita** |
| `Shift+Tab` | Confirma o valor (se válido) → move para a célula à **esquerda** |
| `Escape` | Cancela edição, restaura valor anterior |
| Clique fora | Confirma o valor (se válido) |

### Edição em Bulk

Quando múltiplas células estão selecionadas e o usuário pressiona `Enter`, um único campo de edição aparece como overlay flutuante (não inline em uma célula específica):

```tsx
// Posicionado sobre o centro da seleção ou no topo da tela
<div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 rounded-lg shadow-xl p-4">
  <label className="text-sm text-gray-300 mb-2 block">
    Editar {selectedCells.size} células selecionadas
  </label>
  <input
    className="w-48 px-3 py-2 text-center bg-gray-700 border border-gray-600 rounded text-white"
    placeholder="+5% ou 850"
    autoFocus
  />
  <p className="text-xs text-gray-400 mt-1">
    Inteiro absoluto ou percentual relativo (ex: +5%, -3%)
  </p>
</div>
```

O valor é aplicado individualmente a cada célula selecionada, usando o valor atual de cada uma como base para percentuais. Cada aplicação individual passa pela mesma validação (100–9999); células que resultariam em valor fora do range têm o resultado clampeado para o limite, não são ignoradas.

---

## Seleção Múltipla

A lógica de seleção é extraída em `useHeatmapSelection.ts`.

### Comportamentos

| Interação | Resultado |
|-----------|-----------|
| Clique simples | Seleciona somente a célula clicada; âncora de seleção = célula clicada |
| `Shift+Clique` | Seleciona retângulo do **âncora** até a célula clicada (inclusive) |
| `Ctrl+Clique` / `Cmd+Clique` | Adiciona ou remove célula individual; âncora = célula clicada |
| Arrastar (mousedown → mousemove → mouseup) | Seleção por retângulo em tempo real durante o drag |
| `Enter` com ≥2 células | Abre campo de edição bulk |

### Implementação do Retângulo

```typescript
// useHeatmapSelection.ts
function computeRectangleSelection(
  anchor: { row: number; col: number },
  current: { row: number; col: number }
): Set<string> {
  const minRow = Math.min(anchor.row, current.row)
  const maxRow = Math.max(anchor.row, current.row)
  const minCol = Math.min(anchor.col, current.col)
  const maxCol = Math.max(anchor.col, current.col)

  const cells = new Set<string>()
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      cells.add(`${r}:${c}`)
    }
  }
  return cells
}
```

### Drag Selection

```typescript
// Estado local do drag no HeatmapTable
const [isDragging, setIsDragging] = useState(false)
const [dragStart, setDragStart] = useState<{ row: number; col: number } | null>(null)

// onMouseDown na célula (sem Shift, sem Ctrl):
function handleCellMouseDown(row: number, col: number) {
  setIsDragging(true)
  setDragStart({ row, col })
  // Seleção inicial = apenas a célula clicada
  onSelectionChange?.(new Set([`${row}:${col}`]))
}

// onMouseEnter na célula (durante drag):
function handleCellMouseEnter(row: number, col: number) {
  if (isDragging && dragStart) {
    onSelectionChange?.(computeRectangleSelection(dragStart, { row, col }))
  }
}

// onMouseUp (global, via useEffect):
useEffect(() => {
  const handleMouseUp = () => setIsDragging(false)
  window.addEventListener('mouseup', handleMouseUp)
  return () => window.removeEventListener('mouseup', handleMouseUp)
}, [])
```

---

## Navegação por Teclado

Extraída em `useHeatmapKeyboard.ts`. O `HeatmapTable` precisa ser focalizável (`tabIndex={0}`) para receber eventos de teclado.

### Mapa de Teclas (fora do modo de edição)

| Tecla | Ação |
|-------|------|
| `ArrowUp` | Move seleção uma linha acima |
| `ArrowDown` | Move seleção uma linha abaixo |
| `ArrowLeft` | Move seleção uma coluna à esquerda |
| `ArrowRight` | Move seleção uma coluna à direita |
| `Shift+ArrowUp/Down/Left/Right` | Estende retângulo de seleção |
| `Tab` | Move para a próxima célula na linha; ao final da linha, vai para a primeira da linha seguinte |
| `Shift+Tab` | Move para a célula anterior; ao início da linha, vai para a última da linha anterior |
| `Home` | Move para a primeira coluna da linha atual |
| `End` | Move para a última coluna da linha atual |
| `PageUp` | Move para a primeira linha da coluna atual |
| `PageDown` | Move para a última linha da coluna atual |
| `Enter` | Ativa edição (se editable e 1 célula), ou edição bulk (se múltiplas) |
| `Escape` | Limpa seleção |

```typescript
// useHeatmapKeyboard.ts
export function useHeatmapKeyboard({
  rows, cols, selectedCells, onSelectionChange, onEditStart, editable,
}: HeatmapKeyboardOptions) {
  const anchorRef = useRef<{ row: number; col: number } | null>(null)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedCells || selectedCells.size === 0) return

    const currentKeys = [...selectedCells]
    const lastKey = currentKeys[currentKeys.length - 1]
    const [lastRow, lastCol] = lastKey.split(':').map(Number)

    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight': {
        e.preventDefault()
        const delta = {
          ArrowUp:    { dr: -1, dc:  0 },
          ArrowDown:  { dr:  1, dc:  0 },
          ArrowLeft:  { dr:  0, dc: -1 },
          ArrowRight: { dr:  0, dc:  1 },
        }[e.key]!

        const newRow = Math.max(0, Math.min(rows - 1, lastRow + delta.dr))
        const newCol = Math.max(0, Math.min(cols - 1, lastCol + delta.dc))

        if (e.shiftKey && anchorRef.current) {
          onSelectionChange(computeRectangleSelection(anchorRef.current, { row: newRow, col: newCol }))
        } else {
          anchorRef.current = { row: newRow, col: newCol }
          onSelectionChange(new Set([`${newRow}:${newCol}`]))
        }
        break
      }
      case 'Home': {
        e.preventDefault()
        const newCol = 0
        if (e.shiftKey && anchorRef.current) {
          onSelectionChange(computeRectangleSelection(anchorRef.current, { row: lastRow, col: newCol }))
        } else {
          anchorRef.current = { row: lastRow, col: newCol }
          onSelectionChange(new Set([`${lastRow}:${newCol}`]))
        }
        break
      }
      case 'End': {
        e.preventDefault()
        const newCol = cols - 1
        if (e.shiftKey && anchorRef.current) {
          onSelectionChange(computeRectangleSelection(anchorRef.current, { row: lastRow, col: newCol }))
        } else {
          anchorRef.current = { row: lastRow, col: newCol }
          onSelectionChange(new Set([`${lastRow}:${newCol}`]))
        }
        break
      }
      case 'PageUp': {
        e.preventDefault()
        anchorRef.current = { row: 0, col: lastCol }
        onSelectionChange(new Set([`0:${lastCol}`]))
        break
      }
      case 'PageDown': {
        e.preventDefault()
        anchorRef.current = { row: rows - 1, col: lastCol }
        onSelectionChange(new Set([`${rows - 1}:${lastCol}`]))
        break
      }
      case 'Enter': {
        e.preventDefault()
        if (editable) onEditStart()
        break
      }
      case 'Escape': {
        e.preventDefault()
        onSelectionChange(new Set())
        break
      }
    }
  }, [selectedCells, onSelectionChange, onEditStart, editable, rows, cols])

  return { handleKeyDown }
}
```

---

## Performance

O mapa tem no máximo 16×16 = 256 células — virtualização não é necessária. Porém, re-renders desnecessários devem ser evitados, pois o tooltip e estados de hover mudam com alta frequência durante a navegação do mouse.

### Estratégia de Memoização

```tsx
// HeatmapCell.tsx — wrapped com React.memo
const HeatmapCell = React.memo(
  function HeatmapCell({ row, col, value, bgColor, isSelected, isHovered, meta, ...props }: HeatmapCellProps) {
    // ...
  },
  (prev, next) => {
    // Comparação customizada — só re-renderiza se algo relevante mudou
    return (
      prev.value === next.value &&
      prev.bgColor === next.bgColor &&
      prev.isSelected === next.isSelected &&
      prev.isHovered === next.isHovered &&
      prev.meta?.modified === next.meta?.modified &&
      prev.meta?.warning === next.meta?.warning &&
      prev.meta?.noData === next.meta?.noData &&
      prev.meta?.extrapolated === next.meta?.extrapolated
    )
  }
)
```

O `HeatmapTable` pai calcula `bgColor` e booleanos de estado fora do JSX (em variáveis memoizadas com `useMemo`) e os passa como primitivos para `HeatmapCell`. Isso garante que `React.memo` funcione corretamente — não passa objetos anônimos como props.

```tsx
// HeatmapTable.tsx — cálculo memoizado das cores
const { min, max } = useMemo(() => globalMinMax(data), [data])
const absMax = useMemo(() => Math.max(Math.abs(min), Math.abs(max)), [min, max])
const colorContext = useMemo(() => ({ min, max, absMax }), [min, max, absMax])

const cellColors = useMemo(() =>
  data.map(row => row.map(value => getCellColor(value, colorScale, colorContext))),
  [data, colorScale, colorContext]
)
```

---

## Header (Labels Sticky)

### Estrutura HTML

```tsx
<div className="overflow-auto max-h-[600px] relative">
  <table className="border-collapse text-xs">
    {/* Header de RPM — sticky no topo */}
    <thead className="sticky top-0 z-20 bg-gray-900">
      <tr>
        {/* Célula de canto (vazia) */}
        <th className="w-12 h-8 bg-gray-900 sticky left-0 z-30" />
        {colLabels.map(rpm => (
          <th key={rpm} className="w-12 h-8 text-center text-gray-400 font-medium px-1">
            {rpm}
          </th>
        ))}
      </tr>
    </thead>

    <tbody>
      {data.map((row, rowIdx) => (
        <tr key={rowLabels[rowIdx]}>
          {/* Label de MAP — sticky à esquerda */}
          <td className="sticky left-0 z-10 bg-gray-900 w-12 h-8 text-right pr-2 text-gray-400 font-medium">
            {rowLabels[rowIdx]}
          </td>
          {row.map((value, colIdx) => (
            <HeatmapCell
              key={colIdx}
              row={rowIdx}
              col={colIdx}
              value={value}
              bgColor={cellColors[rowIdx][colIdx]}
              isSelected={selectedCells?.has(`${rowIdx}:${colIdx}`) ?? false}
              isHovered={hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx}
              meta={cellMeta?.[rowIdx]?.[colIdx]}
              editable={editable && !(cellMeta?.[rowIdx]?.[colIdx]?.noData)}
              onMouseDown={(e) => handleCellMouseDown(rowIdx, colIdx, e)}
              onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
              onDoubleClick={() => handleCellDoubleClick(rowIdx, colIdx)}
              onCellChange={(v) => onCellChange?.(rowIdx, colIdx, v)}
              tooltip={tooltip?.(rowIdx, colIdx)}
            />
          ))}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

- A célula de canto (vazia, cima-esquerda) recebe `z-30` para ficar acima dos headers de linha E coluna simultaneamente
- Os headers de RPM recebem `z-20` (acima das células de dados)
- Os labels de MAP recebem `z-10` (acima das células de dados, abaixo dos headers de RPM)

---

## Tooltip

O tooltip usa o componente `<Tooltip>` do shadcn/ui com renderização condicional:

```tsx
// Dentro de HeatmapCell
<TooltipProvider delayDuration={300}>
  <Tooltip>
    <TooltipTrigger asChild>
      <div className={cellClasses} ...>
        {/* conteúdo da célula */}
      </div>
    </TooltipTrigger>
    {tooltipContent && (
      <TooltipContent className="bg-gray-800 border-gray-700 text-white p-3 max-w-xs">
        {tooltipContent.primary.map(({ label, value }) => (
          <div key={label} className="flex justify-between gap-4 text-sm">
            <span className="text-gray-400">{label}</span>
            <span className="font-mono font-medium">{value}</span>
          </div>
        ))}
        {tooltipContent.secondary && (
          <p className="text-xs text-gray-500 italic mt-2 border-t border-gray-700 pt-2">
            {tooltipContent.secondary}
          </p>
        )}
      </TooltipContent>
    )}
  </Tooltip>
</TooltipProvider>
```

---

## Usos na Aba VE

| Instância | `colorScale` | `editable` | `cellMeta` | Observações |
|-----------|-------------|------------|------------|-------------|
| **Mapa Original** | `warm` | `false` | — | Somente leitura; tooltip exibe apenas valor |
| **Mapa Editável** | `warm` | `true` | `modified`, `noData`, `extrapolated`, `warning` | Fonte: `editableMap` do `useMapStore` |
| **Análise › VE Lambda** | `warm` | `false` | `noData` | Fonte: `tuningOutput.veLambdaMap` |
| **Análise › Amostras** | `coverage` | `false` | `noData` | Fonte: `tuningOutput.sampleCountMap` |
| **Análise › Confiança** | `confidence` | `false` | `noData` | Fonte: `tuningOutput.confidenceMap` |
| **Análise › CV** | `confidence` (invertido) | `false` | `noData` | Fonte: `tuningOutput.cvMap`; escala invertida: `confidenceScale(1 - cv/cv_threshold)` |
| **Análise › Correção %** | `diverging` | `false` | `noData` | Fonte: `tuningOutput.correctionPctMap` |
| **Análise › Convergência** | `convergence` | `false` | `noData` | Fonte: `tuningOutput.convergenceMap` |

### Exemplo de uso — Mapa Editável

```tsx
// features/tuning/ve/VETab.tsx
import { useMapStore } from '@/store/mapStore'
import { useTuningStore } from '@/store/tuningStore'
import { HeatmapTable } from '@/components/HeatmapTable'

function EditableMapSection() {
  const originalMap = useMapStore(s => s.originalMap)
  const editableMap = useMapStore(s => s.editableMap)
  const updateCell  = useMapStore(s => s.updateCell)
  const output      = useTuningStore(s => s.lastOutput)

  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)

  // Monta cellMeta a partir do TuningOutput
  const cellMeta = useMemo<CellMeta[][] | undefined>(() => {
    if (!output || !originalMap) return undefined
    return originalMap.mapBreakpoints.map((_, row) =>
      originalMap.rpmBreakpoints.map((_, col) => ({
        modified:     editableMap![row][col] !== originalMap.cells[row][col],
        noData:       output.cellsNoData.some(([r, c]) => r === row && c === col),
        extrapolated: output.cellsExtrapolated.some(e => e.rowI === row && e.colJ === col),
        warning: [
          ...output.monotonicityWarnings.filter(([r, c]) => r === row && c === col)
            .map(() => 'Violação de monotonicidade MAP'),
          ...output.gradientWarnings.filter(w => w.rowI === row && w.colJ === col)
            .map(w => `Gradiente excessivo: ${w.gradientPct.toFixed(1)}%`),
        ].join('\n') || undefined,
      }))
    )
  }, [output, originalMap, editableMap])

  // Tooltip rico com dados do TuningOutput
  const getTooltip = useCallback((row: number, col: number): TooltipContent | null => {
    if (!originalMap || !editableMap) return null
    const rpm   = originalMap.rpmBreakpoints[col]
    const mapKpa = originalMap.mapBreakpoints[row]
    const current = editableMap[row][col]
    const primary: { label: string; value: string }[] = [
      { label: 'RPM', value: String(rpm) },
      { label: 'MAP', value: `${mapKpa} kPa` },
      { label: 'Valor atual', value: String(current) },
    ]
    if (output) {
      const veLambda   = output.veLambdaMap[row][col]
      const samples    = output.sampleCountMap[row][col]
      const confidence = output.confidenceMap[row][col]
      const cv         = output.cvMap[row][col]
      const correction = output.correctionPctMap[row][col]
      const converged  = output.convergenceMap[row][col]
      if (veLambda !== null) primary.push({ label: 'VE Lambda', value: veLambda.toFixed(0) })
      primary.push({ label: 'Amostras', value: String(samples) })
      if (confidence !== null) primary.push({ label: 'Confiança', value: confidence.toFixed(2) })
      if (cv !== null) primary.push({ label: 'CV', value: cv.toFixed(3) })
      primary.push({ label: 'Correção', value: `${correction >= 0 ? '+' : ''}${correction.toFixed(1)}%` })
      if (converged !== null) primary.push({ label: 'Convergida', value: converged ? 'sim' : 'não' })
    }
    return { primary }
  }, [originalMap, editableMap, output])

  return (
    <HeatmapTable
      data={editableMap ?? []}
      rowLabels={originalMap?.mapBreakpoints ?? []}
      colLabels={originalMap?.rpmBreakpoints ?? []}
      colorScale="warm"
      editable
      cellMeta={cellMeta}
      selectedCells={selectedCells}
      hoveredCell={hoveredCell}
      onSelectionChange={setSelectedCells}
      onHover={(row, col) => setHoveredCell({ row, col })}
      onHoverEnd={() => setHoveredCell(null)}
      onCellChange={updateCell}
      tooltip={getTooltip}
    />
  )
}
```
