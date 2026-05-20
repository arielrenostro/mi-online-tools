export interface ScatterPoint {
  rpm:     number
  map_kpa: number
  density: number
}

export type TuningAnalysisMode = 've_lambda' | 'coverage' | 'confidence'
export type DatalogTab = 'logs' | 'dashboard' | 'charts' | 'data'

export interface ChartPanel {
  type:    'panel'
  panelId: string
  signals: string[]
}

export interface ChartSplit {
  type:      'split'
  direction: 'horizontal' | 'vertical'
  children:  [ChartLayout, ChartLayout]
  splitId:   string
  ratio:     number
}

export type ChartLayout = ChartPanel | ChartSplit

export interface UIState {
  originalMapCollapsed: boolean
  tuningAnalysisMode:   TuningAnalysisMode
  datalogTab:           DatalogTab
  columnVisibility:     Record<string, boolean>
  chartLayout:          ChartLayout
  chartsHeight:         number
}
