# Store: `useLogStore`

Gerencia os datalogs: upload, remoção, reordenação, ativação/desativação e persistência.

**Arquivo:** `src/store/logStore.ts`

## Estado

```typescript
interface LogState {
  logs: LogEntry[]          // ordem de concatenação temporal; disabled ainda estão na lista
  isUploading: boolean
  lastError: string | null
}

interface LogActions {
  addLog(file: File): Promise<void>
  removeLog(hash: string): Promise<void>
  toggleLog(hash: string): void
  reorder(orderedHashes: string[]): void
  /** Garante que os logs estão no backend (cache por hash; no-op se já estiverem).
   *  Chamado por tuningStore.runTuning() antes de cada execução. */
  ensureLogsOnBackend(hashes: string[]): Promise<void>
  hydrate(entries: LogEntry[]): void  // sessionRestorer
}
```

Valores iniciais: `logs: []`, `isUploading: false`, `lastError: null`.

## Seletores

```typescript
/** Logs enabled, na ordem atual. */
export const selectActiveLogs = (state: LogState): LogEntry[] =>
  state.logs.filter((l) => l.enabled)

/** Duração total em ms dos logs ativos. */
export const selectTotalDuration = (state: LogState): number =>
  state.logs.filter((l) => l.enabled).reduce((acc, l) => acc + l.duration_ms, 0)

/** Interseção dos sinais de todos os logs ativos (sinais presentes em TODOS).
 *  Garante que um sinal selecionado seja contínuo em toda a timeline concatenada. */
export const selectAllSignals = (state: LogState): string[] => {
  const active = state.logs.filter((l) => l.enabled)
  if (active.length === 0) return []
  if (active.length === 1) return active[0].model.signals
  const first = new Set(active[0].model.signals)
  for (let i = 1; i < active.length; i++) {
    const current = new Set(active[i].model.signals)
    for (const s of first) { if (!current.has(s)) first.delete(s) }
  }
  return Array.from(first)
}
```

## Implementação

```typescript
export const useLogStore = create<LogStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    async addLog(file: File): Promise<void> {
      const hash = await computeHash(file)  // antes do upload: duplicatas + cache server-side
      if (get().logs.some((l) => l.hash === hash)) {
        set({ lastError: `Log já carregado: ${file.name}` })
        return
      }
      set({ isUploading: true, lastError: null })
      try {
        const model = await parseDatalogClient(file)
        const entry: LogEntry = {
          hash, filename: file.name, model, enabled: true, duration_ms: model.duration_ms,
        }
        const newLogs = [...get().logs, entry]
        set({ logs: newLogs, isUploading: false })
        await logPersistence.saveLog({ hash, filename: file.name, model, csvBlob: file, savedAt: Date.now() })
        persistLogOrder(newLogs)
      } catch (err) {
        set({ isUploading: false, lastError: formatError(err) })
      }
    },

    async removeLog(hash: string): Promise<void> {
      const { logs } = get()
      const entry = logs.find((l) => l.hash === hash)
      if (!entry) return
      const wasActive = entry.enabled
      const newLogs = logs.filter((l) => l.hash !== hash)
      set({ logs: newLogs })
      try { await logPersistence.deleteLog(hash) }
      catch (err) { console.warn('[mft] Falha ao remover log do IndexedDB:', err) }
      persistLogOrder(newLogs)
      if (wasActive) {
        useTuningStore.getState().clearOutput()
        const newTotal = newLogs.filter((l) => l.enabled).reduce((a, l) => a + l.duration_ms, 0)
        useTimeStore.getState().onTotalDurationChanged(newTotal)
      }
    },

    toggleLog(hash: string): void {
      const { logs } = get()
      const entry = logs.find((l) => l.hash === hash)
      if (!entry) return
      const wasEnabled = entry.enabled
      const newLogs = logs.map((l) => l.hash === hash ? { ...l, enabled: !l.enabled } : l)
      set({ logs: newLogs })
      persistLogOrder(newLogs)
      const nowActive = newLogs.filter((l) => l.enabled)
      if (wasEnabled && nowActive.length === 0) {
        useTimeStore.getState().clearSelection()  // desativou o último log ativo
      }
      useTuningStore.getState().clearOutput()
      useTimeStore.getState().onTotalDurationChanged(
        nowActive.reduce((a, l) => a + l.duration_ms, 0))
    },

    reorder(orderedHashes: string[]): void {
      const { logs } = get()
      const mapped = new Map(logs.map((l) => [l.hash, l]))
      const reordered = orderedHashes
        .map((h) => mapped.get(h))
        .filter((l): l is LogEntry => l !== undefined)
      const inOrdered = new Set(orderedHashes)
      const remaining = logs.filter((l) => !inOrdered.has(l.hash))  // entradas não listadas vão ao final
      const newLogs = [...reordered, ...remaining]
      set({ logs: newLogs })
      persistLogOrder(newLogs)
    },

    async ensureLogsOnBackend(hashes: string[]): Promise<void> {
      for (const hash of hashes) {
        const saved = await logPersistence.getLog(hash)
        if (!saved?.csvBlob) {
          throw new Error(`Blob do log ${hash} não encontrado no IndexedDB. Reimporte o arquivo.`)
        }
        await uploadDatalog(saved.csvBlob as File, hash)  // cache por hash → cached:true rápido
      }
    },

    hydrate(entries: LogEntry[]): void {
      set({ logs: entries, isUploading: false, lastError: null })
    },
  }))
)

function persistLogOrder(logs: LogEntry[]): void {
  lsSet('miot:log-order', {
    orderedHashes: logs.map((l) => l.hash),
    enabledHashes: logs.filter((l) => l.enabled).map((l) => l.hash),
  })
}

function formatError(err: unknown): string {
  if (err instanceof ApiError)
    return err.status === 422 ? `CSV inválido: ${err.detail}` : `Erro do servidor: ${err.detail}`
  if (err instanceof NetworkError) return 'Sem conexão com o servidor.'
  if (err instanceof TimeoutError) return 'Upload demorou muito. Tente com um arquivo menor.'
  return 'Erro desconhecido ao carregar log.'
}
```

