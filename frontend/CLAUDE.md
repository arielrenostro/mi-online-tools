# Frontend — Master Injection Online Tools

**Stack:** React 18 · TypeScript 5 · Vite 5 · Tailwind CSS 3 · Zustand 4 · idb 8

Spec de referência: `../specs/architecture/frontend/frontend.md`  
Atalhos e UI da aba VE: `../specs/features/tuning/ve.md`

## Rodar

```bash
npm install
npm run dev          # dev server em http://localhost:5173
npm run build        # build de produção em dist/
```

```bash
# Docker (VITE_API_URL é build-time)
docker build --build-arg VITE_API_URL=http://localhost:8000 -t miot-frontend .
docker run -p 80:80 mft-frontend
```

A URL da API é configurada em build-time via `VITE_API_URL`. Em dev, usa `http://localhost:8000` por padrão (ver `src/api/client.ts`).

## Estrutura

```
src/
├── api/                     # Comunicação com o backend
│   ├── client.ts            # apiFetch, ApiError, NetworkError, TimeoutError, computeHash
│   ├── datalog.ts           # uploadDatalog(file, hash)
│   ├── engines.ts           # listEngines(), getEngine(id)
│   └── tuning.ts            # runTuning(req)
├── components/
│   └── HeatmapTable.tsx     # Tabela interativa com seleção, edição inline, undo/redo
├── features/tuning/
│   ├── TopBar.tsx            # Header: importar mapa, datalogs, configurações
│   ├── LogsPanel.tsx         # Drawer lateral: upload e gerenciamento de datalogs
│   ├── TuningConfigModal.tsx # Modal de configuração via JSON Schema
│   ├── BulkEditModal.tsx     # Modal F2: edição em massa por % ou valor fixo
│   ├── OriginalMapSection.tsx # Mapa original colapsável (somente leitura)
│   ├── EditableMapSection.tsx # Mapa editável + auto-tuning + exportar
│   └── AnalysisSection.tsx   # Heatmaps diagnósticos + warnings + filter stats
├── pages/
│   └── TuningPage.tsx        # Layout principal + listener global Ctrl+Z/Y
├── parsers/
│   ├── mapParser.ts          # parseMapClient(file) → MapModel (client-side)
│   └── datalogParser.ts      # parseDatalogClient(file) → DatalogModel (client-side)
├── persistence/
│   ├── db.ts                 # IndexedDB via idb: stores map, logs, tuning-output
│   ├── mapPersistence.ts     # saveMap / loadMap / updateEditableCells / clearMap
│   ├── logPersistence.ts     # saveLog / getLog / loadAllLogs / deleteLog
│   ├── tuningPersistence.ts  # saveTuningOutput / loadTuningOutput / clearTuningOutput
│   ├── localStorage.ts       # lsGet / lsSet / lsClear
│   └── sessionRestorer.ts    # Restaura sessão na inicialização (sem chamadas ao backend)
├── store/
│   ├── mapStore.ts           # originalMap, editableMap, history/future, undo/redo
│   ├── logStore.ts           # logs, addLog, removeLog, toggleLog, ensureLogsOnBackend
│   ├── tuningStore.ts        # config, selectedEngineId, lastOutput, runTuning
│   └── timeStore.ts          # stub mínimo (sem TimeRail nesta versão)
├── types/
│   ├── map.ts                # MapModel
│   ├── datalog.ts            # DatalogRow, DatalogModel, LogEntry
│   ├── engine.ts             # EngineInfo, JSONSchema
│   └── tuning.ts             # TuningConfig, TuningOutput, FilterStats, etc.
└── utils/
    ├── mapExporter.ts        # exportMapCsv, downloadCsv
    ├── deepEqual.ts          # deepEqual(a, b): boolean
    └── debounce.ts           # debounce genérico
```

## Stores (Zustand)

### `useMapStore`
Dono do mapa. Estado: `originalMap`, `editableMap`, `isDirty`, `history[]`, `future[]`.

| Ação | Efeito |
|------|--------|
| `loadMap(file)` | Parseia client-side, salva no IndexedDB, limpa output |
| `updateCell(r, c, v)` | Atualiza célula, empurra snapshot ao histórico |
| `bulkUpdateCells(changes)` | Batch de mudanças → **uma** entrada no histórico |
| `resetEditable()` | Restaura ao original, empurra ao histórico |
| `applyTuningOutput(map)` | Aplica mapa sugerido, empurra ao histórico |
| `undo()` / `redo()` | Navega no histórico (máx. 50 passos, session-only) |

