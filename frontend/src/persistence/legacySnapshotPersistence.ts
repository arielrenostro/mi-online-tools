import { getDB } from './db'
import type { CorrectionCell } from '@/types/correction'
import type { TimeSelection } from '@/types/datalog'

/**
 * Snapshot "last" gravado pela versão do app anterior aos runs. Só é lido para migrar para o
 * primeiro run e depois apagado; nunca mais é escrito.
 */
export interface LegacySnapshot {
  cells:       CorrectionCell[][]
  generatedAt: number
  provenance:  { logFilenames: string[]; timeRange: TimeSelection | null; filters: unknown }
}

export async function loadLegacySnapshot(): Promise<LegacySnapshot | undefined> {
  const db = await getDB()
  const entry = await db.get('correction-snapshot', 'last')
  return entry?.snapshot
}

export async function clearLegacySnapshot(): Promise<void> {
  const db = await getDB()
  await db.delete('correction-snapshot', 'last')
}
