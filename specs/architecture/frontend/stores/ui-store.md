# Store: `useUIStore`

Store Zustand responsável pelo estado de interface do usuário: painéis colapsados, aba ativa, visibilidade de colunas e o layout de painéis de gráficos. Todo o estado é persistido em localStorage.

---

## Estado completo

```typescript
// src/store/uiStore.ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { UIState, TuningAnalysisMode, DatalogTab, ChartLayout, ChartPanel } from '@/types/ui'
import { v4 as uuidv4 } from 'uuid'

// Valor inicial do chartLayout: um único painel com RPM como sinal padrão
const INITIAL_PANEL_ID = uuidv4()

const initialState: UIState = {
  originalMapCollapsed: false,
  tuningAnalysisMode:   've_lambda',
  datalogTab:           'dashboard',
  columnVisibility:     {},     // vazio = todas as colunas visíveis por padrão
  chartLayout:          {
    type:    'panel',
    panelId: INITIAL_PANEL_ID,
    signals: ['RPM'],
  },
}
```

### Campos do estado

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `originalMapCollapsed` | `boolean` | `false` | Se o painel "Mapa Original" está recolhido na aba VE |
| `tuningAnalysisMode` | `TuningAnalysisMode` | `'ve_lambda'` | Aba ativa do heatmap de análise (Seção 3 da aba VE) |
| `datalogTab` | `DatalogTab` | `'dashboard'` | Aba ativa no Datalog (espelho do React Router — para persistência) |
| `columnVisibility` | `Record<string, boolean>` | `{}` | Colunas visíveis na aba Dados; ausência = visível |
| `chartLayout` | `ChartLayout` | painel único com RPM | Árvore de layout dos painéis de gráfico |

---

## Implementação do store

```typescript
// src/store/uiStore.ts (continuação)
import { lsSet } from '@/persistence/localStorage'

interface UIActions {
  setOriginalMapCollapsed(v: boolean): void
  setTuningAnalysisMode(mode: TuningAnalysisMode): void
  setDatalogTab(tab: DatalogTab): void
  setColumnVisibility(signal: string, visible: boolean): void
  setChartLayout(layout: ChartLayout): void
  addChartPanel(parentId: string, direction: 'horizontal' | 'vertical'): void
  removeChartPanel(panelId: string): void
  updatePanelSignals(panelId: string, signals: string[]): void

  /** Usado pelo sessionRestorer para restaurar o estado sem side effects. */
  hydrate(state: Partial<UIState>): void
}

type UIStore = UIState & UIActions

export const useUIStore = create<UIStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ── setOriginalMapCollapsed ────────────────────────────────────────────────
    setOriginalMapCollapsed(v: boolean): void {
      set({ originalMapCollapsed: v })
      persist()
    },

    // ── setTuningAnalysisMode ─────────────────────────────────────────────────
    setTuningAnalysisMode(mode: TuningAnalysisMode): void {
      set({ tuningAnalysisMode: mode })
      persist()
    },

    // ── setDatalogTab ─────────────────────────────────────────────────────────
    setDatalogTab(tab: DatalogTab): void {
      // Nota: a aba ativa é controlada primariamente pelo React Router (NavLink).
      // Este campo é mantido no UIStore apenas para que a aba seja restaurada
      // ao reabrir o app (o React Router usa a URL, não este estado).
      set({ datalogTab: tab })
      persist()
    },

    // ── setColumnVisibility ───────────────────────────────────────────────────
    setColumnVisibility(signal: string, visible: boolean): void {
      const updated = { ...get().columnVisibility, [signal]: visible }
      set({ columnVisibility: updated })
      persist()
    },

    // ── setChartLayout ────────────────────────────────────────────────────────
    setChartLayout(layout: ChartLayout): void {
      set({ chartLayout: layout })
      persist()
    },

    // ── addChartPanel ─────────────────────────────────────────────────────────
    addChartPanel(parentId: string, direction: 'horizontal' | 'vertical'): void {
      const { chartLayout } = get()
      const newPanelId = uuidv4()
      const newPanel: ChartPanel = {
        type:    'panel',
        panelId: newPanelId,
        signals: [],          // novo painel começa vazio — usuário adiciona sinais
      }

      // Percorre a árvore de layout e substitui o nó com panelId === parentId
      // pelo nó de split contendo o painel original + o novo painel
      const updated = splitPanel(chartLayout, parentId, direction, newPanel)
      if (updated === null) {
        console.warn(`[mft] addChartPanel: painel "${parentId}" não encontrado`)
        return
      }

      set({ chartLayout: updated })
      persist()
    },

    // ── removeChartPanel ──────────────────────────────────────────────────────
    removeChartPanel(panelId: string): void {
      const { chartLayout } = get()

      // Conta o total de painéis — não remover o último
      const totalPanels = countPanels(chartLayout)
      if (totalPanels <= 1) {
        return   // mínimo de 1 painel — botão ✕ deve estar oculto neste caso
      }

      const updated = removePanel(chartLayout, panelId)
      if (updated === null) {
        console.warn(`[mft] removeChartPanel: painel "${panelId}" não encontrado`)
        return
      }

      set({ chartLayout: updated })
      persist()
    },

    // ── updatePanelSignals ────────────────────────────────────────────────────
    updatePanelSignals(panelId: string, signals: string[]): void {
      const { chartLayout } = get()
      const updated = updateSignals(chartLayout, panelId, signals)
      if (updated === null) {
        console.warn(`[mft] updatePanelSignals: painel "${panelId}" não encontrado`)
        return
      }

      set({ chartLayout: updated })
      persist()
    },

    // ── hydrate (sessionRestorer) ─────────────────────────────────────────────
    hydrate(savedState: Partial<UIState>): void {
      set({ ...initialState, ...savedState })
      // Não chama persist() aqui — os dados vieram do localStorage, não precisam ser re-salvos
    },
  }))
)

// ── Helper: persiste todo o UIState no localStorage ───────────────────────────
function persist(): void {
  const state = useUIStore.getState()
  lsSet<UIState>('mft:ui', {
    originalMapCollapsed: state.originalMapCollapsed,
    tuningAnalysisMode:   state.tuningAnalysisMode,
    datalogTab:           state.datalogTab,
    columnVisibility:     state.columnVisibility,
    chartLayout:          state.chartLayout,
  })
}
```

