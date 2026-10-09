import type { TimeSelection } from '@/types/datalog'
import type { LogEntry } from '@/types/datalog'

/**
 * Number of points a correction run would use: active-log points that pass the applied filter and,
 * when a time interval is selected, lie inside it (global ms on the concatenated timeline).
 * `mask` is the flat filter mask, in the order of `flattenActiveRows`.
 */
export function countQualifyingPoints(logs: LogEntry[], mask: boolean[], selection: TimeSelection | null): number {
  if (selection === null) {
    let n = 0
    for (let i = 0; i < mask.length; i++) if (mask[i]) n++
    return n
  }
  let n = 0
  let i = 0
  let offset = 0
  for (const log of logs) {
    if (!log.enabled) continue
    for (const row of log.model.rows) {
      const t = row.timestamp_ms + offset
      if (mask[i] && t >= selection.start_ms && t <= selection.end_ms) n++
      i++
    }
    offset += log.duration_ms
  }
  return n
}

export type GenerateBlockReason = 'no-map' | 'no-points' | null

export function generateBlockReason(hasMap: boolean, qualifying: number): GenerateBlockReason {
  if (!hasMap) return 'no-map'
  if (qualifying === 0) return 'no-points'
  return null
}

export const GENERATE_BLOCK_MESSAGES: Record<Exclude<GenerateBlockReason, null>, string> = {
  'no-map':    'Importe um mapa primeiro — ele define a grade de células da correção',
  'no-points': 'Nenhum ponto passa no filtro atual',
}
