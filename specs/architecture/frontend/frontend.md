# Arquitetura — Frontend

**Stack:** React 18 + TypeScript + Vite + Tailwind + ECharts + Zustand + React Router v6

## Specs detalhadas

| Tópico | Arquivo |
|--------|---------|
| Roteamento e guards | [routes.md](routes.md) |
| Persistência (IndexedDB + localStorage) | [persistence.md](persistence.md) |
| API Client | [api-client.md](api-client.md) |
| Tipos TypeScript compartilhados | [types.md](types.md) |
| Stores | `useMapStore` [↗](stores/map-store.md) · `useLogStore` [↗](stores/log-store.md) · `useTimeStore` [↗](stores/time-store.md) · `useTuningStore` [↗](stores/tuning-store.md) · `useUIStore` [↗](stores/ui-store.md) · `useSessionStore` (ver [guards.md](components/guards.md)) |
| Componentes | `TopBar` [↗](components/top-bar.md) · `TuningTabLink` [↗](components/tuning-tab-link.md) · Guards [↗](components/guards.md) · `HeatmapTable` [↗](components/heatmap-table.md) · `MapChart` [↗](components/map-chart.md) · `TimeRail` [↗](components/time-rail.md) · `SyncedChart` [↗](components/synced-chart.md) · `TuningConfigModal` [↗](components/tuning-config-modal.md) |

## Estrutura de pastas

```
frontend/src/
├── api/                    # Comunicação com o backend
│   ├── client.ts           # fetch base, erros, timeout
│   ├── datalog.ts          # uploadDatalog
│   ├── tuning.ts           # runTuning
│   └── engines.ts          # listEngines, getEngine
│
├── components/             # Componentes compartilhados
│   ├── TopBar.tsx          # Barra superior global (Home / Tuning / Datalog)
│   ├── TuningTabLink.tsx   # Aba com suporte a estado bloqueado
│   ├── guards/             # RequireMap, RequireLog, SessionRestoringSpinner
│   ├── HeatmapTable/       # Tabela N×M com heatmap, editável ou read-only
│   ├── MapChart/           # Heatmap ECharts MAP×RPM / RPM×MAP
│   ├── TimeRail/           # Cursor de tempo + seleção + sparkline
│   ├── SyncedChart/        # Gráficos de linha com cursor/zoom sincronizados
│   ├── TuningConfigModal/  # Modal de config via JSON Schema
│   └── ui/                 # Wrappers shadcn/ui
│
├── store/                  # Zustand stores
│   ├── mapStore.ts         # mapa original + editável; histórico/undo por mapa
│   ├── logStore.ts         # lista de logs, enabled, ordem
│   ├── timeStore.ts        # cursor_ms, selection, sparklineSensor
│   ├── tuningStore.ts      # config, engine, lastOutput, isRunning
│   ├── sessionStore.ts     # isRestoring — controla guards no restore
│   └── uiStore.ts          # estado visual (abas, colunas, layout)
│
├── persistence/            # Persistência entre sessões
│   ├── db.ts               # IndexedDB setup (idb)
│   ├── mapPersistence.ts   # mapa + blob CSV
│   ├── logPersistence.ts   # logs + blobs CSV
│   ├── tuningPersistence.ts # último TuningOutput
│   └── sessionRestorer.ts  # orquestra restauração
│
├── pages/
│   ├── RootLayout.tsx      # TopBar + <Outlet>
│   ├── HomePage.tsx        # Cards de acesso
│   ├── TuningPage.tsx      # Abas VE/Ignition/Lambda + import/export + Ctrl+Z route-aware
│   └── DatalogPage.tsx     # TimeRail + abas Dashboard/Gráficos/Dados
│
├── features/               # Lógica específica de cada tela
│   ├── tuning/
│   │   ├── ve/VETab.tsx                # mapa original + editável + análise + auto-tuning
│   │   ├── ignition/IgnitionTab.tsx    # mapa original + editável (sem auto-tuning)
│   │   ├── lambda/LambdaTab.tsx        # mapa original + editável; escala ÷1000
│   │   ├── OriginalMapSection.tsx      # mapa original colapsável (read-only)
│   │   ├── EditableMapSection.tsx      # mapa editável + Resetar; auto-tuning opcional
│   │   ├── AnalysisSection.tsx         # heatmaps + warnings + filtros (VE only)
│   │   ├── AutoTuningModal.tsx         # wizard de auto-tuning (seleção de logs + upload)
│   │   ├── BulkEditModal.tsx           # modal F2: edição em massa
│   │   └── TuningConfigModal.tsx       # modal de config via JSON Schema
│   └── datalog/
│       ├── dashboard/DashboardTab.tsx
│       ├── charts/{ChartsTab.tsx, useChartLayout.ts}
│       └── data/DataTab.tsx            # tabela virtualizada
│
├── parsers/                # Parsers client-side (sem backend)
│   ├── datalogParser.ts    # parseDatalogClient(file): Promise<DatalogModel>
│   └── mapParser.ts        # parseMapClient(file): Promise<MapModel>
│
├── types/                  # Tipos compartilhados (ver types.md)
│   └── {map, datalog, engine, tuning}.ts
│
├── utils/
│   ├── mapExporter.ts      # exportMapCsv(rawLines, veCells, ignCells?, lambdaCells?): string
│   ├── deepEqual.ts        # comparação de matrizes 2D
│   └── debounce.ts
│
├── App.tsx                 # createBrowserRouter — rotas e guards
└── main.tsx                # render imediato + restoreSession() em paralelo
```

## Dependências principais

| Pacote | Versão mín. | Uso |
|--------|-------------|-----|
| `react` | 18 | Framework |
| `typescript` | 5 | Tipagem |
| `vite` | 5 | Build/dev server |
| `tailwindcss` | 3 | Estilo |
| `@radix-ui/*` / `shadcn/ui` | latest | Componentes acessíveis |
| `echarts` + `echarts-for-react` | 5 | Gráficos e heatmaps |
| `zustand` | 4 | Estado global |
| `react-router-dom` | 6 | Roteamento |
| `dexie` | 3 | IndexedDB tipado |
| `@dnd-kit/core` | latest | Drag-and-drop (reordenar logs) |
| `react-window` | 1 | Virtualização da tabela de Dados |

## Princípios de design

- **Stores são a fonte de verdade** — componentes leem do store
- **Persistência transparente** — estado persiste automaticamente, sem "salvar manual"
- **Componentes compartilhados genéricos** — `HeatmapTable` recebe tudo via props
- **API client sem estado** — funções puras (input → Promise<output>); loading/error é do store
- **Sem navegação automática** — o app nunca muda de rota sem ação do usuário
