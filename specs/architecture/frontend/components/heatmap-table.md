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

## Escalas de cor (`colorScales.ts`)

Cada escala recebe um valor + contexto (`min`, `max`, `absMax` globais do dataset, ignorando `null`/`boolean`) e retorna uma cor CSS. `null` sempre renderiza cinza escuro.

| `ColorScale` | Gradiente | Uso |
|--------------|-----------|-----|
| `warm` | azul → verde → amarelo → vermelho (3 segmentos lineares sobre `[min, max]`) | Mapa editável, original, VE Lambda |
| `diverging` | azul (neg) → branco (zero) → vermelho (pos); satura em `±absMax` | Correção % |
| `confidence` | vermelho (0) → amarelo (0.5) → verde (1) | Confiança; e CV invertido: `confidenceScale(1 - cv/cv_threshold)` |
| `coverage` | cinza (0 = sem dados) → azul saturado (`N ≥ saturationAt`, padrão 100) | Contagem de amostras |
| `convergence` | cinza (`null`) · âmbar (`false`) · verde (`true`) | Convergência |

A cor do texto da célula é branca ou preta conforme a luminância do fundo (`(0.299r + 0.587g + 0.114b)/255 > 0.5` → texto escuro).

## Estados visuais de célula

Cada célula é um `<div>` `position: relative` que combina indicadores simultaneamente.

| Estado | Visual |
|--------|--------|
| **Normal** | Fundo da escala; texto centralizado `text-xs` |
| **Hover** | `brightness(1.25)` + `ring-2 ring-white ring-inset`. Se também selecionada, o estilo de seleção prevalece |
| **Selecionada** | `ring-2 ring-white ring-inset` + `outline outline-2 outline-blue-500`; fundo mantém a cor da escala. Em retângulo, o outline só nas bordas externas |
| **Modificada** | Ponto vermelho 6px no canto sup. dir. |
| **Warning** | `outline outline-2 outline-orange-400 outline-dashed` + ícone `⚠` âmbar no canto sup. esq.; tooltip destaca a mensagem. Se selecionada, o outline azul prevalece, o `⚠` permanece |
| **Sem dados** | Fundo listrado diagonal cinza; texto "—"; não editável mesmo com `editable=true` |
| **Extrapolada** | Ícone `↗` no canto inf. dir.; tooltip `secondary` = "Calculado por regra [nome]". Coexiste com `modified` |

## Edição de células

Ativada por duplo clique ou `Enter` com 1+ células selecionadas. O modo de edição substitui o texto por um `<input>` centralizado (`autoFocus`).

### Formatos aceitos

| Formato | Exemplo | Comportamento |
|---------|---------|---------------|
| Inteiro puro/com sinal | `850`, `+850` | Valor = 850 |
| Percentual relativo | `+5%`, `-3%` | `round(currentValue × (1 ± pct/100))` |
| Float | `850.7` | `round` → 851 |

Resultado válido se for número em `[100, 9999]`. Inválido: `<input>` com borda vermelha, valor NÃO confirmado, permanece em edição.

### Navegação durante a edição

| Tecla | Ação |
|-------|------|
| `Enter` | Confirma (se válido) → célula abaixo |
| `Tab` / `Shift+Tab` | Confirma → célula à direita / esquerda |
| `Escape` | Cancela, restaura o valor anterior |
| Clique fora | Confirma (se válido) |

### Edição em bulk

Múltiplas células + `Enter` → campo de edição como overlay flutuante (não inline). Aplica o valor a cada célula usando o valor atual de cada uma como base para percentuais. Cada célula passa pela validação 100–9999; valores fora do range são **clampeados** (não ignorados).

## Seleção múltipla (`useHeatmapSelection.ts`)

| Interação | Resultado |
|-----------|-----------|
| Clique simples | Só a célula clicada; âncora = clicada |
| `Shift+Clique` | Retângulo do âncora até a clicada |
| `Ctrl/Cmd+Clique` | Adiciona/remove célula individual; âncora = clicada |
| Arrastar | Seleção por retângulo em tempo real (`mousedown` → drag → `mouseup` global) |
| `Enter` com ≥2 células | Edição bulk |

A seleção retangular é o conjunto de todas as células entre o âncora e a célula atual (chaves `"row:col"`).

## Navegação por teclado (`useHeatmapKeyboard.ts`)

Requer `tabIndex={0}` na tabela. Fora do modo de edição:

| Tecla | Ação |
|-------|------|
| `Arrow*` | Move a seleção (clampada aos limites da grade) |
| `Shift+Arrow*` | Estende o retângulo a partir do âncora |
| `Tab` / `Shift+Tab` | Próxima/anterior célula; quebra de linha automática |
| `Home` / `End` | Primeira/última coluna da linha (`Shift` estende) |
| `PageUp` / `PageDown` | Primeira/última linha da coluna |
| `Enter` | Edição (se `editable` e 1 célula) ou edição bulk (múltiplas) |
| `Escape` | Limpa a seleção |

## Performance

Mapa de no máximo 16×16 = 256 células — sem virtualização. Mas hover/tooltip mudam com alta frequência:
- `HeatmapCell` é `React.memo` com comparação customizada (re-renderiza só se `value`, `bgColor`, `isSelected`, `isHovered` ou campos de `meta` mudarem)
- `HeatmapTable` calcula `bgColor` e booleanos de estado em `useMemo` e os passa como **primitivos** (não objetos anônimos)

## Header e tooltip

Headers de RPM (`<thead sticky top-0>`) e labels de MAP (`<td sticky left-0>`); z-index decrescente: canto > header RPM > label MAP > células de dados. Tooltip via `<Tooltip>` do shadcn/ui (`delayDuration={300}`): linhas `primary` (label+valor) + `secondary` em itálico com borda superior.

## Usos na aba VE

| Instância | `colorScale` | `editable` | `cellMeta` | Fonte |
|-----------|-------------|------------|------------|-------|
| Mapa Original | `warm` | `false` | — | `originalMap.cells` |
| Mapa Editável | `warm` | `true` | `modified`, `noData`, `extrapolated`, `warning` | `editableMap` |
| Análise › VE Lambda | `warm` | `false` | `noData` | `tuningOutput.veLambdaMap` |
| Análise › Amostras | `coverage` | `false` | `noData` | `tuningOutput.sampleCountMap` |
| Análise › Confiança | `confidence` | `false` | `noData` | `tuningOutput.confidenceMap` |
| Análise › CV | `confidence` (invertido) | `false` | `noData` | `tuningOutput.cvMap` |
| Análise › Correção % | `diverging` | `false` | `noData` | `tuningOutput.correctionPctMap` |
| Análise › Convergência | `convergence` | `false` | `noData` | `tuningOutput.convergenceMap` |

O pai (`VETab`) monta `cellMeta` e `tooltip` em `useMemo`/`useCallback` a partir de `TuningOutput` + `editableMap`: `modified` = `editableMap[r][c] !== originalMap.cells[r][c]`; `noData`/`extrapolated`/`warning` derivados de `cellsNoData`, `cellsExtrapolated`, `monotonicityWarnings`, `gradientWarnings`. O `tooltip` sempre lista todos os campos disponíveis.
