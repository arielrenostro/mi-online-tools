# Persistência de Estado — Frontend

O usuário nunca deve perder seu trabalho ao fechar o navegador, dar F5 ou reabrir uma aba. Esta spec detalha os dois mecanismos de persistência, a lógica de restauração de sessão, o tratamento de falhas e as regras de invalidação.

---

## Por que dois mecanismos

A aplicação usa **localStorage** e **IndexedDB** de forma complementar:

| Mecanismo | Capacidade | API | Quando usar |
|-----------|-----------|-----|-------------|
| `localStorage` | ~5 MB (strings) | Síncrona | Dados pequenos (config, preferências de UI, metadados de ordem) |
| `IndexedDB` | Centenas de MB | Assíncrona (Promise) | Blobs de arquivo, JSON grandes (modelos de mapa e log, TuningOutput) |

Se armazenássemos o modelo completo de um log (que pode ter >100 mil linhas) no `localStorage`, facilmente ultrapassaríamos o limite de 5 MB com dois logs. O IndexedDB suporta blobs binários nativamente — ideal para os arquivos CSV originais que precisam ser reenviados ao backend no restore.

O `localStorage` é ideal para dados que precisam estar disponíveis **sincronamente** no início da inicialização (configurações de UI que afetam o primeiro render, ordem dos logs) e para dados que são pequenos e raramente maiores que alguns kilobytes.

---

## IndexedDB

**Nome do banco:** `miot-db`  
**Versão:** `1`  
**Biblioteca:** `idb` (wrapper moderno com Promises — não usar `idb-keyval`, que não suporta múltiplos object stores customizados de forma eficiente)

### Object stores

```typescript
// persistence/db.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface MiotDB extends DBSchema {
  // Armazena o mapa atual (original + editável + blob CSV)
  'map': {
    key: string            // sempre "current"
    value: MapDBEntry
  }

  // Armazena os logs individualmente (indexados por hash)
  'logs': {
    key: string            // hash SHA-1 do arquivo CSV (formato "sha1:<hex>")
    value: LogDBEntry
    indexes: { 'by-filename': string }
  }

  // Armazena o último TuningOutput gerado
  'tuning-output': {
    key: string            // sempre "last"
    value: TuningOutputDBEntry
  }
}

interface MapDBEntry {
  originalModel: MapModel           // modelo parseado client-side
  editableCells: number[][] | null  // cópia editável (pode diferir do original)
  csvBlob: Blob                     // arquivo CSV original (para exportação client-side)
  savedAt: number                   // Date.now() — para diagnóstico
}

interface LogDBEntry {
  hash: string                      // SHA-1 do arquivo CSV ("sha1:<hex>")
  filename: string
  model: DatalogModel               // modelo completo com todas as linhas
  csvBlob: Blob                     // arquivo CSV original
  savedAt: number
}

interface TuningOutputDBEntry {
  output: TuningOutput
  savedAt: number
}

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

### Operações por object store

#### `map`

```typescript
// persistence/mapPersistence.ts
import { getDB } from './db'
import type { MapModel } from '@/types/map'

export async function saveMap(
  originalModel: MapModel,
  editableCells: number[][] | null,
  csvBlob: Blob
): Promise<void> {
  const db = await getDB()
  await db.put('map', {
    originalModel,
    editableCells,
    csvBlob,
    savedAt: Date.now(),
  }, 'current')
}

export async function loadMap(): Promise<MapDBEntry | undefined> {
  const db = await getDB()
  return db.get('map', 'current')
}

export async function clearMap(): Promise<void> {
  const db = await getDB()
  await db.delete('map', 'current')
}

export async function updateEditableCells(cells: number[][]): Promise<void> {
  const db = await getDB()
  const existing = await db.get('map', 'current')
  if (!existing) return
  await db.put('map', { ...existing, editableCells: cells, savedAt: Date.now() }, 'current')
}
```

#### `logs`

```typescript
// persistence/logPersistence.ts
export async function saveLog(entry: LogDBEntry): Promise<void> {
  const db = await getDB()
  await db.put('logs', entry)
}

