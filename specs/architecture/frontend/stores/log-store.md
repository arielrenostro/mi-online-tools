# Store: `useLogStore`

Store Zustand responsável por gerenciar os logs de datalog: upload, remoção, reordenação, ativação/desativação e persistência.

---

## Estado completo

```typescript
// src/store/logStore.ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { LogEntry, DatalogModel } from '@/types/datalog'

interface LogState {
  /** Lista de logs na ordem de concatenação temporal.
   *  Logs disabled ainda estão na lista mas são excluídos da análise. */
  logs: LogEntry[]

  /** true durante o upload de um novo log. */
  isUploading: boolean

  /** Mensagem de erro do último upload. null = sem erro. */
  lastError: string | null
}

interface LogActions {
  addLog(file: File): Promise<void>
  removeLog(hash: string): Promise<void>
  toggleLog(hash: string): void
  reorder(orderedHashes: string[]): void

  /** Garante que todos os logs com os hashes fornecidos estão disponíveis no backend.
   *  Usa o cache por hash — se o arquivo já estiver no disco do backend, retorna imediatamente.
   *  Chamado por tuningStore.runTuning() antes de cada execução. */
  ensureLogsOnBackend(hashes: string[]): Promise<void>

  /** Usado pelo sessionRestorer para popular o store sem re-executar uploads. */
  hydrate(entries: LogEntry[]): void
}

type LogStore = LogState & LogActions
```

### Valores iniciais

```typescript
const initialState: LogState = {
  logs:        [],
  isUploading: false,
  lastError:   null,
}
```

---

## Seletores (computed)

Os seletores são funções puras que derivam dados do estado. Usados com `useLogStore(selector)`.

```typescript
// src/store/logStore.ts — exportados junto com o store

/** Logs com enabled = true, na ordem atual. */
export const selectActiveLogs = (state: LogState): LogEntry[] =>
  state.logs.filter((l) => l.enabled)

/** Duração total em ms de todos os logs ativos concatenados. */
export const selectTotalDuration = (state: LogState): number =>
  state.logs
    .filter((l) => l.enabled)
    .reduce((acc, l) => acc + l.duration_ms, 0)

/**
 * Interseção dos sinais de todos os logs ativos.
 * Retorna apenas sinais presentes em TODOS os logs ativos.
 * Se não houver logs ativos, retorna [].
 *
 * Lógica: para garantir que um sinal selecionado pelo usuário no TimeRail
 * ou nos gráficos seja realmente acessível em todos os logs, só exibimos
 * sinais comuns a todos. Sinais presentes apenas em alguns logs não podem
 * ser visualizados de forma contínua na linha do tempo concatenada.
 */
export const selectAllSignals = (state: LogState): string[] => {
  const active = state.logs.filter((l) => l.enabled)
  if (active.length === 0) return []
  if (active.length === 1) return active[0].model.signals

  // Interseção: começa com o conjunto do primeiro log, remove quem não está nos demais
  const first = new Set(active[0].model.signals)
  for (let i = 1; i < active.length; i++) {
    const current = new Set(active[i].model.signals)
    for (const s of first) {
      if (!current.has(s)) first.delete(s)
    }
  }
  return Array.from(first)
}
```

---

## Implementação do store

