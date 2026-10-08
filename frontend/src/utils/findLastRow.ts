import type { DatalogRow } from '@/types/datalog'

/** Última linha com `timestamp_ms <= t` (busca binária; `rows` ordenadas por tempo), ou `null`. */
export function findLastRow(rows: DatalogRow[], t: number): DatalogRow | null {
  if (!rows.length || rows[0].timestamp_ms > t) return null
  let lo = 0, hi = rows.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (rows[mid].timestamp_ms <= t) lo = mid
    else hi = mid - 1
  }
  return rows[lo]
}
