import { getDB } from './db'
import type { TuningOutput } from '@/types/tuning'

export async function saveTuningOutput(output: TuningOutput): Promise<void> {
  const db = await getDB()
  await db.put('tuning-output', { output, savedAt: Date.now() }, 'last')
}

export async function loadTuningOutput(): Promise<TuningOutput | undefined> {
  const db    = await getDB()
  const entry = await db.get('tuning-output', 'last')
  return entry?.output
}

export async function clearTuningOutput(): Promise<void> {
  const db = await getDB()
  await db.delete('tuning-output', 'last')
}