export async function loadAllLogs(): Promise<LogDBEntry[]> {
  const db = await getDB()
  return db.getAll('logs')
}

export async function getLog(hash: string): Promise<LogDBEntry | undefined> {
  const db = await getDB()
  return db.get('logs', hash)
}

export async function deleteLog(hash: string): Promise<void> {
  const db = await getDB()
  await db.delete('logs', hash)
}
```

#### `tuning-output`

```typescript
// persistence/tuningPersistence.ts
export async function saveTuningOutput(output: TuningOutput): Promise<void> {
  const db = await getDB()
  await db.put('tuning-output', { output, savedAt: Date.now() }, 'last')
}

export async function loadTuningOutput(): Promise<TuningOutput | undefined> {
  const db = await getDB()
  const entry = await db.get('tuning-output', 'last')
  return entry?.output
}

export async function clearTuningOutput(): Promise<void> {
  const db = await getDB()
  await db.delete('tuning-output', 'last')
}
```

---

## localStorage

**Prefixo de chaves:** `mft:` (para evitar colisão com outras apps no mesmo domínio)

| Chave | Conteúdo | Tipo | Store |
|-------|----------|------|-------|
| `mft:config` | `TuningConfig` serializada | JSON object | `useTuningStore` |
| `mft:engine-id` | ID do engine selecionado | string | `useTuningStore` |
| `mft:log-order` | `{ orderedHashes: string[]; enabledHashes: string[] }` | JSON object | `useLogStore` |
| `mft:ui` | `UIState` completo | JSON object | `useUIStore` |
| `mft:time` | `{ cursor_ms: number \| null; selection: TimeSelection \| null; sparklineSensor: string }` | JSON object | `useTimeStore` |

### Utilitários de acesso

```typescript
// persistence/localStorage.ts

export function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  } catch {
    console.warn(`[mft] Falha ao ler localStorage["${key}"]`)
    return null
  }
}

export function lsSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    // QuotaExceededError — log silencioso, não travar o app
    console.warn(`[mft] Falha ao salvar em localStorage["${key}"]`, e)
  }
}

export function lsClear(key: string): void {
  localStorage.removeItem(key)
}
```

---

## `sessionRestorer.ts` — Algoritmo de restauração

O `sessionRestorer` é chamado **uma única vez**, em `main.tsx`, antes do primeiro render. Ele orquestra a leitura de todos os mecanismos de persistência e popula os stores Zustand.

```typescript
// persistence/sessionRestorer.ts
import { useMapStore }     from '@/store/mapStore'
import { useLogStore }     from '@/store/logStore'
import { useTimeStore }    from '@/store/timeStore'
import { useTuningStore }  from '@/store/tuningStore'
import { useUIStore }      from '@/store/uiStore'
import { useSessionStore } from '@/store/sessionStore'
import * as mapPersistence    from './mapPersistence'
import * as logPersistence    from './logPersistence'
import * as tuningPersistence from './tuningPersistence'
import { lsGet }              from './localStorage'

