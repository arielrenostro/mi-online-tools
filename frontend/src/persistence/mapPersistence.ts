import { getDB, type MapDBEntry } from './db'
import type { MapModel } from '@/types/map'

export async function saveMap(
  originalModel: MapModel,
  editableCells: number[][] | null,
  csvBlob: Blob,
): Promise<void> {
  const db = await getDB()
  await db.put('map', { originalModel, editableCells, csvBlob, savedAt: Date.now() }, 'current')
}

export async function updateEditableCells(cells: number[][]): Promise<void> {
  const db    = await getDB()
  const entry = (await db.get('map', 'current')) as MapDBEntry | undefined
  if (!entry) return
  await db.put('map', { ...entry, editableCells: cells }, 'current')
}

export async function loadMap(): Promise<MapDBEntry | undefined> {
  const db = await getDB()
  return db.get('map', 'current')
}

export async function clearMap(): Promise<void> {
  const db = await getDB()
  await db.delete('map', 'current')
}
