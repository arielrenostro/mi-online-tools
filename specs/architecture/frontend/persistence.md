# Persistência de Estado — Frontend

O usuário nunca perde o trabalho ao fechar o navegador, dar F5 ou reabrir. Dois mecanismos complementares, restauração de sessão, tratamento de falhas e invalidação.

## Dois mecanismos

| Mecanismo | Capacidade | API | Quando usar |
|-----------|-----------|-----|-------------|
| `localStorage` | ~5 MB (strings) | Síncrona | Config, preferências de UI, metadados de ordem |
| `IndexedDB` | Centenas de MB | Assíncrona | Blobs de arquivo, JSONs grandes (modelos de mapa/log, TuningOutput) |

Um log pode ter >100 mil linhas — `localStorage` estouraria com dois logs. IndexedDB suporta blobs binários (os CSVs originais são reenviados ao backend no restore). `localStorage` serve para dados pequenos disponíveis **sincronamente** no início da inicialização.

## IndexedDB

**Banco:** `miot-db` · **Versão:** `1` · **Lib:** `idb` (Promises; não usar `idb-keyval`)

### Object stores

```typescript
// persistence/db.ts
interface MiotDB extends DBSchema {
  'map':           { key: string; value: MapDBEntry }              // key sempre "current"
  'logs':          { key: string; value: LogDBEntry;               // key = SHA-1 "sha1:<hex>"
                     indexes: { 'by-filename': string } }
  'tuning-output': { key: string; value: TuningOutputDBEntry }     // key sempre "last"
}

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

let _db: IDBPDatabase<MiotDB> | null = null

export async function getDB(): Promise<IDBPDatabase<MiotDB>> {
  if (_db) return _db
  _db = await openDB<MiotDB>('miot-db', 1, {
    upgrade(db) {
      db.createObjectStore('map')
      const logStore = db.createObjectStore('logs', { keyPath: 'hash' })
      logStore.createIndex('by-filename', 'filename')
      db.createObjectStore('tuning-output')
    },
  })
  return _db
}
```

### Operações

```typescript
// mapPersistence.ts — store 'map' (key "current")
saveMap(originalModel, editableCells, csvBlob)  // put { ..., savedAt: Date.now() }
loadMap(): Promise<MapDBEntry | undefined>
clearMap()
updateEditableCells(cells)  // merge no entry existente, atualiza editableCells

// logPersistence.ts — store 'logs' (key = hash)
saveLog(entry: LogDBEntry)
loadAllLogs(): Promise<LogDBEntry[]>
getLog(hash): Promise<LogDBEntry | undefined>
deleteLog(hash)

// tuningPersistence.ts — store 'tuning-output' (key "last")
saveTuningOutput(output)
loadTuningOutput(): Promise<TuningOutput | undefined>
clearTuningOutput()
```

## localStorage

**Prefixo de chaves:** `miot:`

| Chave | Conteúdo | Store |
|-------|----------|-------|
| `miot:config` | `TuningConfig` | `useTuningStore` |
| `miot:engine-id` | ID do engine selecionado | `useTuningStore` |
| `miot:log-order` | `{ orderedHashes: string[]; enabledHashes: string[] }` | `useLogStore` |
| `miot:ui` | `UIState` | `useUIStore` |
| `miot:time` | `{ cursor_ms: number\|null; selection: TimeSelection\|null; sparklineSensor: string }` | `useTimeStore` |

### Utilitários

```typescript
// persistence/localStorage.ts
export function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as T)
  } catch {
    console.warn(`[miot] Falha ao ler localStorage["${key}"]`)
    return null
  }
}

export function lsSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn(`[miot] Falha ao salvar em localStorage["${key}"]`, e)  // QuotaExceededError
  }
}

export function lsClear(key: string): void { localStorage.removeItem(key) }
```

## `sessionRestorer.ts` — Restauração

Chamado **uma vez** em `main.tsx`, antes do primeiro render. Orquestra a leitura de todos os mecanismos e popula os stores.

```typescript
export async function restore(): Promise<void> {
  useSessionStore.getState().setRestoring(true)
  try {
    await restoreStep_UI()
    await restoreStep_TuningConfig()
    await restoreStep_Map()
    await restoreStep_Logs()
    await restoreStep_TuningOutput()
    await restoreStep_Time()
  } catch (err) {
    console.error('[miot] sessionRestorer falhou:', err)  // não trava o app
  } finally {
    useSessionStore.getState().setRestoring(false)
  }
}
```

### Passos

