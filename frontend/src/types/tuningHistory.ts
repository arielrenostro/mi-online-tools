import type { TuningConfig, TuningOutput } from './tuning'

export interface TuningHistoryEntry {
  id:            string
  mapName:       string
  timestamp:     number
  logHashes:     string[]
  logFilenames:  string[]
  config:        TuningConfig
  output:        TuningOutput
}
