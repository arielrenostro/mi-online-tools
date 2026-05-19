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
        out.push(`${code};${editableCells[idx].join(';')}`)
        continue
      }
    } else if (/^#I(0[1-9]|1[0-6])$/.test(code) && editableIgnitionCells) {
      const idx = parseInt(code.slice(2), 10) - 1
      if (idx >= 0 && idx < editableIgnitionCells.length) {
        out.push(`${code};${editableIgnitionCells[idx].join(';')}`)
        continue
      }
    } else if (/^#A(0[1-9]|1[0-6])$/.test(code) && editableLambdaCells) {
      const idx = parseInt(code.slice(2), 10) - 1
      if (idx >= 0 && idx < editableLambdaCells.length) {
        out.push(`${code};${editableLambdaCells[idx].join(';')}`)
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
