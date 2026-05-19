import { openDB, type IDBPDatabase } from 'idb'
import type { MapModel } from '@/types/map'
import type { DatalogModel } from '@/types/datalog'
import type { TuningOutput } from '@/types/tuning'
import type { TuningHistoryEntry } from '@/types/tuningHistory'

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

export interface TuningOutputDBEntry {
  output:  TuningOutput
  savedAt: number
}

export type { TuningHistoryEntry }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: IDBPDatabase<any> | null = null

export async function getDB() {
  if (_db) return _db
  _db = await openDB('miot-db', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('map')
        const logs = db.createObjectStore('logs', { keyPath: 'hash' })
        logs.createIndex('by-filename', 'filename')
        db.createObjectStore('tuning-output')
      }
      if (oldVersion < 2) {
        const history = db.createObjectStore('tuning-history', { keyPath: 'id' })
        history.createIndex('by-mapName', 'mapName')
      }
    },
  })
  return _db
}
