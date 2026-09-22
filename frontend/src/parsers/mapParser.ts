import type { MapModel } from '@/types/map'

export async function parseMapClient(file: File): Promise<MapModel> {
  const text = await file.text()
  return parseMapText(text, file.name)
}

export function parseMapText(text: string, name: string): MapModel {
  const lines          = text.split(/\r?\n/)
  const rawLines:      string[]           = []
  let rpmBreakpoints:  number[]           = []
  let mapBreakpoints:  number[]           = []
  const fuelRows:      Map<number, number[]> = new Map()
  const ignitionRows:  Map<number, number[]> = new Map()
  const lambdaRows:    Map<number, number[]> = new Map()

  for (const line of lines) {
    rawLines.push(line)
    const trimmed = line.trim()
    if (!trimmed) continue

    const parts = trimmed.split(';')
    const code  = parts[0].trim()

    if (code === '#I20') {
      rpmBreakpoints = parts.slice(1).filter(Boolean).map(Number)
    } else if (code === '#I21') {
      mapBreakpoints = parts.slice(1).filter(Boolean).map(Number)
    } else if (/^#F\d{2}$/.test(code)) {
      const idx = parseInt(code.slice(2), 10) - 1
      fuelRows.set(idx, parts.slice(1).filter(Boolean).map(Number))
    } else if (/^#I(0[1-9]|1[0-6])$/.test(code)) {
      const idx = parseInt(code.slice(2), 10) - 1
      ignitionRows.set(idx, parts.slice(1).filter(Boolean).map(Number))
    } else if (/^#A(0[1-9]|1[0-6])$/.test(code)) {
      const idx = parseInt(code.slice(2), 10) - 1
      lambdaRows.set(idx, parts.slice(1).filter(Boolean).map(Number))
    }
  }

  if (rpmBreakpoints.length === 0) throw new Error('Breakpoints de RPM (#I20) não encontrados.')
  if (mapBreakpoints.length === 0) throw new Error('Breakpoints de MAP (#I21) não encontrados.')

  const cellsAsc:         number[][] = []
  const ignitionCellsAsc: number[][] = []
  const lambdaCellsAsc:   number[][] = []

  for (let i = 0; i < mapBreakpoints.length; i++) {
    const fuel = fuelRows.get(i)
    if (!fuel) throw new Error(`Linha de células #F${String(i + 1).padStart(2, '0')} não encontrada.`)
    cellsAsc.push(fuel)

    const ign = ignitionRows.get(i)
    if (!ign) throw new Error(`Linha de ignição #I${String(i + 1).padStart(2, '0')} não encontrada.`)
    ignitionCellsAsc.push(ign)

    const lam = lambdaRows.get(i)
    if (!lam) throw new Error(`Linha de lambda #A${String(i + 1).padStart(2, '0')} não encontrada.`)
    lambdaCellsAsc.push(lam)
  }

  // O arquivo (#I21/#Fnn/#Inn/#Ann) vem sempre ascendente por MAP (índice 0 =
  // menor kPa) — é o formato exigido pelo CSV do MasterInjection e pelo backend.
  // A representação interna do frontend é descendente (índice 0 = maior kPa),
  // batendo 1:1 com a exibição da tabela (maior MAP no topo). A inversão
  // acontece uma única vez, aqui — o resto do frontend passa a operar de forma
  // literal sobre esses arrays. `mapExporter.ts` desfaz a inversão ao escrever
  // de volta no CSV; `tuningStore.ts` desfaz ao falar com o backend.
  const mapBreakpointsDesc  = [...mapBreakpoints].reverse()
  const cells               = [...cellsAsc].reverse()
  const ignitionCells       = [...ignitionCellsAsc].reverse()
  const lambdaCells         = [...lambdaCellsAsc].reverse()

  return {
    name,
    rpmBreakpoints,
    mapBreakpoints: mapBreakpointsDesc,
    cells,
    ignitionCells,
    lambdaCells,
    rawLines,
  }
}
