# Store: `useUIStore`

Estado de interface: painéis colapsados, aba ativa, visibilidade de colunas e layout de gráficos. Todo o estado persiste em localStorage (`miot:ui`), de forma síncrona após cada mudança.

**Arquivo:** `src/store/uiStore.ts`

## Estado

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `originalMapCollapsed` | `boolean` | `false` | Painel "Mapa Original" recolhido na aba VE |
| `tuningAnalysisMode` | `TuningAnalysisMode` | `'ve_lambda'` | Aba ativa do heatmap de análise |
| `datalogTab` | `DatalogTab` | `'dashboard'` | Aba ativa no Datalog (espelho do Router, p/ restore) |
| `columnVisibility` | `Record<string, boolean>` | `{}` | Colunas visíveis na aba Dados; **ausência = visível** |
| `chartLayout` | `ChartLayout` | painel único `['RPM']` | Árvore de layout dos painéis |
| `chartsHeight` | `number` | `400` | Altura da área de gráficos (px); ajustável por drag, clampada 200–1200 no componente |
| `chartSidebarOpen` | `boolean` | `true` | Sidebar de sinais aberta (`true`) ou colapsada |

## Actions

```typescript
interface UIActions {
  setOriginalMapCollapsed(v: boolean): void
  setTuningAnalysisMode(mode: TuningAnalysisMode): void
  setDatalogTab(tab: DatalogTab): void
  setColumnVisibility(signal: string, visible: boolean): void
  setChartLayout(layout: ChartLayout): void
  addChartPanel(parentId: string, direction: 'horizontal' | 'vertical', extraHeight?: number): void
  removeChartPanel(panelId: string): void
  updatePanelSignals(panelId: string, signals: string[]): void
  updateSplitRatio(splitId: string, ratio: number): void
  setChartsHeight(h: number): void
  setChartSidebarOpen(v: boolean): void
  hydrate(state: Partial<UIState>): void   // sessionRestorer; não persiste
}
```

Toda action (exceto `hydrate`) persiste o `UIState` completo em `miot:ui`. As actions de `chartLayout` manipulam a árvore via funções puras imutáveis (abaixo); se o nó alvo não for encontrado, logam warning e não alteram o estado. `addChartPanel` com `direction: 'vertical'` e `extraHeight` também soma `extraHeight` a `chartsHeight`.

## Árvore `ChartLayout`

Cada nó é um painel folha (`type: 'panel'`) ou uma divisão (`type: 'split'` com `direction` e `children`). Funções puras que operam sobre a árvore:

- **`splitPanel(layout, targetId, direction, newPanel)`** — substitui o painel `targetId` por um `split` contendo o painel original + o novo.
- **`removePanel(layout, targetId)`** — remove o painel; um `split` que fica com 1 filho é colapsado nesse filho (evita splits desnecessários).
- **`updateSignals(layout, targetId, signals)`** — atualiza os sinais de um painel.
- **`countPanels(layout)`** — total de painéis folha. `removeChartPanel` é no-op se `countPanels <= 1` (mínimo de 1 painel).

### Exemplos de `chartLayout`

```typescript
// 1 painel
{ type: 'panel', panelId: 'abc', signals: ['RPM'] }

// "Dividir ↔" — 2 painéis lado a lado
{ type: 'split', direction: 'horizontal', children: [
  { type: 'panel', panelId: 'abc', signals: ['RPM'] },
  { type: 'panel', panelId: 'def', signals: [] },
] }

// "Dividir ↕" no 2º — 3 painéis (A | B/C)
{ type: 'split', direction: 'horizontal', children: [
  { type: 'panel', panelId: 'abc', signals: ['RPM'] },
  { type: 'split', direction: 'vertical', children: [
    { type: 'panel', panelId: 'def', signals: ['Lambda 1'] },
    { type: 'panel', panelId: 'ghi', signals: ['CLT'] },
  ] },
] }
```

## `columnVisibility` na aba Dados

Todas as colunas visíveis por padrão; o usuário oculta individualmente. A convenção "ausência = visível" garante que colunas de logs adicionados depois apareçam automaticamente: `isVisible(signal) = columnVisibility[signal] !== false`.

## `datalogTab` e React Router

`datalogTab` é um **espelho** da URL dentro de `/datalog`. O React Router é a fonte de verdade da aba ativa. `datalogTab` serve só para restauração: ao reabrir o app, o `sessionRestorer` faz `navigate('/datalog/' + savedUI.datalogTab)`; depois o Router assume.