```typescript
// src/store/logStore.ts (continuação)
import { uploadDatalog }          from '@/api/datalog'
import { computeHash }            from '@/api/client'
import { parseDatalogClient }     from '@/parsers/datalogParser'
import { ApiError, NetworkError, TimeoutError } from '@/api/client'
import * as logPersistence        from '@/persistence/logPersistence'
import { lsSet }                  from '@/persistence/localStorage'
import { useTuningStore }         from './tuningStore'
import { useTimeStore }           from './timeStore'

export const useLogStore = create<LogStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ── addLog ────────────────────────────────────────────────────────────────
    async addLog(file: File): Promise<void> {
      // Calcula hash antes do upload para detecção de duplicatas e cache server-side
      const hash = await computeHash(file)

      // Verifica duplicata localmente antes de fazer qualquer requisição
      if (get().logs.some((l) => l.hash === hash)) {
        set({ lastError: `Log já carregado: ${file.name}` })
        return
      }

      set({ isUploading: true, lastError: null })
      try {
        const model = await parseDatalogClient(file)

        const entry: LogEntry = {
          hash,
          filename:    file.name,
          model,
          enabled:     true,
          duration_ms: model.duration_ms,
        }

        const newLogs = [...get().logs, entry]
        set({ logs: newLogs, isUploading: false })

        // Persiste modelo + blob CSV no IndexedDB
        await logPersistence.saveLog({
          hash,
          filename: file.name,
          model,
          csvBlob:  file,
          savedAt:  Date.now(),
        })

        // Persiste ordem e estado enabled no localStorage
        persistLogOrder(newLogs)

      } catch (err) {
        set({ isUploading: false, lastError: formatError(err) })
      }
    },

    // ── removeLog ─────────────────────────────────────────────────────────────
    async removeLog(hash: string): Promise<void> {
      const { logs } = get()
      const entry = logs.find((l) => l.hash === hash)
      if (!entry) return

      const wasActive = entry.enabled
      const newLogs = logs.filter((l) => l.hash !== hash)
      set({ logs: newLogs })

      // Remove do IndexedDB
      try {
        await logPersistence.deleteLog(hash)
      } catch (err) {
        console.warn('[mft] Falha ao remover log do IndexedDB:', err)
      }

      // Persiste nova ordem no localStorage
      persistLogOrder(newLogs)

      // Se o log removido estava ativo, limpa output (desatualizado)
      if (wasActive) {
        useTuningStore.getState().clearOutput()

        // Notifica o TimeStore para ajustar cursor/selection ao novo range
        const newTotal = newLogs
          .filter((l) => l.enabled)
          .reduce((acc, l) => acc + l.duration_ms, 0)
        useTimeStore.getState().onTotalDurationChanged(newTotal)
      }
    },

    // ── toggleLog ─────────────────────────────────────────────────────────────
    toggleLog(hash: string): void {
      const { logs } = get()
      const entry = logs.find((l) => l.hash === hash)
      if (!entry) return

      const wasEnabled = entry.enabled
      const newLogs = logs.map((l) =>
        l.hash === hash ? { ...l, enabled: !l.enabled } : l
      )
      set({ logs: newLogs })

      // Persiste nova configuração enabled no localStorage
      persistLogOrder(newLogs)

      // Verifica se o toggle desativou o último log ativo
      const nowActive = newLogs.filter((l) => l.enabled)
      if (wasEnabled && nowActive.length === 0) {
        // Desativou o último log ativo — limpa seleção de tempo
        useTimeStore.getState().clearSelection()
      }

      // Limpa output do tuning pois os dados base mudaram
      useTuningStore.getState().clearOutput()

      // Notifica o TimeStore sobre a mudança de duração total
      const newTotal = nowActive.reduce((acc, l) => acc + l.duration_ms, 0)
      useTimeStore.getState().onTotalDurationChanged(newTotal)
    },

    // ── reorder ───────────────────────────────────────────────────────────────
    reorder(orderedHashes: string[]): void {
      const { logs } = get()

      // Reconstrói a lista na nova ordem, preservando entradas não listadas no final
      const mapped = new Map(logs.map((l) => [l.hash, l]))
      const reordered = orderedHashes
        .map((h) => mapped.get(h))
        .filter((l): l is LogEntry => l !== undefined)

      // Adiciona entradas que por algum motivo não estavam em orderedHashes
      const inOrdered = new Set(orderedHashes)
      const remaining = logs.filter((l) => !inOrdered.has(l.hash))

      const newLogs = [...reordered, ...remaining]
      set({ logs: newLogs })
      persistLogOrder(newLogs)
    },

    // ── ensureLogsOnBackend ───────────────────────────────────────────────────
    async ensureLogsOnBackend(hashes: string[]): Promise<void> {
      for (const hash of hashes) {
        const saved = await logPersistence.getLog(hash)
        if (!saved?.csvBlob) {
          throw new Error(`Blob do log ${hash} não encontrado no IndexedDB. Reimporte o arquivo.`)
        }
        // Cache por hash: se o arquivo já estiver no disco do backend, retorna cached: true rapidamente
        await uploadDatalog(saved.csvBlob as File, hash)
      }
    },

    // ── hydrate (sessionRestorer) ─────────────────────────────────────────────
    hydrate(entries: LogEntry[]): void {
      set({ logs: entries, isUploading: false, lastError: null })
    },
  }))
)

// ── Helpers ──────────────────────────────────────────────────────────────────

function persistLogOrder(logs: LogEntry[]): void {
  lsSet('miot:log-order', {
    orderedHashes: logs.map((l) => l.hash),
    enabledHashes: logs.filter((l) => l.enabled).map((l) => l.hash),
  })
}

function formatError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status === 422
      ? `CSV inválido: ${err.detail}`
      : `Erro do servidor: ${err.detail}`
  }
  if (err instanceof NetworkError) return 'Sem conexão com o servidor.'
  if (err instanceof TimeoutError) return 'Upload demorou muito. Tente com um arquivo menor.'
  return 'Erro desconhecido ao carregar log.'
}
```

