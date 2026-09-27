import { openDB, type IDBPDatabase } from 'idb'
import type { MapModel } from '@/types/map'
import type { DatalogModel } from '@/types/datalog'
import type { CorrectionSnapshot } from '@/types/correction'

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

export interface CorrectionSnapshotDBEntry {
  snapshot: CorrectionSnapshot
  savedAt:  number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: IDBPDatabase<any> | null = null

export async function getDB() {
  if (_db) return _db
  _db = await openDB('miot-db', 3, {
    upgrade(db, oldVersion) {
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
        db.createObjectStore('correction-snapshot')
      }
    },
  })
  return _db
}
