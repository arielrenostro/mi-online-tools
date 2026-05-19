import { getDB } from './db'
import type { TuningHistoryEntry } from '@/types/tuningHistory'

const STORE = 'tuning-history'

export async function saveHistoryEntry(entry: TuningHistoryEntry): Promise<void> {
  const db = await getDB()
  await db.put(STORE, entry)
}

export async function loadHistoryForMap(mapName: string): Promise<TuningHistoryEntry[]> {
  const db = await getDB()
  const entries: TuningHistoryEntry[] = await db.getAllFromIndex(STORE, 'by-mapName', mapName)
  return entries.sort((a, b) => b.timestamp - a.timestamp)
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE, id)
}

export async function clearHistory(): Promise<void> {
  const db = await getDB()
  await db.clear(STORE)
}
