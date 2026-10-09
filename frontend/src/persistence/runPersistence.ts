import { getDB } from './db'
import type { CorrectionRun } from '@/types/correction'

const STORE = 'correction-runs'

export async function saveRun(run: CorrectionRun): Promise<void> {
  const db = await getDB()
  await db.put(STORE, run)
}

export async function deleteRun(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE, id)
}

/** Todos os runs gravados, do mais novo ao mais antigo. */
export async function loadAllRuns(): Promise<CorrectionRun[]> {
  const db = await getDB()
  const runs = (await db.getAll(STORE)) as CorrectionRun[]
  return runs.sort((a, b) => b.createdAt - a.createdAt)
}
