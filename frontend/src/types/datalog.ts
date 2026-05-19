export interface DatalogRow {
  timestamp_ms:   number
  rpm:            number
  mapKpa:         number
  lambda1:        number
  lambdaCorrecao: number
  lambdaTarget:   number
  veValueRaw:     number
  clt:            number
  lambdaLoop:     0 | 1
  pedal:          number | null
}

export interface DatalogModel {
  hash:        string
  filename:    string
  rows:        DatalogRow[]
  duration_ms: number
  signals:     string[]
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
