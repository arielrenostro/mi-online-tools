import { lsGet, lsSet, lsClear } from './localStorage'
import * as mapPersistence       from './mapPersistence'
import * as logPersistence       from './logPersistence'
import { upgradeLogEntry }       from './logMigration'
import * as runPersistence from './runPersistence'
import * as legacySnapshot from './legacySnapshotPersistence'
import { legacySnapshotToRun } from './legacyMigration'
import { isLegacyCorrectionFilters, migrateLegacyCorrectionFilters } from '@/utils/filterMigration'
import type { CorrectionRun } from '@/types/correction'
import type { LogEntry } from '@/types/datalog'

export async function restoreSession(): Promise<void> {
  await Promise.allSettled([
    // O snapshot antigo só vira run com os breakpoints do mapa restaurado — por isso depois dele.
    restoreMap().then(() => restoreCorrection()),
    restoreLogs(),
    restoreUI(),
    restoreTime(),
    restoreConstants(),
    restoreCorrectionSettings(),
    restoreDyno(),
    restoreXY(),
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

export const FILTER_KEY        = 'miot:correction-filter'
export const LEGACY_FILTER_KEY = 'miot:correction-filters'
const SHOW_FILTERED_KEY        = 'miot:correction-show-filtered'
const SELECTED_RUN_KEY         = 'miot:correction-selected-run'

export async function restoreCorrection(): Promise<void> {
  await restoreFilter()
  await restoreRuns()
}

/** Filtro único; o filtro de correção salvo pelo formato antigo é convertido uma vez e a chave antiga some. */
async function restoreFilter(): Promise<void> {
  const { useFilterStore } = await import('@/store/filterStore')
  let filter: unknown = lsGet<unknown>(FILTER_KEY)
  if (filter === null) {
    const legacy = lsGet<unknown>(LEGACY_FILTER_KEY)
    if (isLegacyCorrectionFilters(legacy)) {
      filter = migrateLegacyCorrectionFilters(legacy)
      lsSet(FILTER_KEY, filter)
    }
  }
  lsClear(LEGACY_FILTER_KEY)
  useFilterStore.getState().hydrate({ filter, showFilteredPoints: lsGet<boolean>(SHOW_FILTERED_KEY) })
}

async function restoreRuns(): Promise<void> {
  const { useCorrectionStore } = await import('@/store/correctionStore')
  const { useMapStore } = await import('@/store/mapStore')

  let runs: CorrectionRun[] = []
  try { runs = await runPersistence.loadAllRuns() } catch { /* sem runs salvos legíveis */ }
  let selectedRunId = lsGet<string>(SELECTED_RUN_KEY)

  // Primeira abertura depois da atualização: o snapshot único vira o "Run 1". Só é apagado depois
  // de o run estar gravado; sem mapa restaurado não há como conhecer seus breakpoints e ele é descartado.
  let legacy
  try { legacy = await legacySnapshot.loadLegacySnapshot() } catch { legacy = undefined }
  if (legacy) {
    const map = useMapStore.getState().originalMap
    if (runs.length === 0 && map) {
      const run = legacySnapshotToRun(legacy, map)
      try {
        await runPersistence.saveRun(run)
        runs = [run]
        selectedRunId = run.id
        lsSet(SELECTED_RUN_KEY, run.id)
        await legacySnapshot.clearLegacySnapshot()
      } catch { /* mantém o snapshot antigo para tentar de novo na próxima abertura */ }
    } else {
      try { await legacySnapshot.clearLegacySnapshot() } catch { /* non-fatal */ }
    }
  }

  if (runs.length) useCorrectionStore.getState().hydrate({ runs, selectedRunId })
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

async function restoreCorrectionSettings(): Promise<void> {
  const { useCorrectionSettingsStore } = await import('@/store/correctionSettingsStore')
  const saved = lsGet<unknown>('miot:correction-settings')
  if (saved) useCorrectionSettingsStore.getState().hydrate(saved)
}

async function restoreDyno(): Promise<void> {
  const { useDynoStore } = await import('@/store/dynoStore')
  const saved = lsGet<unknown>('miot:dyno')
  if (saved) useDynoStore.getState().hydrate(saved)
}

async function restoreXY(): Promise<void> {
  const { useXYStore } = await import('@/store/xyStore')
  const saved = lsGet<unknown>('miot:xy')
  if (saved) useXYStore.getState().hydrate(saved)
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
