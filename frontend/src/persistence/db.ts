import { openDB, type IDBPDatabase } from 'idb'
import type { MapModel } from '@/types/map'
import type { DatalogModel } from '@/types/datalog'

export interface MapDBEntry {
  originalModel:         MapModel
  editableCells:         number[][] | null
  editableIgnitionCells: number[][] | null
  editableLambdaCells:   number[][] | null
  csvBlob:               Blob
  savedAt:               number
}

export interface LogDBEntry {
  hash:     string
  filename: string
  model:    DatalogModel
  csvBlob:  Blob
  savedAt:  number
}

export const DB_NAME    = 'miot-db'
export const DB_VERSION = 4

/** O mínimo do `IDBPDatabase` que o upgrade usa — permite testar sem um IndexedDB. */
export interface UpgradableDB {
  createObjectStore(name: string, options?: { keyPath?: string }): { createIndex(name: string, keyPath: string): unknown }
}

export function upgradeDb(db: UpgradableDB, oldVersion: number): void {
  if (oldVersion < 1) {
    db.createObjectStore('map')
    const logs = db.createObjectStore('logs', { keyPath: 'hash' })
    logs.createIndex('by-filename', 'filename')
    // 'tuning-output' store from v1 is orphaned as of v3 (auto-tuning
    // removed) — left in place rather than migrated away; harmless.
    db.createObjectStore('tuning-output')
  }
  if (oldVersion < 2) {
    // 'tuning-history' store from v2 is orphaned as of v3 (auto-tuning
    // removed) — left in place rather than migrated away; harmless.
    const history = db.createObjectStore('tuning-history', { keyPath: 'id' })
    history.createIndex('by-mapName', 'mapName')
  }
  if (oldVersion < 3) {
    // Holds the single "last" snapshot. As of v4 it is only read once, to migrate it into a
    // correction run, and then emptied; the store itself stays (like the orphans above).
    db.createObjectStore('correction-snapshot')
  }
  if (oldVersion < 4) {
    db.createObjectStore('correction-runs', { keyPath: 'id' })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: IDBPDatabase<any> | null = null

export async function getDB() {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) { upgradeDb(db, oldVersion) },
  })
  return _db
}
