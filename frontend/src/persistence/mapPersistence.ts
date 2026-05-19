import { getDB, type MapDBEntry } from './db'
import type { MapModel } from '@/types/map'

export async function saveMap(
  originalModel: MapModel,
  editableCells: number[][] | null,
  csvBlob: Blob,
): Promise<void> {
  const db = await getDB()
  const entry: MapDBEntry = {
    originalModel,
    editableCells,
    editableIgnitionCells: originalModel.ignitionCells ? [...originalModel.ignitionCells.map(r => [...r])] : null,
    editableLambdaCells:   originalModel.lambdaCells   ? [...originalModel.lambdaCells.map(r => [...r])]   : null,
    csvBlob,
    savedAt: Date.now(),
  }
  await db.put('map', entry, 'current')
}

export async function updateEditableCells(cells: number[][]): Promise<void> {
  const db    = await getDB()
  const entry = (await db.get('map', 'current')) as MapDBEntry | undefined
  if (!entry) return
  await db.put('map', { ...entry, editableCells: cells }, 'current')
}

export async function updateIgnitionCells(cells: number[][]): Promise<void> {
  const db    = await getDB()
  const entry = (await db.get('map', 'current')) as MapDBEntry | undefined
  if (!entry) return
  await db.put('map', { ...entry, editableIgnitionCells: cells }, 'current')
}

export async function updateLambdaCells(cells: number[][]): Promise<void> {
  const db    = await getDB()
  const entry = (await db.get('map', 'current')) as MapDBEntry | undefined
  if (!entry) return
  await db.put('map', { ...entry, editableLambdaCells: cells }, 'current')
}

export async function loadMap(): Promise<MapDBEntry | undefined> {
  const db = await getDB()
  return db.get('map', 'current')
}

export async function clearMap(): Promise<void> {
  const db = await getDB()
  await db.delete('map', 'current')
}
