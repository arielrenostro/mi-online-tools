import type { DatalogModel, DatalogRow } from '@/types/datalog'
import { computeHash } from '@/api/client'

const REQUIRED = ['Timestamp', 'RPM', 'MAP', 'Lambda 1', 'VE Value', 'CLT', 'Lambda Loop', 'Lambda Target', 'Lambda Corr']
const SIGNALS  = ['RPM', 'MAP', 'Lambda 1', 'Lambda Target', 'CLT', 'Lambda Corr', 'Lambda Loop']

export async function parseDatalogClient(file: File): Promise<DatalogModel> {
  const [text, hash] = await Promise.all([file.text(), computeHash(file)])
  return parseDatalogText(text, file.name, hash)
}

export function parseDatalogText(text: string, filename: string, hash: string): DatalogModel {
  const lines = text.split(/\r?\n/)
  let colMap: Record<string, number> = {}
  const rows: DatalogRow[] = []
  let firstTs: number | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const fields = trimmed.split(';')

    if (fields[0].trim() === 'Timestamp') {
      colMap = {}
      fields.forEach((f, i) => { colMap[f.trim()] = i })
      const missing = REQUIRED.filter(c => !(c in colMap))
      if (missing.length > 0) throw new Error(`Colunas ausentes: ${missing.join(', ')}`)
      continue
    }

    if (Object.keys(colMap).length === 0) continue
    if (fields.length < Object.keys(colMap).length) continue

    const g = (col: string) => fields[colMap[col]]?.trim() ?? ''

    const rawTs = parseInt(g('Timestamp'), 10)
    if (isNaN(rawTs)) continue

    const rpm      = parseFloat(g('RPM'))
    const mapKpa   = parseFloat(g('MAP'))
    const l1Raw    = parseFloat(g('Lambda 1'))
    const veRaw    = parseInt(g('VE Value'), 10)
    const cltRaw   = parseInt(g('CLT'), 10)
    const ll       = parseInt(g('Lambda Loop'), 10) as 0 | 1
    const ltRaw    = parseFloat(g('Lambda Target'))
    const lcRaw    = parseFloat(g('Lambda Corr'))

    if ([rpm, mapKpa, l1Raw, veRaw, cltRaw, ll, ltRaw, lcRaw].some(isNaN)) continue

    let pedal: number | null = null
    if ('ACC %' in colMap) {
      const accRaw = parseFloat(g('ACC %'))
      if (!isNaN(accRaw)) pedal = Math.min(100, (accRaw / 990) * 100)
    }

    if (firstTs === null) firstTs = rawTs

    rows.push({
      timestamp_ms:   rawTs - firstTs,
      rpm,
      mapKpa,
      lambda1:        l1Raw / 1000,
      lambdaCorrecao: lcRaw / 1000,
      lambdaTarget:   ltRaw / 1000,
      veValueRaw:     veRaw,
      clt:            cltRaw - 273,
      lambdaLoop:     ll,
      pedal,
    })
  }

  if (rows.length === 0) throw new Error('Nenhuma linha de dados válida no CSV.')

  const signals = [...SIGNALS]
  if (rows.some(r => r.pedal !== null)) signals.push('Pedal')

  return {
    hash,
    filename,
    rows,
    duration_ms: rows[rows.length - 1].timestamp_ms,
    signals,
  }
}
