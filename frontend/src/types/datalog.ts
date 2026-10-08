export interface DatalogRow {
  timestamp_ms: number
  [signalName: string]: number
}

export interface DatalogModel {
  hash:        string
  filename:    string
  rows:        DatalogRow[]
  duration_ms: number
  signals:     string[]
  /** Versão do leitor de CSV que gerou este model; ausente = 1 (antes da Marcha). */
  parserVersion?: number
}

export interface LogEntry {
  hash:        string
  filename:    string
  model:       DatalogModel
  enabled:     boolean
  duration_ms: number
}

export interface TimeSelection {
  start_ms: number
  end_ms:   number
}
