import { describe, it, expect } from 'vitest'
import { upgradeDb, DB_VERSION, type UpgradableDB } from './db'

function recorder() {
  const created: { name: string; keyPath?: string }[] = []
  const db: UpgradableDB = {
    createObjectStore(name, options) {
      created.push({ name, keyPath: options?.keyPath })
      return { createIndex: () => undefined }
    },
  }
  return { db, created }
}

describe('upgradeDb', () => {
  it('is at version 4', () => {
    expect(DB_VERSION).toBe(4)
  })

  it('upgrading from v3 only adds the correction-runs store, keeping every older one untouched', () => {
    const { db, created } = recorder()
    upgradeDb(db, 3)
    expect(created).toEqual([{ name: 'correction-runs', keyPath: 'id' }])
  })

  it('a fresh install creates every store, including the legacy ones', () => {
    const { db, created } = recorder()
    upgradeDb(db, 0)
    expect(created.map(c => c.name)).toEqual([
      'map', 'logs', 'tuning-output', 'tuning-history', 'correction-snapshot', 'correction-runs',
    ])
  })

  it('upgrading from v2 adds the snapshot store and the runs store', () => {
    const { db, created } = recorder()
    upgradeDb(db, 2)
    expect(created.map(c => c.name)).toEqual(['correction-snapshot', 'correction-runs'])
  })
})
