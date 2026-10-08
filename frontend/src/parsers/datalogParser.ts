import type { DatalogModel, DatalogRow } from '@/types/datalog'
import { computeHash } from '@/api/client'
import { SIGNAL_DEFS } from '@/signals/signalRegistry'

const RAW_SIGNALS      = SIGNAL_DEFS.filter(s => s.column !== undefined)
const DERIVED_SIGNALS  = SIGNAL_DEFS.filter(s => s.compute !== undefined)
const REQUIRED_COLUMNS = RAW_SIGNALS.filter(s => !s.optional).map(s => s.column!)

/** Incrementar quando o parser passar a ler/gerar sinais novos: logs salvos com versão menor são reparseados ao restaurar. */
export const PARSER_VERSION = 3

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
    if (isHeaderLine) {
      colMap = {}
      // Nomes repetidos (as duas colunas "0"): o último índice vence — é onde está a Marcha.
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

    for (const sig of RAW_SIGNALS) {
      if (sig.optional && !(sig.column! in colMap)) continue
      const converted = sig.convert!(g(sig.column!))
      if (isNaN(converted)) {
        if (sig.optional) continue // linha mantida, só sem esse sinal
        valid = false; break
      }
      row[sig.name] = converted
    }

    if (!valid) continue

    for (const sig of DERIVED_SIGNALS) {
      if (sig.inputs && !sig.inputs.every(n => Number.isFinite(row[n]))) continue // linha mantida, só sem esse derivado
      row[sig.name] = sig.compute!(row)
    }

    if (firstTs === null) firstTs = hasTimestampCol ? rawTs : 0
    row.timestamp_ms = rawTs - firstTs
    rows.push(row)
  }

  if (rows.length === 0) throw new Error('Nenhuma linha de dados válida no CSV.')

  // Brutos: colunas obrigatórias ou presentes no CSV. Derivados com `inputs`: só se todos estiverem listados.
  const listed = new Set<string>()
  const signals: string[] = []
  for (const s of SIGNAL_DEFS) {
    const available = s.column !== undefined
      ? !s.optional || s.column in colMap
      : !s.inputs || s.inputs.every(n => listed.has(n))
    if (!available) continue
    listed.add(s.name)
    signals.push(s.name)
  }

  return {
    hash,
    filename,
    rows,
    duration_ms: rows[rows.length - 1].timestamp_ms,
    signals,
    parserVersion: PARSER_VERSION,
  }
}
