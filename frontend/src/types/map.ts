export interface MapModel {
  name:           string
  rpmBreakpoints: number[]
  mapBreakpoints: number[]
  cells:          number[][]
  rawLines:       string[]   // original CSV lines for export
}

export type MapType = 'fuel_ve' | 'ignition' | 'lambda' | 'boost'
