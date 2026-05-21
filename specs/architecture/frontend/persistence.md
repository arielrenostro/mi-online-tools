# Persistência de Estado — Frontend

O usuário nunca perde o trabalho ao fechar o navegador, dar F5 ou reabrir. Dois mecanismos complementares, restauração de sessão, tratamento de falhas e invalidação.

## Dois mecanismos

| Mecanismo | Capacidade | API | Quando usar |
|-----------|-----------|-----|-------------|
| `localStorage` | ~5 MB (strings) | Síncrona | Config, preferências de UI, metadados de ordem |
| `IndexedDB` | Centenas de MB | Assíncrona | Blobs de arquivo, JSONs grandes (modelos de mapa/log, TuningOutput) |

Um log pode ter >100 mil linhas — `localStorage` estouraria com dois logs. IndexedDB suporta blobs binários (os CSVs são reenviados ao backend no restore). `localStorage` serve para dados pequenos disponíveis **sincronamente** no início da inicialização.

## IndexedDB

**Banco:** `miot-db` · **Versão:** `1` · **Lib:** `idb` (Promises)

### Object stores

| Store | Key | Value |
|-------|-----|-------|
| `map` | sempre `"current"` | `MapDBEntry` |
| `logs` | SHA-1 `"sha1:<hex>"` (keyPath `hash`) | `LogDBEntry`; índice `by-filename` |
| `tuning-output` | sempre `"last"` | `TuningOutputDBEntry` |

```typescript
interface MapDBEntry {
  originalModel: MapModel
  editableCells: number[][] | null  // cópia editável (pode diferir do original)
  csvBlob: Blob                     // CSV original (exportação client-side)
  savedAt: number
}
interface LogDBEntry {
  hash: string; filename: string
  model: DatalogModel               // modelo completo
  csvBlob: Blob; savedAt: number
}
interface TuningOutputDBEntry { output: TuningOutput; savedAt: number }
```

### Operações por módulo

- **`mapPersistence.ts`** (store `map`): `saveMap`, `loadMap`, `clearMap`, `updateEditableCells` (merge no entry existente).
- **`logPersistence.ts`** (store `logs`): `saveLog`, `loadAllLogs`, `getLog(hash)`, `deleteLog(hash)`.
- **`tuningPersistence.ts`** (store `tuning-output`): `saveTuningOutput`, `loadTuningOutput`, `clearTuningOutput`.

## localStorage

**Prefixo de chaves:** `miot:`

| Chave | Conteúdo | Store |
|-------|----------|-------|
| `miot:config` | `TuningConfig` | `useTuningStore` |
| `miot:engine-id` | ID do engine selecionado | `useTuningStore` |
| `miot:log-order` | `{ orderedHashes: string[]; enabledHashes: string[] }` | `useLogStore` |
| `miot:ui` | `UIState` | `useUIStore` |
| `miot:time` | `{ cursor_ms; selection; sparklineSensor }` | `useTimeStore` |

Utilitários `lsGet<T>` / `lsSet<T>` / `lsClear` (`persistence/localStorage.ts`) encapsulam `JSON.parse`/`stringify` e capturam exceções (parse inválido, `QuotaExceededError`), logando warning e degradando graciosamente.

## `sessionRestorer.ts` — Restauração

Chamado **uma vez** em `main.tsx`. Marca `useSessionStore.isRestoring = true`, executa os passos abaixo e ao final marca `isRestoring = false` (mesmo em caso de erro — não trava o app).

1. **UIState** — `lsGet('miot:ui')` → `useUIStore.hydrate()`. Falha = UI nos defaults.
2. **TuningConfig + engine** — `lsGet('miot:config')`/`'miot:engine-id'` → `hydrateConfig`/`hydrateEngineId`.
3. **Mapa** — `mapPersistence.loadMap()` → `useMapStore.hydrate({ originalModel, editableCells: editableCells ?? originalModel.cells })`.
4. **Logs** — `lsGet('miot:log-order')` + `logPersistence.loadAllLogs()`. Ordena por `orderedHashes`; `enabled` por `enabledHashes` (set vazio → todos `true`) → `useLogStore.hydrate()`.
5. **TuningOutput** — `tuningPersistence.loadTuningOutput()` → `useTuningStore.hydrateOutput()`.
6. **TimeStore** — `lsGet('miot:time')` → `useTimeStore.hydrate()`.

Após concluir, se houver mapa ou logs, exibe um toast discreto "Sessão restaurada".

## IndexedDB indisponível (Safari modo privado)

Safari privado desabilita o IndexedDB: `openDB()` lança exceção. `isDBAvailable()` testa uma vez e cacheia o resultado; toda função de `save` verifica antes e é silenciosamente ignorada se indisponível. As stores funcionam em memória; o usuário é avisado da perda de dados ao recarregar.

## Como cada store persiste

Padrão de **subscriber manual**: após cada mutação relevante, um listener persiste (async no IndexedDB, sync no localStorage). Não se usa o middleware `persist` do Zustand — ele salva o store inteiro atomicamente e foi feito para localStorage síncrono; aqui é preciso controle granular (timing, ordem, debounce).

| Store | Dado | Mecanismo | Timing |
|-------|------|-----------|--------|
| `useMapStore` | `originalModel` + `csvBlob` | IndexedDB | Imediato após `loadMap()` |
| `useMapStore` | `editableCells` | IndexedDB | Debounced 300ms após `updateCell`/`applyTuningOutput` |
| `useLogStore` | `model` + `csvBlob` | IndexedDB | Imediato após `addLog()` |
| `useLogStore` | ordem + `enabled` | localStorage | Imediato após `reorder`/`toggleLog`/`addLog` |
| `useTuningStore` | `config` | localStorage | Imediato após `updateConfig`/`resetConfig` |
| `useTuningStore` | `selectedEngineId` | localStorage | Imediato após `setEngine` |
| `useTuningStore` | `lastOutput` | IndexedDB | Imediato após `runTuning` |
| `useTimeStore` | `cursor_ms`, `selection`, `sparklineSensor` | localStorage | Imediato após cada mudança |
| `useUIStore` | `UIState` | localStorage | Imediato após qualquer mudança |

## Invalidação de estado

| Evento | O que é limpo | Mecanismo |
|--------|---------------|-----------|
| Substituir mapa | `lastOutput`; `editableCells` reseta para `originalModel.cells` | `mapStore.loadMap()` → `tuningStore.clearOutput()` |
| Remover log ativo | `lastOutput` | `logStore.removeLog()` → `tuningStore.clearOutput()` |
| Desativar log ativo | `lastOutput` | `logStore.toggleLog()` → `clearOutput()` |
| Alterar `TuningConfig` | `configDirty = true` (não apaga o output, só o marca desatualizado) | `tuningStore.updateConfig()` |
| `mapStore.clear()` | Tudo: IndexedDB `map` + `tuning-output`, localStorage | Chamada explícita |
