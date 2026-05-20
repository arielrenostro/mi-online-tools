# Store: `useUIStore`

Estado de interface: painéis colapsados, aba ativa, visibilidade de colunas e layout de gráficos. Todo o estado persiste em localStorage (`miot:ui`).

**Arquivo:** `src/store/uiStore.ts`

## Estado

```typescript
const INITIAL_PANEL_ID = uuidv4()

const initialState: UIState = {
  originalMapCollapsed: false,
  tuningAnalysisMode:   've_lambda',
  datalogTab:           'dashboard',
  columnVisibility:     {},   // vazio = todas as colunas visíveis
  chartLayout:          { type: 'panel', panelId: INITIAL_PANEL_ID, signals: ['RPM'] },
  chartsHeight:         400,  // altura da área de gráficos (px)
}
```

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `originalMapCollapsed` | `boolean` | `false` | Painel "Mapa Original" recolhido na aba VE |
| `tuningAnalysisMode` | `TuningAnalysisMode` | `'ve_lambda'` | Aba ativa do heatmap de análise |
| `datalogTab` | `DatalogTab` | `'dashboard'` | Aba ativa no Datalog (espelho do Router, p/ restore) |
| `columnVisibility` | `Record<string, boolean>` | `{}` | Colunas visíveis na aba Dados; ausência = visível |
| `chartLayout` | `ChartLayout` | painel único `['RPM']` | Árvore de layout dos painéis |
| `chartsHeight` | `number` | `400` | Altura da área de gráficos; ajustável via drag |

## Implementação

```typescript
interface UIActions {
  setOriginalMapCollapsed(v: boolean): void
  setTuningAnalysisMode(mode: TuningAnalysisMode): void
  setDatalogTab(tab: DatalogTab): void
  setColumnVisibility(signal: string, visible: boolean): void
  setChartLayout(layout: ChartLayout): void
  addChartPanel(parentId: string, direction: 'horizontal' | 'vertical'): void
  removeChartPanel(panelId: string): void
  updatePanelSignals(panelId: string, signals: string[]): void
  setChartsHeight(h: number): void   // clampado 200–1200 no componente
  hydrate(state: Partial<UIState>): void  // sessionRestorer
}

export const useUIStore = create<UIStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setOriginalMapCollapsed(v) { set({ originalMapCollapsed: v }); persist() },
    setTuningAnalysisMode(mode) { set({ tuningAnalysisMode: mode }); persist() },
    setDatalogTab(tab) { set({ datalogTab: tab }); persist() },  // espelho do Router

    setColumnVisibility(signal, visible) {
      set({ columnVisibility: { ...get().columnVisibility, [signal]: visible } }); persist()
    },
    setChartLayout(layout) { set({ chartLayout: layout }); persist() },

    addChartPanel(parentId, direction) {
      const newPanel: ChartPanel = { type: 'panel', panelId: uuidv4(), signals: [] }
      const updated = splitPanel(get().chartLayout, parentId, direction, newPanel)
      if (updated === null) { console.warn(`[mft] addChartPanel: "${parentId}" não encontrado`); return }
      set({ chartLayout: updated }); persist()
    },

    removeChartPanel(panelId) {
      if (countPanels(get().chartLayout) <= 1) return  // mínimo de 1 painel
      const updated = removePanel(get().chartLayout, panelId)
      if (updated === null) { console.warn(`[mft] removeChartPanel: "${panelId}" não encontrado`); return }
      set({ chartLayout: updated }); persist()
    },

    updatePanelSignals(panelId, signals) {
      const updated = updateSignals(get().chartLayout, panelId, signals)
      if (updated === null) { console.warn(`[mft] updatePanelSignals: "${panelId}" não encontrado`); return }
      set({ chartLayout: updated }); persist()
    },

    hydrate(savedState) { set({ ...initialState, ...savedState }) },  // não persiste — veio do localStorage
  }))
)

function persist(): void {
  const s = useUIStore.getState()
  lsSet<UIState>('miot:ui', {
    originalMapCollapsed: s.originalMapCollapsed, tuningAnalysisMode: s.tuningAnalysisMode,
    datalogTab: s.datalogTab, columnVisibility: s.columnVisibility, chartLayout: s.chartLayout,
  })
}
```

## Helpers de `ChartLayout`

A árvore é manipulada por funções puras imutáveis. Retornam `null` se o nó alvo não for encontrado.

### `splitPanel` — adiciona painel ao lado de um existente

Substitui o nó `panelId === targetId` por um `ChartSplit` contendo o nó original + o novo painel.

