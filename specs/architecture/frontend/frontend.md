# Arquitetura — Frontend

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + ECharts + Zustand + React Router v6

---

## Specs detalhadas

| Tópico | Arquivo |
|--------|---------|
| Roteamento e guards | [routes.md](routes.md) |
| Persistência (IndexedDB + localStorage) | [persistence.md](persistence.md) |
| API Client (módulos de comunicação) | [api-client.md](api-client.md) |
| Tipos TypeScript compartilhados | [types.md](types.md) |
| **Stores** | |
| `useMapStore` | [stores/map-store.md](stores/map-store.md) |
| `useLogStore` | [stores/log-store.md](stores/log-store.md) |
| `useTimeStore` | [stores/time-store.md](stores/time-store.md) |
| `useTuningStore` | [stores/tuning-store.md](stores/tuning-store.md) |
| `useUIStore` | [stores/ui-store.md](stores/ui-store.md) |
| `useSessionStore` | estado de restauração de sessão — ver [components/guards.md](components/guards.md) |
| **Componentes compartilhados** | |
| `TopBar` | [components/top-bar.md](components/top-bar.md) |
| `TuningTabLink` | [components/tuning-tab-link.md](components/tuning-tab-link.md) |
| Guards (`RequireMap`, `RequireLog`, `SessionRestoringSpinner`) | [components/guards.md](components/guards.md) |
| `HeatmapTable` | [components/heatmap-table.md](components/heatmap-table.md) |
| `MapChart` | [components/map-chart.md](components/map-chart.md) |
| `TimeRail` | [components/time-rail.md](components/time-rail.md) |
| `SyncedChart` | [components/synced-chart.md](components/synced-chart.md) |
| `TuningConfigModal` | [components/tuning-config-modal.md](components/tuning-config-modal.md) |

---

## Estrutura de pastas