## Seletor `allSignals` — por que interseção

Interseção (sinais em todos os logs ativos), não união. O TimeRail e os gráficos exibem séries contínuas ao longo de todos os logs concatenados; um sinal presente só em alguns logs criaria um "buraco" confuso na série.

Exemplo: Log A `[RPM,MAP,Lambda 1,CLT,Pedal]`, Log B `[RPM,MAP,Lambda 1,CLT]` → interseção `[RPM,MAP,Lambda 1,CLT]` (Pedal não aparece nos seletores).

## Side effects ao alterar `activeLogs`

Toggle ou remoção que afete `activeLogs` dispara, via `getState()`:
1. `useTuningStore.clearOutput()` — output calculado com outro conjunto de logs.
2. `useTimeStore.onTotalDurationChanged(newTotal)` — ajusta cursor e seleção ao novo range.

`onTotalDurationChanged` (ver `stores/time-store.md`): clampa cursor se `> newTotal`; remove selection inteiramente fora; ajusta selection parcialmente fora.

## Persistência

| Dado | Onde | Quando |
|------|------|--------|
| `model` + `csvBlob` | IndexedDB (`logs`) | Após `addLog()` |
| Ordem (`orderedHashes`) | localStorage (`miot:log-order`) | Após `addLog/removeLog/reorder` |
| `enabled` | localStorage (`miot:log-order.enabledHashes`) | Após `toggleLog()` |
| Remoção de log | IndexedDB (`logs`) | Dentro de `removeLog()` |

O model completo fica no IndexedDB; o localStorage guarda só hashes e `enabled` (pequenos, síncronos no restore). O blob CSV no IndexedDB é necessário para `ensureLogsOnBackend()`.

## Seletores recomendados

```typescript
const logs             = useLogStore((s) => s.logs)
const activeLogs       = useLogStore(selectActiveLogs)
const totalDuration    = useLogStore(selectTotalDuration)
const availableSignals = useLogStore(selectAllSignals)
const isUploading      = useLogStore((s) => s.isUploading)
const lastError        = useLogStore((s) => s.lastError)
const hasActiveLogs    = useLogStore((s) => s.logs.some((l) => l.enabled))  // para RequireLog
```
