import type { MapModel } from '@/types/map'

export interface MapInfo {
  name:        string
  rpmCount:    number
  mapCount:    number
  rpmMin:      number
  rpmMax:      number
  mapMin:      number
  mapMax:      number
  /** Células que diferem do valor original importado, por tabela. */
  editedVe:       number
  editedIgnition: number
  editedLambda:   number
}

/** Quantas células de `editable` diferem de `original` (tabelas de mesmo formato). */
export function countEditedCells(editable: number[][], original: number[][]): number {
  let n = 0
  for (let r = 0; r < original.length; r++) {
    for (let c = 0; c < original[r].length; c++) {
      if (editable[r]?.[c] !== original[r][c]) n++
    }
  }
  return n
}

/** Resumo exibido na aba Arquivo; faixas via min/max, sem depender da ordem dos breakpoints. */
export function summarizeMap(
  originalMap: MapModel,
  editableMap: number[][] | null,
  editableIgnitionMap: number[][] | null,
  editableLambdaMap: number[][] | null,
): MapInfo {
  const { rpmBreakpoints: rpm, mapBreakpoints: map } = originalMap
  return {
    name:     originalMap.name,
    rpmCount: rpm.length,
    mapCount: map.length,
    rpmMin:   Math.min(...rpm),
    rpmMax:   Math.max(...rpm),
    mapMin:   Math.min(...map),
    mapMax:   Math.max(...map),
    editedVe:       editableMap         ? countEditedCells(editableMap, originalMap.cells)                : 0,
    editedIgnition: editableIgnitionMap ? countEditedCells(editableIgnitionMap, originalMap.ignitionCells) : 0,
    editedLambda:   editableLambdaMap   ? countEditedCells(editableLambdaMap, originalMap.lambdaCells)     : 0,
  }
}
