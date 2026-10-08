import type { LogDBEntry } from './db'
import { parseDatalogText, PARSER_VERSION } from '@/parsers/datalogParser'

/**
 * Log salvo por uma versão mais antiga do leitor de CSV (sem sinais lidos hoje, ex.: Marcha) é
 * reconstruído do CSV guardado, sem reimportar. Já na versão atual, ou se o CSV não puder ser
 * lido/parseado, devolve a própria entrada (mesma referência) — a restauração nunca falha por isso.
 */
export async function upgradeLogEntry(entry: LogDBEntry): Promise<LogDBEntry> {
  if ((entry.model.parserVersion ?? 1) >= PARSER_VERSION) return entry
  try {
    const text  = await entry.csvBlob.text()
    const model = parseDatalogText(text, entry.filename, entry.hash)
    return { ...entry, model }
  } catch {
    return entry
  }
}
