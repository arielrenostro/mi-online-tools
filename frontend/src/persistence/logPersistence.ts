import { getDB, type LogDBEntry } from './db'
import type { DatalogModel } from '@/types/datalog'

export async function saveLog(entry: LogDBEntry): Promise<void> {
  const db = await getDB()
  await db.put('logs', entry)
}

export async function getLog(hash: string): Promise<LogDBEntry | undefined> {
  const db = await getDB()
  return db.get('logs', hash)
}

export async function loadAllLogs(): Promise<LogDBEntry[]> {
  const db = await getDB()
  return db.getAll('logs')
}

export async function deleteLog(hash: string): Promise<void> {
  const db = await getDB()
  await db.delete('logs', hash)
}