---

## Funções auxiliares para manipulação do `ChartLayout`

A árvore `ChartLayout` é manipulada por funções puras que retornam uma nova árvore (imutabilidade). Retornam `null` se o nó alvo não for encontrado.

### `splitPanel` — adiciona um novo painel ao lado de um existente

```typescript
// src/store/uiStore.ts — helpers

import type { ChartLayout, ChartPanel, ChartSplit } from '@/types/ui'

/**
 * Substitui o nó com panelId === targetId por um nó ChartSplit contendo
 * o nó original e um novo painel.
 *
 * @param layout    Raiz da árvore atual
 * @param targetId  panelId do painel que será dividido
 * @param direction Direção da divisão
 * @param newPanel  Novo painel a inserir ao lado do original
 * @returns         Nova árvore com o split, ou null se targetId não encontrado
 */
function splitPanel(
  layout: ChartLayout,
  targetId: string,
  direction: 'horizontal' | 'vertical',
  newPanel: ChartPanel
): ChartLayout | null {
  if (layout.type === 'panel') {
    if (layout.panelId === targetId) {
      // Substitui este painel por um split contendo ele + o novo painel
      const split: ChartSplit = {
        type:      'split',
        direction,
        children:  [layout, newPanel],
      }
      return split
    }
    return null   // não encontrado neste galho
  }

  // layout.type === 'split'
  let changed = false
  const newChildren = layout.children.map((child) => {
    if (changed) return child
    const result = splitPanel(child, targetId, direction, newPanel)
    if (result !== null) {
      changed = true
      return result
    }
    return child
  })

  if (!changed) return null
  return { ...layout, children: newChildren }
}
```

### `removePanel` — remove um painel da árvore

```typescript
/**
 * Remove o painel com panelId === targetId da árvore.
 * Quando um ChartSplit fica com apenas 1 filho após a remoção, o split é
 * substituído diretamente pelo filho (evita splits desnecessários).
 *
 * @returns Nova árvore sem o painel, ou null se targetId não encontrado
 */
function removePanel(
  layout: ChartLayout,
  targetId: string
): ChartLayout | null {
  if (layout.type === 'panel') {
    // Este é o nó a remover — retorna um sinal especial
    // (o pai tratará a remoção)
    return layout.panelId === targetId ? null : layout
  }

  // layout.type === 'split'
  const newChildren: ChartLayout[] = []
  let removed = false

  for (const child of layout.children) {
    const result = removePanel(child, targetId)
    if (result === null && !removed) {
      // Este filho foi removido
      removed = true
      // Não adiciona nada — o filho desaparece
    } else if (result !== null) {
      newChildren.push(result)
    } else {
      newChildren.push(child)
    }
  }

  if (!removed) return null   // targetId não encontrado neste galho

  // Se sobrou apenas 1 filho, o split se torna o filho diretamente
  if (newChildren.length === 1) {
    return newChildren[0]
  }

  return { ...layout, children: newChildren }
}
```

### `updateSignals` — atualiza os sinais de um painel

```typescript
/**
 * Atualiza a lista de sinais do painel com panelId === targetId.
 *
 * @returns Nova árvore com os sinais atualizados, ou null se targetId não encontrado
 */
function updateSignals(
  layout: ChartLayout,
  targetId: string,
  signals: string[]
): ChartLayout | null {
  if (layout.type === 'panel') {
    if (layout.panelId === targetId) {
      return { ...layout, signals }
    }
    return null
  }

  let changed = false
  const newChildren = layout.children.map((child) => {
    if (changed) return child
    const result = updateSignals(child, targetId, signals)
    if (result !== null) {
      changed = true
      return result
    }
    return child
  })

  if (!changed) return null
  return { ...layout, children: newChildren }
}

/**
 * Conta o número total de painéis folha na árvore.
 */
function countPanels(layout: ChartLayout): number {
  if (layout.type === 'panel') return 1
  return layout.children.reduce((acc, child) => acc + countPanels(child), 0)
}
```