```
frontend/src/
├── api/                        # Camada de comunicação com o backend
│   ├── client.ts               # fetch base, tratamento de erros, timeout
│   ├── datalog.ts              # uploadDatalog
│   ├── tuning.ts               # runTuning
│   └── engines.ts              # listEngines, getEngine
│
├── components/                 # Componentes compartilhados entre telas
│   ├── TopBar.tsx              # Barra superior global com navegação (Home / Tuning / Datalog)
│   ├── TuningTabLink.tsx       # Aba de navegação com suporte a estado bloqueado
│   ├── guards/
│   │   ├── RequireMap.tsx      # Guard: se sem mapa, exibe tela de upload inline (não redireciona)
│   │   ├── RequireLog.tsx      # Guard: exige ao menos 1 log ativo
│   │   └── SessionRestoringSpinner.tsx  # Spinner exibido durante restauração
│   ├── HeatmapTable/           # Tabela N×M com heatmap, editável ou somente leitura
│   ├── MapChart/               # Heatmap ECharts MAP×RPM / RPM×MAP
│   ├── TimeRail/               # Cursor de tempo + seleção de intervalo + sparkline
│   ├── SyncedChart/            # Gráficos de linha com cursor e zoom sincronizados
│   ├── TuningConfigModal/      # Modal de configuração dinâmico via JSON Schema
│   └── ui/                     # Wrappers de shadcn/ui (Button, Modal, Select, etc.)
│
├── store/                      # Zustand stores
│   ├── mapStore.ts             # mapa original + editável (VE, ignição, lambda); histórico e undo/redo por mapa
│   ├── logStore.ts             # lista de logs, enabled, ordem
│   ├── timeStore.ts            # cursor_ms, selection, sparklineSensor
│   ├── tuningStore.ts          # config, engine selecionado, lastOutput, isRunning
│   ├── sessionStore.ts         # isRestoring — controla guards durante restore inicial
│   └── uiStore.ts              # estado visual (abas, colunas, layout de gráficos)
│
├── persistence/                # Persistência entre sessões do browser
│   ├── db.ts                   # IndexedDB setup (idb)
│   ├── mapPersistence.ts       # salvar/restaurar mapa + blob CSV
│   ├── logPersistence.ts       # salvar/restaurar logs + blobs CSV
│   ├── tuningPersistence.ts    # salvar/restaurar último TuningOutput
│   └── sessionRestorer.ts      # orquestra restauração; chama sessionStore.setRestoringDone()
│
├── pages/
│   ├── RootLayout.tsx          # TopBar + <Outlet> — layout raiz do router
│   ├── HomePage.tsx            # Cards de acesso a Tuning e Datalog
│   ├── TuningPage.tsx          # Abas VE / Ignition / Lambda + menu importar/exportar + Ctrl+Z route-aware
│   └── DatalogPage.tsx         # TimeRail + abas Dashboard / Gráficos / Dados
│
├── features/                   # Lógica e subcomponentes específicos de cada tela
│   ├── tuning/
│   │   ├── ve/
│   │   │   └── VETab.tsx                 # Aba VE: mapa original + editável + análise + auto-tuning
│   │   ├── ignition/
│   │   │   └── IgnitionTab.tsx           # Aba Ignition: mapa original + editável (sem auto-tuning)
│   │   ├── lambda/
│   │   │   └── LambdaTab.tsx             # Aba Lambda: mapa original + editável; escala ÷1000 para exibição
│   │   ├── OriginalMapSection.tsx        # Mapa original colapsável (somente leitura) — props-based
│   │   ├── EditableMapSection.tsx        # Mapa editável + botão Resetar — props-based; auto-tuning opcional
│   │   ├── AnalysisSection.tsx           # Heatmaps diagnósticos + warnings + filtros (VE only)
│   │   ├── AutoTuningModal.tsx           # Modal wizard de auto-tuning (seleção de logs + upload inline)
│   │   ├── BulkEditModal.tsx             # Modal F2: edição em massa — percentual, acrescentar, definir valor
│   │   └── TuningConfigModal.tsx         # Modal de configuração via JSON Schema
│   └── datalog/
│       ├── dashboard/
│       │   └── DashboardTab.tsx
│       ├── charts/
│       │   ├── ChartsTab.tsx             # renderiza ChartLayout → SyncedChart panels
│       │   └── useChartLayout.ts
│       └── data/
│           └── DataTab.tsx               # tabela virtualizada de dados brutos
│
├── parsers/                    # Parsers client-side (sem dependência de backend)
│   ├── datalogParser.ts        # parseDatalogClient(file): Promise<DatalogModel>
│   └── mapParser.ts            # parseMapClient(file): Promise<MapModel>
│
├── types/                      # Tipos TypeScript compartilhados (ver types.md)
│   ├── map.ts
│   ├── datalog.ts
│   ├── engine.ts
│   └── tuning.ts
│
├── utils/                      # Utilitários puros (sem estado, sem React)
│   ├── mapExporter.ts          # exportMapCsv(rawLines, veCells, ignCells?, lambdaCells?): string
│   ├── deepEqual.ts            # deepEqual(a, b): boolean — comparação de matrizes 2D
│   └── debounce.ts             # debounce genérico
│
├── App.tsx                     # createBrowserRouter — define todas as rotas e guards
└── main.tsx                    # render imediato + restoreSession() em paralelo
```

---

## Dependências principais

| Pacote | Versão mínima | Uso |
|--------|--------------|-----|
| `react` | 18 | Framework |
| `typescript` | 5 | Tipagem |
| `vite` | 5 | Build e dev server |
| `tailwindcss` | 3 | Estilo utilitário |
| `@radix-ui/*` / `shadcn/ui` | latest | Componentes acessíveis |
| `echarts` + `echarts-for-react` | 5 | Gráficos e heatmaps |
| `zustand` | 4 | Estado global |
| `react-router-dom` | 6 | Roteamento |
| `dexie` | 3 | IndexedDB com TypeScript |
| `@dnd-kit/core` | latest | Drag-and-drop (reordenação de logs) |
| `react-window` | 1 | Virtualização da tabela de Dados |

---

## Princípios de design

- **Stores são a fonte de verdade** — componentes leem do store, não mantêm estado crítico localmente
- **Persistência é transparente** — o usuário nunca precisa "salvar manualmente"; o estado persiste automaticamente
- **Componentes compartilhados são genéricos** — `HeatmapTable` não sabe se está exibindo o mapa original, o editável ou dados de confiança; recebe tudo via props
- **API client não tem estado** — cada função é pura (input → Promise<output>); loading/error é responsabilidade do store
- **Sem navegação automática** — o app nunca muda de rota sem ação explícita do usuário
