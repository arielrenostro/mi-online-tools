# Arquitetura — Frontend

**Stack:** React 18 + TypeScript + Vite + Tailwind + ECharts + Zustand + React Router v6

## Specs detalhadas

| Tópico | Arquivo |
|--------|---------|
| Roteamento e guards | [routes.md](routes.md) · [components/guards.md](components/guards.md) |
| Persistência (IndexedDB + localStorage) | [persistence.md](persistence.md) |
| API Client | [api-client.md](api-client.md) |
| Tipos TypeScript compartilhados | [types.md](types.md) |
| Stores | `useMapStore` [↗](stores/map-store.md) · `useLogStore` [↗](stores/log-store.md) · `useTimeStore` [↗](stores/time-store.md) · `useTuningStore` [↗](stores/tuning-store.md) · `useUIStore` [↗](stores/ui-store.md) · `useSessionStore` (em [guards.md](components/guards.md)) |
| Componentes | `TopBar` [↗](components/top-bar.md) · `TuningTabLink` [↗](components/tuning-tab-link.md) · `HeatmapTable` [↗](components/heatmap-table.md) · `MapChart`/`MapWithChart` [↗](components/map-chart.md) · `TimeRail` [↗](components/time-rail.md) · `SyncedChart` [↗](components/synced-chart.md) · `TuningConfigModal` [↗](components/tuning-config-modal.md) |

## Organização de pastas

```
frontend/src/
├── api/          # client.ts (fetch base, erros), datalog.ts, engines.ts, tuning.ts
├── components/   # TopBar, TuningTabLink, guards/, HeatmapTable/, MapChart/,
│                 # MapWithChart/, SyncedChart.tsx, TimeRail.tsx, TuningConfigModal/, ui/
├── store/        # mapStore, logStore, timeStore, tuningStore, sessionStore, uiStore
├── persistence/  # db.ts (IndexedDB), {map,log,tuning}Persistence.ts, localStorage.ts, sessionRestorer.ts
├── pages/        # RootLayout, HomePage, TuningPage, DatalogPage
├── features/     # tuning/{ve,ignition,lambda} + seções · datalog/{dashboard,charts,data} + LogsTab
├── parsers/      # parseDatalogClient, parseMapClient (client-side, sem backend)
├── types/        # tipos compartilhados (ver types.md)
├── utils/        # mapExporter, deepEqual, debounce
├── App.tsx       # createBrowserRouter — rotas e guards
└── main.tsx      # render imediato + restoreSession() em paralelo
```

## Dependências principais

| Pacote | Versão mín. | Uso |
|--------|-------------|-----|
| `react` / `typescript` / `vite` | 18 / 5 / 5 | Framework, tipagem, build |
| `tailwindcss` + `@radix-ui` / `shadcn/ui` | 3 / latest | Estilo e componentes acessíveis |
| `echarts` + `echarts-for-react` (+ `echarts-gl`) | 5 | Gráficos, heatmaps, superfície 3D |
| `zustand` | 4 | Estado global |
| `react-router-dom` | 6 | Roteamento |
| `idb` | 3 | IndexedDB tipado |
| `@dnd-kit/core` | latest | Drag-and-drop (reordenar logs) |
| `react-window` | 1 | Virtualização da tabela de Dados |

## Princípios de design

- **Stores são a fonte de verdade** — componentes leem do store; o backend é stateless entre requisições.
- **Persistência transparente** — o estado persiste automaticamente, sem "salvar manual".
- **Componentes compartilhados genéricos** — `HeatmapTable` recebe tudo via props.
- **API client sem estado** — funções puras (input → `Promise<output>`); loading/error é dos stores.
- **Sem navegação automática** — o app nunca muda de rota sem ação do usuário.
- **Parsing client-side** — `parseMapClient`/`parseDatalogClient` rodam no browser.