```typescript
function splitPanel(
  layout: ChartLayout, targetId: string,
  direction: 'horizontal' | 'vertical', newPanel: ChartPanel
): ChartLayout | null {
  if (layout.type === 'panel') {
    if (layout.panelId === targetId)
      return { type: 'split', direction, children: [layout, newPanel] }
    return null
  }
  let changed = false
  const newChildren = layout.children.map((child) => {
    if (changed) return child
    const result = splitPanel(child, targetId, direction, newPanel)
    if (result !== null) { changed = true; return result }
    return child
  })
  return changed ? { ...layout, children: newChildren } : null
}
```

### `removePanel` — remove um painel

Quando um `ChartSplit` fica com 1 filho após a remoção, é substituído pelo próprio filho (evita splits desnecessários).

```typescript
function removePanel(layout: ChartLayout, targetId: string): ChartLayout | null {
  if (layout.type === 'panel') return layout.panelId === targetId ? null : layout
  const newChildren: ChartLayout[] = []
  let removed = false
  for (const child of layout.children) {
    const result = removePanel(child, targetId)
    if (result === null && !removed) removed = true   // filho removido
    else if (result !== null) newChildren.push(result)
    else newChildren.push(child)
  }
  if (!removed) return null
  if (newChildren.length === 1) return newChildren[0]  // split colapsa no único filho
  return { ...layout, children: newChildren }
}
```

### `updateSignals` e `countPanels`

```typescript
function updateSignals(layout: ChartLayout, targetId: string, signals: string[]): ChartLayout | null {
  if (layout.type === 'panel')
    return layout.panelId === targetId ? { ...layout, signals } : null
  let changed = false
  const newChildren = layout.children.map((child) => {
    if (changed) return child
    const result = updateSignals(child, targetId, signals)
    if (result !== null) { changed = true; return result }
    return child
  })
  return changed ? { ...layout, children: newChildren } : null
}

function countPanels(layout: ChartLayout): number {
  return layout.type === 'panel' ? 1
    : layout.children.reduce((acc, child) => acc + countPanels(child), 0)
}
```

## Exemplos de `chartLayout`

```typescript
// 1 painel
{ type: 'panel', panelId: 'abc-123', signals: ['RPM'] }

// Após "Dividir ↔" — 2 painéis lado a lado
{ type: 'split', direction: 'horizontal', children: [
  { type: 'panel', panelId: 'abc-123', signals: ['RPM'] },
  { type: 'panel', panelId: 'def-456', signals: [] },
] }

// Após "Dividir ↕" no 2º — 3 painéis (A | B/C)
{ type: 'split', direction: 'horizontal', children: [
  { type: 'panel', panelId: 'abc-123', signals: ['RPM'] },
  { type: 'split', direction: 'vertical', children: [
    { type: 'panel', panelId: 'def-456', signals: ['Lambda 1', 'Lambda Target'] },
    { type: 'panel', panelId: 'ghi-789', signals: ['CLT'] },
  ] },
] }
```

## `columnVisibility` na aba Dados

Todas as colunas visíveis por padrão; o usuário oculta individualmente. Convenção "ausência = visível" garante que colunas novas (de logs adicionados depois) apareçam automaticamente.

```typescript
const isVisible = (signal: string) => columnVisibility[signal] !== false
const handleToggle = (signal: string) => setColumnVisible(signal, !isVisible(signal))
```

## Persistência

Todo o `UIState` vai numa única chave `miot:ui`, de forma **síncrona** (`localStorage.setItem` após cada mudança, sem debounce — dados pequenos).

## `datalogTab` e React Router

`datalogTab` é um **espelho** da URL dentro de `/datalog`. O React Router é a fonte de verdade da aba ativa (`<NavLink>` atualiza a URL). `datalogTab` serve só para restauração: ao reabrir o app, o `sessionRestorer` faz `navigate('/datalog/' + savedUI.datalogTab)`; depois o Router assume.

## Seletores recomendados

```typescript
const isCollapsed         = useUIStore((s) => s.originalMapCollapsed)
const setCollapsed        = useUIStore((s) => s.setOriginalMapCollapsed)
const analysisMode        = useUIStore((s) => s.tuningAnalysisMode)
const setAnalysisMode     = useUIStore((s) => s.setTuningAnalysisMode)
const columnVisibility    = useUIStore((s) => s.columnVisibility)
const setColumnVisibility = useUIStore((s) => s.setColumnVisibility)
const chartLayout         = useUIStore((s) => s.chartLayout)
const addChartPanel       = useUIStore((s) => s.addChartPanel)
const removeChartPanel    = useUIStore((s) => s.removeChartPanel)
const updatePanelSignals  = useUIStore((s) => s.updatePanelSignals)
```
