import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { UIState, MapaAnalysisMode, DatalogTab, MapaTab, ChartLayout, ChartPanel, ChartSplit } from '@/types/ui'
import { lsSet } from '@/persistence/localStorage'
import { buildDefaultChartLayout, findPanel, resizePanelHeight, resizePanelWidth } from '@/utils/chartLayoutSize'
import { migrateChartLayout } from '@/utils/chartLayoutMigration'

const initialState: UIState = {
  originalMapCollapsed: false,
  mapaAnalysisMode:     've_lambda',
  datalogTab:           'logs',
  mapaTab:              've',
  columnVisibility:     {},
  chartLayout:          buildDefaultChartLayout(),
  chartSidebarOpen:     true,
}

interface UIActions {
  setOriginalMapCollapsed(v: boolean): void
  setMapaAnalysisMode(mode: MapaAnalysisMode): void
  setDatalogTab(tab: DatalogTab): void
  setMapaTab(tab: MapaTab): void
  setColumnVisibility(signal: string, visible: boolean): void
  setChartLayout(layout: ChartLayout): void
  addChartPanel(parentId: string, direction: 'horizontal' | 'vertical'): void
  removeChartPanel(panelId: string): void
  updatePanelSignals(panelId: string, signals: string[]): void
  /** `dir` 1 = aumentar, -1 = diminuir; mexe na altura da linha do painel. */
  resizePanelHeight(panelId: string, dir: 1 | -1): void
  /** `dir` 1 = aumentar, -1 = diminuir; toma do (ou devolve ao) vizinho lado a lado. */
  resizePanelWidth(panelId: string, dir: 1 | -1): void
  setChartSidebarOpen(v: boolean): void
  /** `chartsHeight` só existe em estados salvos pela versão com arrasto; `tuningAnalysisMode` é o nome antigo de `mapaAnalysisMode` — usados na migração. */
  hydrate(state: Partial<UIState> & { chartsHeight?: number; tuningAnalysisMode?: MapaAnalysisMode }): void
}

export const useUIStore = create<UIState & UIActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setOriginalMapCollapsed(v) { set({ originalMapCollapsed: v }); persist() },
    setMapaAnalysisMode(mode) { set({ mapaAnalysisMode: mode }); persist() },
    setDatalogTab(tab) { if (get().datalogTab !== tab) { set({ datalogTab: tab }); persist() } },
    setMapaTab(tab) { if (get().mapaTab !== tab) { set({ mapaTab: tab }); persist() } },

    setColumnVisibility(signal, visible) {
      set({ columnVisibility: { ...get().columnVisibility, [signal]: visible } })
      persist()
    },

    setChartLayout(layout) { set({ chartLayout: layout }); persist() },

    addChartPanel(parentId, direction) {
      const source = findPanel(get().chartLayout, parentId)
      if (!source) return
      // o novo painel nasce com a altura do de origem; nenhum outro painel muda de tamanho
      const newPanel: ChartPanel = { type: 'panel', panelId: crypto.randomUUID(), signals: [], height: source.height }
      const updated = splitPanel(get().chartLayout, parentId, direction, newPanel)
      if (updated) { set({ chartLayout: updated }); persist() }
    },

    removeChartPanel(panelId) {
      if (countPanels(get().chartLayout) <= 1) return
      const current = get().chartLayout
      const updated = removePanel(current, panelId)
      if (updated !== null && updated !== current) { set({ chartLayout: updated }); persist() }
    },

    updatePanelSignals(panelId, signals) {
      const updated = updateSignals(get().chartLayout, panelId, signals)
      if (updated) { set({ chartLayout: updated }); persist() }
    },

    resizePanelHeight(panelId, dir) {
      const updated = resizePanelHeight(get().chartLayout, panelId, dir)
      if (updated) { set({ chartLayout: updated }); persist() }
    },

    resizePanelWidth(panelId, dir) {
      const updated = resizePanelWidth(get().chartLayout, panelId, dir)
      if (updated) { set({ chartLayout: updated }); persist() }
    },

    setChartSidebarOpen(v) { set({ chartSidebarOpen: v }); persist() },

    hydrate(savedState) {
      const { chartsHeight, chartLayout, tuningAnalysisMode, ...rest } = savedState
      const migratedLayout = chartLayout ? migrateChartLayout(chartLayout, chartsHeight) : null
      set({
        ...initialState,
        ...(tuningAnalysisMode ? { mapaAnalysisMode: tuningAnalysisMode } : {}),
        ...rest,
        ...(migratedLayout ? { chartLayout: migratedLayout } : {}),
      })
    },
  }))
)

function persist() {
  const s = useUIStore.getState()
  lsSet<UIState>('miot:ui', {
    originalMapCollapsed: s.originalMapCollapsed,
    mapaAnalysisMode:     s.mapaAnalysisMode,
    datalogTab:           s.datalogTab,
    mapaTab:              s.mapaTab,
    columnVisibility:     s.columnVisibility,
    chartLayout:          s.chartLayout,
    chartSidebarOpen:     s.chartSidebarOpen,
  })
}

function splitPanel(layout: ChartLayout, targetId: string, direction: 'horizontal' | 'vertical', newPanel: ChartPanel): ChartLayout | null {
  if (layout.type === 'panel') {
    if (layout.panelId !== targetId) return null
    const children: [ChartLayout, ChartLayout] = [layout, newPanel]
    const splitId = crypto.randomUUID()
    const split: ChartSplit = direction === 'horizontal'
      ? { type: 'split', direction, children, splitId, ratio: 0.5 }
      : { type: 'split', direction, children, splitId }
    return split
  }
  let changed = false
  const newChildren = layout.children.map(child => {
    if (changed) return child
    const r = splitPanel(child, targetId, direction, newPanel)
    if (r) { changed = true; return r }
    return child
  }) as [ChartLayout, ChartLayout]
  return changed ? { ...layout, children: newChildren } : null
}

function removePanel(layout: ChartLayout, targetId: string): ChartLayout | null {
  if (layout.type === 'panel') {
    return layout.panelId === targetId ? null : layout
  }
  const [c0, c1] = layout.children
  const r0 = removePanel(c0, targetId)
  if (r0 !== c0) {
    if (r0 === null) return c1
    return { ...layout, children: [r0, c1] }
  }
  const r1 = removePanel(c1, targetId)
  if (r1 !== c1) {
    if (r1 === null) return c0
    return { ...layout, children: [c0, r1] }
  }
  return layout
}

function updateSignals(layout: ChartLayout, targetId: string, signals: string[]): ChartLayout | null {
  if (layout.type === 'panel') {
    if (layout.panelId !== targetId) return null
    return { ...layout, signals }
  }
  let changed = false
  const newChildren = layout.children.map(child => {
    if (changed) return child
    const r = updateSignals(child, targetId, signals)
    if (r) { changed = true; return r }
    return child
  }) as [ChartLayout, ChartLayout]
  return changed ? { ...layout, children: newChildren } : null
}

function countPanels(layout: ChartLayout): number {
  if (layout.type === 'panel') return 1
  return layout.children.reduce((acc, c) => acc + countPanels(c), 0)
}

export function flattenPanels(layout: ChartLayout): import('@/types/ui').ChartPanel[] {
  if (layout.type === 'panel') return [layout]
  return layout.children.flatMap(c => flattenPanels(c))
}
