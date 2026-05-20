import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { UIState, TuningAnalysisMode, DatalogTab, ChartLayout, ChartPanel, ChartSplit } from '@/types/ui'
import { lsSet } from '@/persistence/localStorage'

const INITIAL_PANEL_ID = crypto.randomUUID()

const initialState: UIState = {
  originalMapCollapsed: false,
  tuningAnalysisMode:   've_lambda',
  datalogTab:           'logs',
  columnVisibility:     {},
  chartLayout:          { type: 'panel', panelId: INITIAL_PANEL_ID, signals: ['RPM'] },
  chartsHeight:         400,
}

interface UIActions {
  setOriginalMapCollapsed(v: boolean): void
  setTuningAnalysisMode(mode: TuningAnalysisMode): void
  setDatalogTab(tab: DatalogTab): void
  setColumnVisibility(signal: string, visible: boolean): void
  setChartLayout(layout: ChartLayout): void
  addChartPanel(parentId: string, direction: 'horizontal' | 'vertical'): void
  removeChartPanel(panelId: string): void
  updatePanelSignals(panelId: string, signals: string[]): void
  updateSplitRatio(splitId: string, ratio: number): void
  setChartsHeight(h: number): void
  hydrate(state: Partial<UIState>): void
}

export const useUIStore = create<UIState & UIActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setOriginalMapCollapsed(v) { set({ originalMapCollapsed: v }); persist() },
    setTuningAnalysisMode(mode) { set({ tuningAnalysisMode: mode }); persist() },
    setDatalogTab(tab) { set({ datalogTab: tab }); persist() },

    setColumnVisibility(signal, visible) {
      set({ columnVisibility: { ...get().columnVisibility, [signal]: visible } })
      persist()
    },

    setChartLayout(layout) { set({ chartLayout: layout }); persist() },

    addChartPanel(parentId, direction) {
      const newPanel: ChartPanel = { type: 'panel', panelId: crypto.randomUUID(), signals: [] }
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

    updateSplitRatio(splitId, ratio) {
      const updated = updateRatio(get().chartLayout, splitId, ratio)
      if (updated) { set({ chartLayout: updated }); persist() }
    },

    setChartsHeight(h) { set({ chartsHeight: h }); persist() },

    hydrate(savedState) {
      const migratedLayout = savedState.chartLayout ? migrateSplitIds(savedState.chartLayout) : undefined
      set({ ...initialState, ...savedState, ...(migratedLayout ? { chartLayout: migratedLayout } : {}) })
    },
  }))
)

function persist() {
  const s = useUIStore.getState()
  lsSet<UIState>('miot:ui', {
    originalMapCollapsed: s.originalMapCollapsed,
    tuningAnalysisMode:   s.tuningAnalysisMode,
    datalogTab:           s.datalogTab,
    columnVisibility:     s.columnVisibility,
    chartLayout:          s.chartLayout,
    chartsHeight:         s.chartsHeight,
  })
}

function splitPanel(layout: ChartLayout, targetId: string, direction: 'horizontal' | 'vertical', newPanel: ChartPanel): ChartLayout | null {
  if (layout.type === 'panel') {
    if (layout.panelId !== targetId) return null
    const split: ChartSplit = { type: 'split', direction, children: [layout, newPanel], splitId: crypto.randomUUID(), ratio: 0.5 }
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

function updateRatio(layout: ChartLayout, splitId: string, ratio: number): ChartLayout | null {
  if (layout.type === 'panel') return null
  if (layout.splitId === splitId) return { ...layout, ratio }
  let changed = false
  const newChildren = layout.children.map(child => {
    if (changed) return child
    const r = updateRatio(child, splitId, ratio)
    if (r) { changed = true; return r }
    return child
  }) as [ChartLayout, ChartLayout]
  return changed ? { ...layout, children: newChildren } : null
}

function migrateSplitIds(layout: ChartLayout): ChartLayout {
  if (layout.type === 'panel') return layout
  return {
    ...layout,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    splitId: (layout as any).splitId ?? crypto.randomUUID(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ratio:   (layout as any).ratio   ?? 0.5,
    children: [migrateSplitIds(layout.children[0]), migrateSplitIds(layout.children[1])],
  }
}

export function flattenPanels(layout: ChartLayout): import('@/types/ui').ChartPanel[] {
  if (layout.type === 'panel') return [layout]
  return layout.children.flatMap(c => flattenPanels(c))
}