1. **UIState** — `lsGet('miot:ui')` → `useUIStore.hydrate()`. Falha = UI fica nos defaults.
2. **TuningConfig + engine** — `lsGet('miot:config')` → `hydrateConfig()`; `lsGet('miot:engine-id')` → `hydrateEngineId()`.
3. **Mapa** — `mapPersistence.loadMap()` → `useMapStore.hydrate({ originalModel, editableCells: editableCells ?? originalModel.cells })`. IndexedDB indisponível → warning e prossegue.
4. **Logs** — `lsGet('miot:log-order')` + `logPersistence.loadAllLogs()`. Ordena por `orderedHashes`; `enabled` por `enabledHashes` (set vazio → todos true) → `useLogStore.hydrate(entries)`.
5. **TuningOutput** — `tuningPersistence.loadTuningOutput()` → `useTuningStore.hydrateOutput()`.
6. **TimeStore** — `lsGet('miot:time')` → `useTimeStore.hydrate()`.

### Toast de confirmação

Após `restore()` concluir, se houver dados (mapa ou logs), exibir toast discreto "Sessão restaurada".

## IndexedDB indisponível (Safari modo privado)

Safari privado desabilita o IndexedDB. Nesse caso: `openDB()` lança exceção; o restorer captura, loga warning e continua sem restaurar; saves são silenciosamente ignorados (stores funcionam em memória); aviso ao usuário sobre perda de dados ao recarregar.

```typescript
// db.ts — fallback de disponibilidade
let _dbAvailable: boolean | null = null

export async function isDBAvailable(): Promise<boolean> {
  if (_dbAvailable !== null) return _dbAvailable
  try { await getDB(); _dbAvailable = true } catch { _dbAvailable = false }
  return _dbAvailable
}

// Toda função de save verifica antes:
export async function saveMap(entry: MapDBEntry): Promise<void> {
  if (!await isDBAvailable()) return   // silencioso
  const db = await getDB()
  await db.put('map', entry, 'current')
}
```

## Como cada store persiste

Padrão de **subscriber manual**: após cada mutação relevante, um listener persiste (async no IndexedDB, sync no localStorage). Não se usa o middleware `persist` do Zustand porque ele salva o store inteiro atomicamente e foi feito para localStorage síncrono — aqui é preciso controle granular (timing, ordem, debounce).

```typescript
// Exemplo: mapStore.ts
const debouncedSaveEditableCells = debounce(async (cells: number[][]) => {
  await mapPersistence.updateEditableCells(cells)
}, 300)

useMapStore.subscribe(
  (state) => state.editableMap,
  (editableMap) => { if (editableMap !== null) debouncedSaveEditableCells(editableMap) }
)
```

### Resumo de persistência por store

| Store | Dado | Mecanismo | Timing |
|-------|------|-----------|--------|
| `useMapStore` | `originalModel` + `csvBlob` | IndexedDB | Imediato após `loadMap()` |
| `useMapStore` | `editableCells` | IndexedDB | Debounced 300ms após `updateCell`/`applyTuningOutput` |
| `useLogStore` | `model` + `csvBlob` | IndexedDB | Imediato após `addLog()` |
| `useLogStore` | ordem + `enabled` | localStorage | Imediato após `reorder`/`toggleLog` |
| `useTuningStore` | `config` | localStorage | Imediato após `updateConfig` |
| `useTuningStore` | `selectedEngineId` | localStorage | Imediato após `setEngine` |
| `useTuningStore` | `lastOutput` | IndexedDB | Imediato após `runTuning` |
| `useTimeStore` | `cursor_ms`, `selection`, `sparklineSensor` | localStorage | Imediato após cada mudança |
| `useUIStore` | `UIState` | localStorage | Imediato após qualquer mudança |

## Invalidação de estado

| Evento | O que é limpo | Mecanismo |
|--------|---------------|-----------|
| Substituir mapa | `lastOutput`; `editableCells` reseta para `originalModel.cells` | `mapStore.loadMap()` → `tuningStore.clearOutput()` |
| Remover log | `lastOutput` | `logStore.removeLog()` → `tuningStore.clearOutput()` |
| Desativar log | `lastOutput` | `logStore.toggleLog()` → `clearOutput()` se log era ativo |
| Alterar `TuningConfig` | `configDirty = true` (não apaga output, só marca desatualizado) | `tuningStore.updateConfig()` |
| `mapStore.clear()` | Tudo: IndexedDB `map`+`tuning-output`, localStorage | Chamada explícita |

## Localização dos arquivos

| Arquivo | Responsabilidade |
|---------|------------------|
| `persistence/db.ts` | Init IndexedDB, schema, fallback |
| `persistence/mapPersistence.ts` | CRUD `map` |
| `persistence/logPersistence.ts` | CRUD `logs` |
| `persistence/tuningPersistence.ts` | CRUD `tuning-output` |
| `persistence/localStorage.ts` | `lsGet`/`lsSet`/`lsClear` |
| `persistence/sessionRestorer.ts` | Orquestra a restauração |
