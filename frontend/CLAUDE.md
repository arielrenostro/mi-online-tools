# Frontend — Master Injection Online Tools

**Stack:** React 18 · TypeScript 5 · Vite 5 · Tailwind CSS 3 · Zustand 4 · idb 8  
**Specs:** `../specs/architecture/frontend/frontend.md` · Atalhos VE: `../specs/features/tuning/ve.md`

```bash
npm run dev    # http://localhost:5173
npm run build
```

`VITE_API_URL` é **build-time** (não runtime). Default: `http://localhost:8000`.

## Estrutura

```
src/
├── api/          client.ts · datalog.ts · engines.ts · tuning.ts
├── components/   HeatmapTable.tsx · SyncedChart.tsx · TimeRail.tsx
├── features/     tuning/ · datalog/
├── pages/        TuningPage.tsx · DatalogPage.tsx
├── parsers/      mapParser.ts · datalogParser.ts
├── persistence/  db.ts · *Persistence.ts · localStorage.ts · sessionRestorer.ts
├── signals/      signalRegistry.ts   ← definições de sinais (nome, convert, format, min/max)
├── store/        mapStore · logStore · tuningStore · timeStore · uiStore
└── types/        map · datalog · engine · tuning · ui
```

## Stores

- **`useMapStore`** — dono do mapa. `updateCell` = 1 undo; `bulkUpdateCells` = 1 undo para o batch inteiro. Histórico session-only, não persiste em IndexedDB.
- **`useLogStore`** — dono dos logs. Upload ao backend só em `ensureLogsOnBackend()` (chamado por `runTuning()`).
- **`useTuningStore`** — `runTuning()`: valida → `ensureLogsOnBackend()` → `apiRunTuning()` → `applyTuningOutput()`.
- **`useTimeStore`** — cursor_ms, selection, sparklineSensor, chartZoom. Persiste em `miot:time`.
- **`useUIStore`** — chartLayout (árvore de painéis), columnVisibility, chartsHeight, datalogTab. Persiste em `miot:ui`.

## Convenções críticas

**Imports circulares:** `mapStore` e `logStore` importam `tuningStore` via `import()` dinâmico dentro de métodos async. Não importar na raiz do módulo.

**Parsing client-side:** `parseMapClient` lê `#I20` (RPM), `#I21` (MAP), `#F01–#F16`. `parseDatalogClient` converte raw→real e calcula SHA-1. Backend **nunca** recebe CSV do mapa.

**Conversões raw→real** (definidas em `signalRegistry.ts`):

| Sinal | Conversão |
|-------|-----------|
| Lambda 1, Lambda Target | `raw / 1000` |
| Lambda Corr | `(raw - 1000) / 10` (%) |
| CLT, IAT | `raw - 273` |
| Pedal | `min(100, raw / 990 * 100)` |
| Lambda Loop | `raw` (0=OL, 1=CL) |

**Persistência:**
- IndexedDB: mapa (blob + model), logs (blob + model), tuning output
- localStorage: `miot:log-order` · `miot:config` · `miot:engine-id` · `miot:ui` · `miot:time`
- `sessionRestorer.ts` restaura tudo na inicialização sem chamar o backend

**Hash:** `computeHash(file)` → `"sha1:<hex>"` (header `X-Content-Hash` no upload)

**ApiError 404 em `runTuning`:** log sumiu do cache do backend — re-enviar os logs.

**HeatmapTable:** `cells[0]` = menor MAP; exibido invertido (maior no topo). Valores inteiros 100–9999 (VE% × 10). `onCellChange` = 1 undo; `onBulkChange` = 1 undo para o batch.

## Invariantes

- Stores são a fonte de verdade — componentes não mantêm cópias locais.
- `sessionRestorer` não faz chamadas ao backend.
- `VITE_API_URL` é build-time — rebuildar a imagem Docker se mudar.
