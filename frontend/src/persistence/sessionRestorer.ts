import { lsGet } from './localStorage'
import * as mapPersistence       from './mapPersistence'
import * as logPersistence       from './logPersistence'
import { upgradeLogEntry }       from './logMigration'
import * as correctionPersistence from './correctionPersistence'
import type { LogEntry } from '@/types/datalog'

export async function restoreSession(): Promise<void> {
  await Promise.allSettled([
    restoreMap(),
    restoreLogs(),
    restoreCorrection(),
    restoreUI(),
    restoreTime(),
    restoreConstants(),
    restoreDyno(),
  ])
  const { useSessionStore } = await import('@/store/sessionStore')
  useSessionStore.getState().setRestoringDone()
}

async function restoreMap(): Promise<void> {
  const { useMapStore } = await import('@/store/mapStore')
  let entry
  try { entry = await mapPersistence.loadMap() } catch { return }
  if (!entry) return
  useMapStore.getState().hydrate({
    originalModel:         entry.originalModel,
    editableCells:         entry.editableCells         ?? entry.originalModel.cells,
    editableIgnitionCells: entry.editableIgnitionCells ?? entry.originalModel.ignitionCells,
    editableLambdaCells:   entry.editableLambdaCells   ?? entry.originalModel.lambdaCells,
  })
}

async function restoreLogs(): Promise<void> {
  const { useLogStore } = await import('@/store/logStore')
  const logOrder = lsGet<{ orderedHashes: string[]; enabledHashes: string[] }>('miot:log-order')

  let entries
  try { entries = await logPersistence.loadAllLogs() } catch { return }
  if (!entries.length) return

  // Logs salvos por um leitor de CSV antigo ganham os sinais novos (ex.: Marcha) sem reimportar.
  entries = await Promise.all(entries.map(async e => {
    const upgraded = await upgradeLogEntry(e)
    if (upgraded !== e) logPersistence.saveLog(upgraded).catch(() => { /* non-fatal */ })
    return upgraded
  }))

  const ordered = sortByOrder(entries, logOrder?.orderedHashes ?? [])
  const enabledSet = new Set(logOrder?.enabledHashes ?? [])

  const logEntries: LogEntry[] = ordered.map(e => ({
    hash:        e.hash,
    filename:    e.filename,
    model:       e.model,
    enabled:     enabledSet.size === 0 ? true : enabledSet.has(e.hash),
    duration_ms: e.model.duration_ms,
  }))

  useLogStore.getState().hydrate(logEntries)
}

async function restoreCorrection(): Promise<void> {
  const { useCorrectionStore } = await import('@/store/correctionStore')
  const { DEFAULT_CORRECTION_FILTERS } = await import('@/types/correction')

  const filters           = lsGet<typeof DEFAULT_CORRECTION_FILTERS>('miot:correction-filters')
  const showFilteredPoints = lsGet<boolean>('miot:correction-show-filtered')

  if (filters)                    useCorrectionStore.getState().hydrateFilters(filters)
  if (showFilteredPoints !== null) useCorrectionStore.getState().hydrateShowFilteredPoints(showFilteredPoints)

  let entry
  try { entry = await correctionPersistence.loadSnapshot() } catch { return }
  if (entry) useCorrectionStore.getState().hydrateSnapshot(entry)
}

async function restoreUI(): Promise<void> {
  const { useUIStore } = await import('@/store/uiStore')
  const saved = lsGet<any>('miot:ui')
  if (saved) useUIStore.getState().hydrate(saved)
}

async function restoreConstants(): Promise<void> {
  const { useConstantsStore } = await import('@/store/constantsStore')
  const saved = lsGet<unknown>('miot:constants')
  if (saved) useConstantsStore.getState().hydrate(saved)
}

async function restoreDyno(): Promise<void> {
  const { useDynoStore } = await import('@/store/dynoStore')
  const saved = lsGet<unknown>('miot:dyno')
  if (saved) useDynoStore.getState().hydrate(saved)
}

async function restoreTime(): Promise<void> {
  const { useTimeStore } = await import('@/store/timeStore')
  const saved = lsGet<any>('miot:time')
  if (saved) useTimeStore.getState().hydrate({
    cursor_ms:       saved.cursor_ms ?? null,
    selection:       saved.selection ?? null,
    sparklineSensor: saved.sparklineSensor ?? 'RPM',
  })
}

function sortByOrder<T extends { hash: string }>(items: T[], order: string[]): T[] {
  const map = new Map(items.map(i => [i.hash, i]))
  const sorted = order.map(h => map.get(h)).filter((i): i is T => i !== undefined)
  const remaining = items.filter(i => !order.includes(i.hash))
  return [...sorted, ...remaining]
}