### `useLogStore`
Dono dos logs. `addLog(file)` parseia client-side e salva no IndexedDB. O upload ao backend acontece apenas em `ensureLogsOnBackend()`, chamado por `tuningStore.runTuning()`.

### `useTuningStore`
Orquestra o auto-tuning. `runTuning()` valida pré-requisitos → `ensureLogsOnBackend()` → `apiRunTuning()` → `mapStore.applyTuningOutput()`.

## Convenções

### Parsing é sempre client-side
- `parseMapClient(file)` — lê `#I20` (RPM), `#I21` (MAP), `#F01`–`#F16` (células)
- `parseDatalogClient(file)` — lê CSV MasterInjection, converte raw→real, calcula hash SHA-1
- O backend **nunca** recebe o arquivo CSV do mapa

### Formato do mapa
- `cells[0]` = linha de **menor MAP** (ex.: 20 kPa)
- `cells[N-1]` = linha de **maior MAP**
- `HeatmapTable` exibe em ordem inversa (maior MAP no topo)
- Valores inteiros 100–9999 (VE% × 10)

### Conversões raw → real no parser de datalog
| Sinal | Conversão |
|-------|-----------|
| `lambda1`, `lambdaTarget`, `lambdaCorrecao` | `raw / 1000` |
| `clt` | `raw - 273` |
| `pedal` | `min(100, raw / 990 * 100)` |
| `lambdaLoop` | `raw` (0 ou 1) |

### Hash de arquivo
`computeHash(file)` em `api/client.ts` usa `crypto.subtle.digest('SHA-1')` e retorna `"sha1:<hex>"`. Esse hash é enviado no header `X-Content-Hash` no upload.

### Persistência
- **IndexedDB** (via `idb`): mapa original + editável (blob CSV), logs (blob CSV + model), último output de tuning
- **localStorage**: ordem dos logs (`mft:log-order`), config de tuning (`mft:config`), engine selecionado (`mft:engine-id`)
- `sessionRestorer.ts` restaura tudo na inicialização — **sem chamadas ao backend**. Logs são re-enviados ao backend na próxima execução de tuning.

### Dependências circulares entre stores
`mapStore` e `logStore` importam `tuningStore` via `import()` dinâmico dentro de métodos async. Não importar na raiz do módulo.

### `HeatmapTable` — atalhos Excel
Ver `../specs/features/tuning/ve.md#atalhos-de-teclado` para a lista completa.

Resumo dos props:
```tsx
<HeatmapTable
  cells={editableMap}           // (number | boolean | null)[][]
  rowHeaders={mapBreakpoints}   // MAP kPa — cells[0]=menor MAP
  colHeaders={rpmBreakpoints}   // RPM
  colorScale="warm"             // warm | diverging | confidence | coverage | convergence
  readOnly={false}
  onCellChange={updateCell}     // (row, col, value) → void — 1 entrada no histórico
  onBulkChange={bulkUpdateCells}// (changes[]) → void — 1 entrada no histórico p/ todo o batch
  modifiedCells={modifiedCells} // Set<"row:col"> — borda laranja nas células alteradas
  formatValue={v => String(v)}
/>
```

### Erros da API
`apiFetch` lança:
- `ApiError` — 4xx/5xx com `status` e `detail`
- `TimeoutError` — timeout de 120s (padrão)
- `NetworkError` — sem conexão

O frontend deve tratar `ApiError` com `status === 404` em `runTuning` re-enviando os logs (ver `fmtError` em `tuningStore.ts`).

## Invariantes — não violar

- **Stores são a fonte de verdade.** Componentes não mantêm cópias do mapa ou dos logs localmente.
- **`sessionRestorer` não faz chamadas ao backend.** Apenas lê IndexedDB e localStorage.
- **`onCellChange` vs `onBulkChange`:** usar `onCellChange` para edições individuais (1 passo de undo cada), `onBulkChange` para edições em batch (paste, F2, delete de range) para garantir um único passo de undo.
- **Histórico é session-only.** `history[]` e `future[]` não são persistidos no IndexedDB.
- **`VITE_API_URL` é build-time.** Não é configurável em runtime. Rebuildar a imagem Docker se mudar.
