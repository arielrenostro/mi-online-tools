import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { LogEntry, DatalogModel } from '@/types/datalog'
import { parseDatalogClient }    from '@/parsers/datalogParser'
import { uploadDatalog }         from '@/api/datalog'
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
  ensureLogsOnBackend(hashes: string[]): Promise<void>
  hydrate(entries: LogEntry[]): void
}

export const selectActiveLogs    = (s: LogState) => s.logs.filter(l => l.enabled)
export const selectTotalDuration = (s: LogState) => s.logs.filter(l => l.enabled).reduce((a, l) => a + l.duration_ms, 0)
export const selectAllSignals    = (s: LogState): string[] => {
  const active = s.logs.filter(l => l.enabled)
  if (!active.length) return []
  if (active.length === 1) return active[0].model.signals
  const first = new Set(active[0].model.signals)
  for (let i = 1; i < active.length; i++) {
    const cur = new Set(active[i].model.signals)
    for (const sig of first) { if (!cur.has(sig)) first.delete(sig) }
  }
  return Array.from(first)
}

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
        const { useTuningStore } = await import('./tuningStore')
        useTuningStore.getState().clearOutput()
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
      import('./tuningStore').then(m => m.useTuningStore.getState().clearOutput())
      const newTotal = nowActive.reduce((a, l) => a + l.duration_ms, 0)
      useTimeStore.getState().onTotalDurationChanged(newTotal)
    },

    async ensureLogsOnBackend(hashes) {
      for (const hash of hashes) {
        const saved = await logPersistence.getLog(hash)
        if (!saved?.csvBlob) throw new Error(`Blob do log ${hash} não encontrado. Reimporte o arquivo.`)
        await uploadDatalog(saved.csvBlob as File, hash)
      }
    },

    hydrate(entries) {
      set({ logs: entries, isUploading: false, lastError: null })
    },
  }))
)

function persistOrder(logs: LogEntry[]) {
  lsSet('mft:log-order', {
    orderedHashes: logs.map(l => l.hash),
    enabledHashes: logs.filter(l => l.enabled).map(l => l.hash),
  })
}
