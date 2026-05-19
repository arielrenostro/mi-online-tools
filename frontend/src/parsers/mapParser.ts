import type { MapModel } from '@/types/map'

export async function parseMapClient(file: File): Promise<MapModel> {
  const text = await file.text()
  return parseMapText(text, file.name)
}

export function parseMapText(text: string, name: string): MapModel {
  const lines        = text.split(/\r?\n/)
  const rawLines:    string[] = []
  let rpmBreakpoints: number[] = []
  let mapBreakpoints: number[] = []
  const cellRows:    Map<number, number[]> = new Map()

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
      const idx = parseInt(code.slice(2), 10) - 1   // 0-based
      cellRows.set(idx, parts.slice(1).filter(Boolean).map(Number))
    }
  }

  if (rpmBreakpoints.length === 0) throw new Error('Breakpoints de RPM (#I20) não encontrados.')
  if (mapBreakpoints.length === 0) throw new Error('Breakpoints de MAP (#I21) não encontrados.')

  const cells: number[][] = []
  for (let i = 0; i < mapBreakpoints.length; i++) {
    const row = cellRows.get(i)
    if (!row) throw new Error(`Linha de células #F${String(i + 1).padStart(2, '0')} não encontrada.`)
    cells.push(row)
  }

  return { name, rpmBreakpoints, mapBreakpoints, cells, rawLines }
}
