# Frontend — Master Injection Online Tools

**Stack:** React 18 · TypeScript 5 · Vite 5 · Tailwind CSS 3 · Zustand 4 · idb 8

## Specs do frontend

Todo o comportamento do frontend vive como capabilities do OpenSpec em
`../openspec/specs/<capability>/spec.md` (Purpose + Requirements + Scenarios). Rode
`openspec list --specs` na raiz do repo para o índice, ou `openspec show <capability> --type spec`
para o conteúdo completo. Veja também o índice geral no `CLAUDE.md` da raiz.

| Capability | Cobre |
|------|-------|
| `home` | Tela Home (`/`), cards de entrada |
| `map-import-export` | Parsing/exportação client-side do CSV de mapa; controle na TopBar |
| `datalog-import` | Parsing client-side do CSV de datalog; aba Logs; controle na TopBar |
| `datalog-timeline` | TimeRail: cursor, seleção de intervalo, sparkline, múltiplos logs |
| `datalog-dashboard` | Aba Dashboard |
| `datalog-charts` | Aba Gráficos: painéis sincronizados, sidebar de sinais |
| `datalog-table` | Aba Dados: tabela, colunas, exportação CSV |
| `heatmap-editing` | Edição de tabela N×M (seleção, atalhos de teclado, undo/redo) — usada por VE/Ignition/Lambda |
| `tuning-ve` | Aba VE: edição manual, trigger de auto-tuning, exibição do resultado |
| `tuning-ignition` | Aba Ignition (bloqueada na v1) |
| `tuning-lambda` | Aba Lambda (bloqueada na v1) |
| `tuning-config` | Modal de configuração do engine de tuning |
| `navigation-guards` | Rotas, guards (`RequireMap`/`RequireLog`), padrão de aba bloqueada |
| `session-persistence` | O que sobrevive a um reload, ordem de restauração, invalidação |

`../specs/master/datalog.md` documenta o formato CSV do datalog (compartilhado com o parser do
backend). O formato do mapa CSV é coberto pela capability `map-import-export` acima — o backend
nunca o parseia.

**IMPORTANT — specs e código andam juntos:** sempre que alterar o código, atualize na mesma mudança a(s) spec(s) correspondente(s) em `specs/`. Specs e código DEVEM permanecer sincronizados.

```bash
npm run dev    # http://localhost:5173
npm run build
npm run test   # vitest run — unit tests
```

## Testar

Vitest, ambiente `node` (stores/utils são lógica pura — nada de DOM). Testes ficam colocados junto
ao arquivo testado (`mapStore.test.ts` ao lado de `mapStore.ts`), não em uma pasta `tests/`
separada. Módulos com efeito colateral (ex: `persistence/*`, que fala com IndexedDB) são mockados
com `vi.mock` nos testes de store, para o teste continuar puro e determinístico.

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

**Ordem das linhas do mapa:** convenção interna do frontend é **descendente** por MAP — `cells[0]`/`mapBreakpoints[0]` = **maior** MAP, batendo 1:1 com a exibição (`HeatmapTable` renderiza literal, sem inversão). O backend e o arquivo CSV exigem ascendente (`cells[0]` = menor MAP); a conversão acontece só em dois pontos de fronteira: `mapParser.ts`/`mapExporter.ts` (parse/export do CSV) e `tuningStore.ts` via `utils/mapRowOrder.ts` (request/response de `/api/tuning/run`). Não introduzir mais nenhum ponto de inversão — se precisar mexer em ordem de linha, é nesses arquivos.

**HeatmapTable:** valores inteiros 100–9999 (VE% × 10). `onCellChange` = 1 undo; `onBulkChange` = 1 undo para o batch.

## Invariantes

- Stores são a fonte de verdade — componentes não mantêm cópias locais.
- `sessionRestorer` não faz chamadas ao backend.
- `VITE_API_URL` é build-time — rebuildar a imagem Docker se mudar.
