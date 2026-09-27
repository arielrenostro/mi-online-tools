import { getDB } from './db'
import type { CorrectionSnapshot } from '@/types/correction'

export async function saveSnapshot(snapshot: CorrectionSnapshot): Promise<void> {
  const db = await getDB()
  await db.put('correction-snapshot', { snapshot, savedAt: Date.now() }, 'last')
}

export async function loadSnapshot(): Promise<{ snapshot: CorrectionSnapshot } | undefined> {
  const db = await getDB()
  return db.get('correction-snapshot', 'last')
}

export async function clearSnapshot(): Promise<void> {
  const db = await getDB()
  await db.delete('correction-snapshot', 'last')
}