---

## Exemplos de estados de `chartLayout`

### Estado inicial (1 painel)

```typescript
{
  type:    'panel',
  panelId: 'abc-123',
  signals: ['RPM'],
}
```

### Após "Dividir ↔" no painel inicial (2 painéis lado a lado)

```typescript
{
  type:      'split',
  direction: 'horizontal',
  children:  [
    { type: 'panel', panelId: 'abc-123', signals: ['RPM'] },
    { type: 'panel', panelId: 'def-456', signals: [] },
  ],
}
```

### Após "Dividir ↕" no segundo painel (3 painéis: A|B/C)

```typescript
{
  type:      'split',
  direction: 'horizontal',
  children:  [
    { type: 'panel', panelId: 'abc-123', signals: ['RPM'] },
    {
      type:      'split',
      direction: 'vertical',
      children:  [
        { type: 'panel', panelId: 'def-456', signals: ['Lambda 1', 'Lambda Target'] },
        { type: 'panel', panelId: 'ghi-789', signals: ['CLT'] },
      ],
    },
  ],
}
```

---

## Comportamento de `columnVisibility` na aba Dados

A aba Dados exibe todas as colunas disponíveis por padrão. O usuário pode ocultar individualmente:

```typescript
// Em DataTab.tsx:
const columnVisibility   = useUIStore((s) => s.columnVisibility)
const setColumnVisible   = useUIStore((s) => s.setColumnVisibility)
const availableSignals   = useLogStore(selectAllSignals)

// Uma coluna é visível se não estiver explicitamente definida como false
const isVisible = (signal: string) => columnVisibility[signal] !== false

// Ao clicar no toggle de uma coluna:
const handleToggle = (signal: string) => {
  setColumnVisible(signal, !isVisible(signal))
}
```

O uso de "ausência = visível" garante que colunas novas (de logs adicionados depois) apareçam automaticamente sem requerer configuração adicional.

---

## Persistência

Todo o `UIState` é serializado como JSON e salvo em uma única chave do localStorage: `mft:ui`.

```typescript
// Exemplo do que é salvo:
{
  "originalMapCollapsed": false,
  "tuningAnalysisMode": "ve_lambda",
  "datalogTab": "dashboard",
  "columnVisibility": { "CLT": false, "Pedal": false },
  "chartLayout": {
    "type": "split",
    "direction": "horizontal",
    "children": [
      { "type": "panel", "panelId": "abc-123", "signals": ["RPM", "MAP"] },
      { "type": "panel", "panelId": "def-456", "signals": ["Lambda 1"] }
    ]
  }
}
```

A persistência é feita de forma **síncrona** via `localStorage.setItem` (após cada mudança, sem debounce), pois os dados são pequenos e o custo é negligenciável.

---

## Seletores recomendados para componentes

```typescript
// Para o toggle do Mapa Original na aba VE
const isCollapsed         = useUIStore((s) => s.originalMapCollapsed)
const setCollapsed        = useUIStore((s) => s.setOriginalMapCollapsed)

// Para as abas de análise (seção Análise da aba VE)
const analysisMode        = useUIStore((s) => s.tuningAnalysisMode)
const setAnalysisMode     = useUIStore((s) => s.setTuningAnalysisMode)

// Para visibilidade de colunas na aba Dados
const columnVisibility    = useUIStore((s) => s.columnVisibility)
const setColumnVisibility = useUIStore((s) => s.setColumnVisibility)

// Para renderização dos painéis na aba Gráficos
const chartLayout         = useUIStore((s) => s.chartLayout)
const addChartPanel       = useUIStore((s) => s.addChartPanel)
const removeChartPanel    = useUIStore((s) => s.removeChartPanel)
const updatePanelSignals  = useUIStore((s) => s.updatePanelSignals)
```

---

## Observação sobre `datalogTab` e React Router

O campo `datalogTab` no `UIStore` é um **espelho** da URL atual dentro de `/datalog`. O React Router é a fonte de verdade da aba ativa — os `<NavLink>` atualizam a URL e o Router renderiza o componente correto.

O `datalogTab` no UIStore serve apenas para **restauração de sessão**: quando o usuário fecha e reabre o app, o `sessionRestorer` verifica `savedUI.datalogTab` e usa `navigate('/datalog/' + savedUI.datalogTab)` para restaurar a última aba ativa. Após a navegação, o React Router assume o controle.

Isso garante consistência entre a URL exibida na barra de endereço e o estado interno do UIStore.

---

## Localização do arquivo

`src/store/uiStore.ts`
