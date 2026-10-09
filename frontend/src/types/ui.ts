export interface ScatterPoint {
  rpm:     number
  map_kpa: number
  density: number
}

export type MapaAnalysisMode = 've_lambda' | 'coverage' | 'confidence'
export type MapaTab = 'arquivo' | 've' | 'ignition' | 'lambda'
export type DatalogTab = 'logs' | 'dashboard' | 'charts' | 'data' | 'dyno' | 'xy'

export interface ChartPanel {
  type:    'panel'
  panelId: string
  signals: string[]
  /** Altura em px. A altura de uma linha de painéis lado a lado é a maior das alturas. */
  height:  number
}

interface ChartSplitBase {
  type:     'split'
  children: [ChartLayout, ChartLayout]
  splitId:  string
}

/** Pilha vertical: a altura é a soma dos filhos, sem proporção. */
export interface ChartVerticalSplit extends ChartSplitBase {
  direction: 'vertical'
}

/** Lado a lado: `ratio` é a fração da largura ocupada por `children[0]`. */
export interface ChartHorizontalSplit extends ChartSplitBase {
  direction: 'horizontal'
  ratio:     number
}

export type ChartSplit = ChartVerticalSplit | ChartHorizontalSplit

export type ChartLayout = ChartPanel | ChartSplit

export interface UIState {
  originalMapCollapsed: boolean
  mapaAnalysisMode:     MapaAnalysisMode
  datalogTab:           DatalogTab
  /** Última aba aberta em Mapa (a TopBar reabre nela). */
  mapaTab:              MapaTab
  columnVisibility:     Record<string, boolean>
  chartLayout:          ChartLayout
  chartSidebarOpen:     boolean
}
