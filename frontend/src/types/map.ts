export interface MapModel {
  name:           string
  rpmBreakpoints: number[]         // ascending
  mapBreakpoints: number[]         // descending — index 0 = highest MAP (kPa). See mapParser.ts.
  cells:          number[][]       // VE fuel cells (#F01–#F16); cells[0] = highest MAP row
  ignitionCells:  number[][]       // ignition cells (#I01–#I16); same row order as cells
  lambdaCells:    number[][]       // lambda target cells (#A01–#A16); same row order as cells
  rawLines:       string[]         // original CSV lines (file order, ascending) for export
}

export type MapType = 'fuel_ve' | 'ignition' | 'lambda' | 'boost'