export async function restore(): Promise<void> {
  // Sinaliza que a restauração está em andamento (guards aguardam)
  useSessionStore.getState().setRestoring(true)

  try {
    await restoreStep_UI()
    await restoreStep_TuningConfig()
    await restoreStep_Map()
    await restoreStep_Logs()
    await restoreStep_TuningOutput()
    await restoreStep_Time()
  } catch (err) {
    // Erro inesperado no restorer — não deve travar o app
    console.error('[mft] sessionRestorer falhou:', err)
  } finally {
    useSessionStore.getState().setRestoring(false)
  }
}
```

### Passo a passo detalhado

**Etapa 1 — Restaurar UIState**

```typescript
async function restoreStep_UI() {
  const savedUI = lsGet<UIState>('mft:ui')
  if (savedUI) {
    useUIStore.getState().hydrate(savedUI)
  }
  // Falha aqui = UI fica com valores default. Não é crítico.
}
```

**Etapa 2 — Restaurar TuningConfig e engine selecionado**

```typescript
async function restoreStep_TuningConfig() {
  const savedConfig = lsGet<TuningConfig>('mft:config')
  const savedEngineId = lsGet<string>('mft:engine-id')

  if (savedConfig) {
    useTuningStore.getState().hydrateConfig(savedConfig)
  }
  if (savedEngineId) {
    useTuningStore.getState().hydrateEngineId(savedEngineId)
  }
}
```

**Etapa 3 — Restaurar mapa**

```typescript
async function restoreStep_Map() {
  let mapEntry: MapDBEntry | undefined
  try {
    mapEntry = await mapPersistence.loadMap()
  } catch (err) {
    // IndexedDB indisponível (Safari private mode, etc.) — log e prosseguir
    console.warn('[mft] IndexedDB indisponível para mapa:', err)
    return
  }

  if (!mapEntry) return   // nenhum mapa salvo

  useMapStore.getState().hydrate({
    originalModel: mapEntry.originalModel,
    editableCells: mapEntry.editableCells ?? mapEntry.originalModel.cells,
  })
}
```

**Etapa 4 — Restaurar logs**

```typescript
async function restoreStep_Logs() {
  const logOrder = lsGet<{ orderedHashes: string[]; enabledHashes: string[] }>('mft:log-order')

  let logEntries: LogDBEntry[]
  try {
    logEntries = await logPersistence.loadAllLogs()
  } catch (err) {
    console.warn('[mft] IndexedDB indisponível para logs:', err)
    return
  }

  if (logEntries.length === 0) return

  const orderedLogs = sortLogsByOrder(logEntries, logOrder?.orderedHashes ?? [])
  const enabledHashes = new Set(logOrder?.enabledHashes ?? [])

  const entries: LogEntry[] = orderedLogs.map((entry) => ({
    hash:        entry.hash,
    filename:    entry.filename,
    model:       entry.model,
    enabled:     enabledHashes.size === 0 ? true : enabledHashes.has(entry.hash),
    duration_ms: entry.model.duration_ms,
  }))

  useLogStore.getState().hydrate(entries)
}
```

**Etapa 5 — Restaurar TuningOutput**

```typescript
async function restoreStep_TuningOutput() {
  let output: TuningOutput | undefined
  try {
    output = await tuningPersistence.loadTuningOutput()
  } catch (err) {
    console.warn('[mft] IndexedDB indisponível para TuningOutput:', err)
    return
  }

  if (output) {
    useTuningStore.getState().hydrateOutput(output)
  }
}
```

**Etapa 6 — Restaurar TimeStore**

```typescript
async function restoreStep_Time() {
  const saved = lsGet<{ cursor_ms: number | null; selection: TimeSelection | null; sparklineSensor: string }>('mft:time')
  if (saved) {
    useTimeStore.getState().hydrate(saved)
  }
}
```

### Toast de confirmação

Após a restauração bem-sucedida (pelo menos mapa ou logs encontrados), exibir um toast discreto. Colocar após o bloco `try/catch/finally`, fora do escopo de `restore()`:

```typescript
// Após restore() concluir (isRestoring já é false):
const hasData = useMapStore.getState().originalMap !== null
             || useLogStore.getState().logs.length > 0

if (hasData) {
  toast({ title: 'Sessão restaurada', description: 'Seus dados foram carregados automaticamente.' })
}
```

---

## IndexedDB indisponível (Safari private mode)

Safari em modo de navegação privada desabilita completamente o IndexedDB. Nesse caso:

1. A chamada `openDB()` lança uma exceção.
2. O `sessionRestorer` captura o erro, loga um warning e continua.
3. Não há restauração de sessão — a aplicação inicia no estado limpo.
4. As operações de persistência (saves) são silenciosamente ignoradas — os stores funcionam normalmente em memória.
5. Um aviso é exibido: "Modo de persistência indisponível — seus dados serão perdidos ao recarregar a página."

```typescript
// persistence/db.ts — versão com fallback
let _dbAvailable: boolean | null = null

export async function isDBAvailable(): Promise<boolean> {
  if (_dbAvailable !== null) return _dbAvailable
  try {
    await getDB()
    _dbAvailable = true
  } catch {
    _dbAvailable = false
  }
  return _dbAvailable
}

