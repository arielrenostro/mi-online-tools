import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { LogEntry, DatalogModel, DatalogRow } from '@/types/datalog'
import { parseDatalogClient }    from '@/parsers/datalogParser'
import { computeHash }           from '@/api/client'
import * as logPersistence       from '@/persistence/logPersistence'
import { lsSet }                 from '@/persistence/localStorage'
import { useTimeStore }          from './timeStore'

interface LogState {
  logs:        LogEntry[]
  isUploading: boolean
  lastError:   string | null
}
interface LogActions {
  addLog(file: File): Promise<void>
  removeLog(hash: string): Promise<void>
  toggleLog(hash: string): void
  reorder(orderedHashes: string[]): void
  hydrate(entries: LogEntry[]): void
}

export const selectActiveLogs    = (s: LogState) => s.logs.filter(l => l.enabled)

/** Concatenates active logs' rows in order, offsetting timestamps so the whole session is one continuous timeline. */
export function flattenActiveRows(logs: LogEntry[]): DatalogRow[] {
  const active = logs.filter(l => l.enabled)
  let offset = 0
  const result: DatalogRow[] = []
  for (const log of active) {
    for (const row of log.model.rows) {
      result.push({ ...row, timestamp_ms: row.timestamp_ms + offset })
    }
    offset += log.duration_ms
  }
  return result
}

/** Linhas dos logs ativos SEM os sinais de runtime — para exibição use `useDisplayRows()`. */
export const selectAllRows = (s: LogState): DatalogRow[] => flattenActiveRows(s.logs)
export const selectTotalDuration = (s: LogState) => s.logs.filter(l => l.enabled).reduce((a, l) => a + l.duration_ms, 0)
/** Sinais presentes em todos os logs ativos (sem os de runtime). */
export function commonSignals(logs: LogEntry[]): string[] {
  const active = logs.filter(l => l.enabled)
  if (!active.length) return []
  if (active.length === 1) return active[0].model.signals
  const first = new Set(active[0].model.signals)
  for (let i = 1; i < active.length; i++) {
    const cur = new Set(active[i].model.signals)
    for (const sig of first) { if (!cur.has(sig)) first.delete(sig) }
  }
  return Array.from(first)
}
export const selectAllSignals    = (s: LogState): string[] => commonSignals(s.logs)

export const useLogStore = create<LogState & LogActions>()(
  subscribeWithSelector((set, get) => ({
    logs: [], isUploading: false, lastError: null,

    async addLog(file) {
      const hash = await computeHash(file)
      if (get().logs.some(l => l.hash === hash)) {
        set({ lastError: `Log já carregado: ${file.name}` })
        return
      }
      set({ isUploading: true, lastError: null })
      try {
        const model: DatalogModel = await parseDatalogClient(file)
        const entry: LogEntry = {
          hash, filename: file.name, model, enabled: true, duration_ms: model.duration_ms,
        }
        const newLogs = [...get().logs, entry]
        set({ logs: newLogs, isUploading: false })
        await logPersistence.saveLog({ hash, filename: file.name, model, csvBlob: file, savedAt: Date.now() })
        persistOrder(newLogs)
        useTimeStore.getState().clearSelection()
      } catch (err) {
        set({ isUploading: false, lastError: err instanceof Error ? err.message : 'Erro ao carregar log.' })
      }
    },

    async removeLog(hash) {
      const { logs } = get()
      const entry = logs.find(l => l.hash === hash)
      if (!entry) return
      const newLogs = logs.filter(l => l.hash !== hash)
      set({ logs: newLogs })
      try { await logPersistence.deleteLog(hash) } catch { /* non-fatal */ }
      persistOrder(newLogs)
      if (entry.enabled) {
        const { useCorrectionStore } = await import('./correctionStore')
        useCorrectionStore.getState().markStale()
        const newTotal = newLogs.filter(l => l.enabled).reduce((a, l) => a + l.duration_ms, 0)
        useTimeStore.getState().onTotalDurationChanged(newTotal)
      }
    },

    toggleLog(hash) {
      const { logs } = get()
      const entry = logs.find(l => l.hash === hash)
      if (!entry) return
      const newLogs = logs.map(l => l.hash === hash ? { ...l, enabled: !l.enabled } : l)
      set({ logs: newLogs })
      persistOrder(newLogs)
      const nowActive = newLogs.filter(l => l.enabled)
      if (entry.enabled && nowActive.length === 0) useTimeStore.getState().clearSelection()
      import('./correctionStore').then(m => m.useCorrectionStore.getState().markStale())
      const newTotal = nowActive.reduce((a, l) => a + l.duration_ms, 0)
      useTimeStore.getState().onTotalDurationChanged(newTotal)
    },

    reorder(orderedHashes) {
      const { logs } = get()
      const mapped = new Map(logs.map(l => [l.hash, l]))
      const reordered = orderedHashes
        .map(h => mapped.get(h))
        .filter((l): l is LogEntry => l !== undefined)
      const inOrdered = new Set(orderedHashes)
      const remaining = logs.filter(l => !inOrdered.has(l.hash))
      const newLogs = [...reordered, ...remaining]
      set({ logs: newLogs })
      persistOrder(newLogs)
    },

    hydrate(entries) {
      set({ logs: entries, isUploading: false, lastError: null })
    },
  }))
)

function persistOrder(logs: LogEntry[]) {
  lsSet('miot:log-order', {
    orderedHashes: logs.map(l => l.hash),
    enabledHashes: logs.filter(l => l.enabled).map(l => l.hash),
  })
}
