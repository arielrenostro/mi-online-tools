// `editableCells`/`editableIgnitionCells`/`editableLambdaCells` estão em ordem
// descendente por MAP (índice 0 = maior kPa — ver `mapParser.ts`), enquanto o
// arquivo (`#Fnn`/`#Inn`/`#Ann`) é sempre ascendente (`#F01` = menor kPa). O
// índice de arquivo (`idx = #Fnn - 1`) precisa ser espelhado antes de indexar
// os arrays internos.
function fileIdxToInternal(idx: number, length: number): number {
  return length - 1 - idx
}

export function exportMapCsv(
  rawLines:               string[],
  editableCells:          number[][],
  editableIgnitionCells?: number[][] | null,
  editableLambdaCells?:   number[][] | null,
): string {
  const out: string[] = []
  for (const line of rawLines) {
    const trimmed = line.trim()
    const code    = trimmed.split(';')[0]?.trim() ?? ''

    if (/^#F\d{2}$/.test(code)) {
      const idx = parseInt(code.slice(2), 10) - 1
      if (idx >= 0 && idx < editableCells.length) {
        const row = editableCells[fileIdxToInternal(idx, editableCells.length)]
        out.push(`${code};${row.join(';')}`)
        continue
      }
    } else if (/^#I(0[1-9]|1[0-6])$/.test(code) && editableIgnitionCells) {
      const idx = parseInt(code.slice(2), 10) - 1
      if (idx >= 0 && idx < editableIgnitionCells.length) {
        const row = editableIgnitionCells[fileIdxToInternal(idx, editableIgnitionCells.length)]
        out.push(`${code};${row.join(';')}`)
        continue
      }
    } else if (/^#A(0[1-9]|1[0-6])$/.test(code) && editableLambdaCells) {
      const idx = parseInt(code.slice(2), 10) - 1
      if (idx >= 0 && idx < editableLambdaCells.length) {
        const row = editableLambdaCells[fileIdxToInternal(idx, editableLambdaCells.length)]
        out.push(`${code};${row.join(';')}`)
        continue
      }
    }

    out.push(line)
  }
  return out.join('\n')
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