---

## Seletor `allSignals` — detalhamento da interseção

O motivo de usar **interseção** (sinais presentes em todos os logs ativos) em vez de **união** (sinais presentes em qualquer log):

- O TimeRail exibe uma sparkline contínua do sinal selecionado ao longo de toda a linha do tempo concatenada.
- Os gráficos na aba Gráficos exibem séries contínuas ao longo de todos os logs.
- Se um sinal está presente apenas no Log A mas não no Log B, e os dois estão concatenados, haverá um "buraco" na série durante o período do Log B.
- Isso é confuso — o usuário poderia pensar que o motor estava desligado ou que há dados faltando.

Usar a interseção garante que todos os sinais disponíveis para seleção estejam presentes de forma contínua em toda a linha do tempo.

**Exemplo:**

| Log | Sinais disponíveis |
|-----|--------------------|
| Log A | RPM, MAP, Lambda 1, CLT, Pedal |
| Log B | RPM, MAP, Lambda 1, CLT (sem coluna Pedal) |

Interseção: `[RPM, MAP, Lambda 1, CLT]` — Pedal não aparece nos seletores de sinal.

---

## Side effects ao alterar `activeLogs`

Qualquer mudança que afete `activeLogs` (toggle ou remoção) dispara dois side effects:

1. **`useTuningStore.getState().clearOutput()`** — o TuningOutput foi calculado com um conjunto específico de logs e provavelmente está desatualizado.
2. **`useTimeStore.getState().onTotalDurationChanged(newTotal)`** — notifica o TimeStore para ajustar cursor e seleção ao novo range de tempo.

Ambos são chamados via `getState()` (acesso direto ao estado Zustand) — nunca via hook, pois estamos fora do ciclo de render React.

---

## O que `onTotalDurationChanged` faz no TimeStore

Ver a spec completa em `stores/time-store.md`. Em resumo:
- Se `cursor_ms > newTotal` → clampado para `newTotal`.
- Se `selection` está inteiramente fora do novo range → removida.
- Se `selection` está parcialmente fora → ajustada para caber no novo range.

---

## Persistência detalhada

| Dado | Onde | Quando |
|------|------|--------|
| `model` + `csvBlob` de cada log | IndexedDB (`logs`) | Imediatamente após `addLog()` bem-sucedido |
| Ordem dos logs (`orderedHashes`) | localStorage (`miot:log-order`) | Após `addLog()`, `removeLog()`, `reorder()` |
| Estado `enabled` de cada log | localStorage (`miot:log-order.enabledHashes`) | Após `toggleLog()` |
| Remoção de log | IndexedDB (`logs`) | Dentro de `removeLog()` |

O model completo do log (com todas as linhas, parseado client-side) fica no IndexedDB. O localStorage armazena apenas os hashes e o estado `enabled` — dados pequenos disponíveis sincronamente na restauração. O blob CSV também fica no IndexedDB, necessário para `ensureLogsOnBackend()`.

---

## Seletores recomendados para componentes

```typescript
// Todos os logs (para o painel de gerenciamento de logs na TopBar)
const logs = useLogStore((s) => s.logs)

// Apenas os logs ativos (para TimeRail, gráficos, análise)
const activeLogs = useLogStore(selectActiveLogs)

// Duração total para exibição no TimeRail e no card de Datalog
const totalDuration = useLogStore(selectTotalDuration)

// Sinais disponíveis para seleção (para seletores de sparkline e de gráfico)
const availableSignals = useLogStore(selectAllSignals)

// Estado de loading para spinner no botão "+ Adicionar"
const isUploading = useLogStore((s) => s.isUploading)
const lastError   = useLogStore((s) => s.lastError)

// Para o guard RequireLog
const hasActiveLogs = useLogStore((s) => s.logs.some((l) => l.enabled))
```

---

## Localização do arquivo

`src/store/logStore.ts`
