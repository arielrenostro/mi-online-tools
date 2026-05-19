import { openDB, type IDBPDatabase } from 'idb'
import type { MapModel } from '@/types/map'
import type { DatalogModel } from '@/types/datalog'
import type { TuningOutput } from '@/types/tuning'

export interface MapDBEntry {
  originalModel: MapModel
  editableCells: number[][] | null
  csvBlob:       Blob
  savedAt:       number
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: IDBPDatabase<any> | null = null

export async function getDB() {
  if (_db) return _db
  _db = await openDB('mi-fuel-tuner-db', 1, {
    upgrade(db) {
      db.createObjectStore('map')
      const logs = db.createObjectStore('logs', { keyPath: 'hash' })
      logs.createIndex('by-filename', 'filename')
      db.createObjectStore('tuning-output')
    },
  })
  return _db
}
