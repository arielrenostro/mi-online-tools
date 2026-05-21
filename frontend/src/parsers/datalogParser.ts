import type { DatalogModel, DatalogRow } from '@/types/datalog'
import { computeHash } from '@/api/client'
import { SIGNAL_DEFS } from '@/signals/signalRegistry'

const REQUIRED_COLUMNS = SIGNAL_DEFS.map(s => s.column)
const ALL_SIGNALS      = SIGNAL_DEFS.map(s => s.name)

export async function parseDatalogClient(file: File): Promise<DatalogModel> {
  const [text, hash] = await Promise.all([file.text(), computeHash(file)])
  return parseDatalogText(text, file.name, hash)
}

export function parseDatalogText(text: string, filename: string, hash: string): DatalogModel {
  const lines = text.split(/\r?\n/)
  let colMap: Record<string, number> = {}
  let hasTimestampCol = false
  const rows: DatalogRow[] = []
  let firstTs: number | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const fields = trimmed.split(';')
    const isHeaderLine = fields.find(f => f == 'RPM') && fields.find(f => f == 'MAP') && fields.find(f => f == 'Lambda 1')
    console.log(fields, 'RPM' in fields)
    if (isHeaderLine) {
      colMap = {}
      fields.forEach((f, i) => { colMap[f.trim()] = i })
      const missing = REQUIRED_COLUMNS.filter(c => !(c in colMap))
      if (missing.length > 0) {
        throw new Error(`Colunas ausentes: ${missing.join(', ')}`)
      }
      continue
    }

    if (Object.keys(colMap).length === 0) continue
    if (fields.length < Object.keys(colMap).length) continue

    const g = (col: string) => fields[colMap[col]]?.trim() ?? ''

    let rawTs: number
    if (hasTimestampCol) {
      rawTs = parseInt(g('Timestamp'), 10)
      if (isNaN(rawTs)) continue
    } else {
      rawTs = rows.length * 100
    }

    const row: DatalogRow = { timestamp_ms: 0 }
    let valid = true

    for (const sig of SIGNAL_DEFS) {
      const converted = sig.convert(g(sig.column))
      if (isNaN(converted)) { valid = false; break }
      row[sig.name] = converted
    }

    if (!valid) continue

    if (firstTs === null) firstTs = hasTimestampCol ? rawTs : 0
    row.timestamp_ms = rawTs - firstTs
    rows.push(row)
  }

  if (rows.length === 0) throw new Error('Nenhuma linha de dados válida no CSV.')

  return {
    hash,
    filename,
    rows,
    duration_ms: rows[rows.length - 1].timestamp_ms,
    signals:     ALL_SIGNALS,
  }
}
