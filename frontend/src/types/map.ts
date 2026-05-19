export interface MapModel {
  name:           string
  rpmBreakpoints: number[]
  mapBreakpoints: number[]
  cells:          number[][]       // VE fuel cells (#F01–#F16)
  ignitionCells:  number[][]       // ignition cells (#I01–#I16)
  lambdaCells:    number[][]       // lambda target cells (#A01–#A16)
  rawLines:       string[]         // original CSV lines for export
}

export type MapType = 'fuel_ve' | 'ignition' | 'lambda' | 'boost'
