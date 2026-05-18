# Arquitetura — Frontend

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + ECharts + Zustand + React Router v6

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
| **Componentes compartilhados** | |
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
│   ├── map.ts                  # uploadMap, exportMap
│   ├── datalog.ts              # uploadDatalog
│   ├── tuning.ts               # runTuning
│   └── engines.ts              # listEngines, getEngine
│
├── components/                 # Componentes compartilhados entre telas
│   ├── HeatmapTable/           # Tabela N×M com heatmap, editável ou somente leitura
│   ├── MapChart/               # Heatmap ECharts MAP×RPM / RPM×MAP
│   ├── TimeRail/               # Cursor de tempo + seleção de intervalo + sparkline
│   ├── SyncedChart/            # Gráficos de linha com cursor e zoom sincronizados
│   ├── TuningConfigModal/      # Modal de configuração dinâmico via JSON Schema
│   └── ui/                     # Wrappers de shadcn/ui (Button, Modal, Select, etc.)
│
├── store/                      # Zustand stores
│   ├── mapStore.ts             # mapa original, editável, isDirty
│   ├── logStore.ts             # lista de logs, enabled, ordem
│   ├── timeStore.ts            # cursor_ms, selection, sparklineSensor
│   ├── tuningStore.ts          # config, engine selecionado, lastOutput, isRunning
│   └── uiStore.ts              # estado visual (abas, colunas, layout de gráficos)
│
├── persistence/                # Persistência entre sessões do browser
│   ├── db.ts                   # IndexedDB setup (Dexie ou idb)
│   ├── mapPersistence.ts       # salvar/restaurar mapa + blob CSV
│   ├── logPersistence.ts       # salvar/restaurar logs + blobs CSV
│   └── sessionRestorer.ts      # orquestra restauração completa na inicialização
│
├── pages/
│   ├── HomePage.tsx            # Cards de acesso a Tuning e Datalog
│   ├── TuningPage.tsx          # Layout + abas VE / Ignition 🔒 / Lambda 🔒
│   └── DatalogPage.tsx         # Layout + TimeRail + abas Dashboard / Gráficos / Dados
│
├── features/                   # Lógica e subcomponentes específicos de cada tela
│   ├── tuning/
│   │   ├── ve/
│   │   │   ├── VETab.tsx
│   │   │   ├── OriginalMapSection.tsx    # Seção 1: mapa original colapsável
│   │   │   ├── EditableMapSection.tsx    # Seção 2: mapa editável + botões
│   │   │   ├── AnalysisSection.tsx       # Seção 3: heatmaps diagnósticos + warnings + filtros
│   │   │   └── MapChartsSection.tsx      # Seção 4: MAP×RPM e RPM×MAP
│   │   └── hooks/
│   │       └── useTuningRun.ts           # orquestra o auto-tuning + feedback de UI
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
│   └── datalogParser.ts        # parseDatalogClient(file): Promise<DatalogModel>
│                               # Parseia o CSV MasterInjection e converte raw→real
│                               # Usado em addLog() — o backend é acionado apenas pelo tuning
│
├── types/                      # Tipos TypeScript compartilhados (ver types.md)
│   ├── map.ts
│   ├── datalog.ts
│   ├── engine.ts
│   └── tuning.ts
│
├── hooks/                      # Hooks utilitários genéricos
│   ├── useFileUpload.ts        # drag-and-drop + seletor nativo
│   └── useLocalStorage.ts      # wrapper tipado para localStorage
│
├── App.tsx                     # Router raiz + layout (TopBar sempre visível)
└── main.tsx                    # sessionRestorer → ReactDOM.render
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
