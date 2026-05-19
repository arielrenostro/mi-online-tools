import { lsGet } from './localStorage'
import * as mapPersistence    from './mapPersistence'
import * as logPersistence    from './logPersistence'
import * as tuningPersistence from './tuningPersistence'
import type { LogEntry } from '@/types/datalog'
import type { TuningConfig } from '@/types/tuning'

export async function restoreSession(): Promise<void> {
  await Promise.allSettled([
    restoreMap(),
    restoreLogs(),
    restoreTuning(),
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

async function restoreTuning(): Promise<void> {
  const { useTuningStore } = await import('@/store/tuningStore')

  const config    = lsGet<TuningConfig>('miot:config')
  const engineId  = lsGet<string>('mft:engine-id')

  if (config)   useTuningStore.getState().hydrateConfig(config)
  if (engineId) useTuningStore.getState().hydrateEngineId(engineId)

  let output
  try { output = await tuningPersistence.loadTuningOutput() } catch { return }
  if (output) useTuningStore.getState().hydrateOutput(output)
}

function sortByOrder<T extends { hash: string }>(items: T[], order: string[]): T[] {
  const map = new Map(items.map(i => [i.hash, i]))
  const sorted = order.map(h => map.get(h)).filter((i): i is T => i !== undefined)
  const remaining = items.filter(i => !order.includes(i.hash))
  return [...sorted, ...remaining]
}