// Todas as funções de save verificam antes de tentar:
export async function saveMap(entry: MapDBEntry): Promise<void> {
  if (!await isDBAvailable()) return   // silencioso — app funciona sem salvar
  const db = await getDB()
  await db.put('map', entry, 'current')
}
```

---

## Como cada store persiste

Os stores Zustand usam um padrão de **subscriber manual**: após cada mutação relevante, um listener persiste de forma assíncrona no IndexedDB ou síncrona no localStorage. Não se usa o middleware `persist` do Zustand porque:

1. O `persist` middleware salva/carrega o store **inteiro** atomicamente, mas precisamos de controle granular (ex.: persistir `editableCells` debounced e `originalModel` imediato).
2. O IndexedDB é assíncrono e o middleware `persist` padrão foi projetado para localStorage síncrono.
3. A lógica de restauração exige controle granular sobre a ordem e o timing de cada store — difícil de encapsular em um rehydrator genérico.

### Padrão de subscriber

```typescript
// Exemplo no mapStore.ts
import { subscribeWithSelector } from 'zustand/middleware'
import { debounce } from '@/utils/debounce'

const debouncedSaveEditableCells = debounce(async (cells: number[][]) => {
  await mapPersistence.updateEditableCells(cells)
}, 300)

// Configurado uma vez na inicialização do store:
useMapStore.subscribe(
  (state) => state.editableMap,
  (editableMap) => {
    if (editableMap !== null) {
      debouncedSaveEditableCells(editableMap)
    }
  }
)
```

### Resumo de persistência por store

| Store | Dado | Mecanismo | Timing |
|-------|------|-----------|--------|
| `useMapStore` | `originalModel` + `csvBlob` | IndexedDB | Imediato após `loadMap()` bem-sucedido |
| `useMapStore` | `editableCells` | IndexedDB | Debounced 300ms após `updateCell` ou `applyTuningOutput` |
| `useLogStore` | `model` + `csvBlob` por log | IndexedDB | Imediato após `addLog()` bem-sucedido |
| `useLogStore` | ordem e `enabled` | localStorage | Imediato após `reorder` ou `toggleLog` |
| `useTuningStore` | `config` | localStorage | Imediato após `updateConfig` |
| `useTuningStore` | `selectedEngineId` | localStorage | Imediato após `setEngine` |
| `useTuningStore` | `lastOutput` | IndexedDB | Imediato após `runTuning` bem-sucedido |
| `useTimeStore` | `cursor_ms`, `selection`, `sparklineSensor` | localStorage | Imediato após cada mudança |
| `useUIStore` | `UIState` inteiro | localStorage | Imediato após qualquer mudança |

---

## Invalidação de estado

| Evento | O que deve ser limpo | Mecanismo |
|--------|---------------------|-----------|
| Usuário substitui mapa | `lastOutput` (IndexedDB), `editableCells` reseta para `originalModel.cells` | `mapStore.loadMap()` chama `tuningStore.clearOutput()` |
| Usuário remove um log | `lastOutput` (IndexedDB + store) | `logStore.removeLog()` chama `tuningStore.clearOutput()` |
| Usuário desativa um log | `lastOutput` (IndexedDB + store) | `logStore.toggleLog()` chama `tuningStore.clearOutput()` se log era ativo |
| Usuário altera `TuningConfig` | `configDirty = true` (não apaga output, apenas marca como desatualizado) | `tuningStore.updateConfig()` |
| `mapStore.clear()` | Tudo: IndexedDB `map`, `tuning-output`; localStorage entries | Chamada explícita (não exposta na UI diretamente) |

---

## Localização dos arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/persistence/db.ts` | Inicialização do IndexedDB, schema, fallback de disponibilidade |
| `src/persistence/mapPersistence.ts` | CRUD do object store `map` |
| `src/persistence/logPersistence.ts` | CRUD do object store `logs` |
| `src/persistence/tuningPersistence.ts` | CRUD do object store `tuning-output` |
| `src/persistence/localStorage.ts` | Utilitários `lsGet`/`lsSet`/`lsClear` com tratamento de erro |
| `src/persistence/sessionRestorer.ts` | Orquestra a restauração completa na inicialização |
