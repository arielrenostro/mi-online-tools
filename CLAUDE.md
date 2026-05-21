# Master Injection Online Tools

App web de auto-tuning de mapas de ECU MasterInjection: importa mapa + datalogs → analisa desvios de lambda → sugere correções no mapa VE.

## IMPORTANT — Specs e código andam juntos

**Sempre que alterar um trecho de código, atualize na MESMA mudança a(s) spec(s) correspondente(s) em `specs/` para refletir o novo comportamento.** Specs e código DEVEM permanecer sincronizados — uma spec desatualizada é um bug. Antes de mexer em qualquer código, **localize a spec relevante no índice abaixo e leia-a**; depois de mexer, verifique se a spec ainda descreve a realidade e edite-a se necessário.

## Índice de specs

Mapa "assunto / área de código → arquivo(s) de spec". Use-o para achar a spec certa antes de codar.

### Geral e features

| Spec | Cobre |
|------|-------|
| `specs/overview.md` | Visão geral, escopo da v1, fluxo importar→analisar→exportar |
| `specs/features/overview.md` | Mapa de todas as telas, navegação, pré-requisitos e status v1 |
| `specs/features/home/home.md` | Tela Home (`/`), cards de entrada |
| `specs/features/topbar/topbar.md` | TopBar global: seções Mapa, Logs e Exportar |
| `specs/features/tuning-engine.md` | Algoritmo de auto-tuning VE — pipeline de 12 etapas |

### Tuning (`/tuning`, `frontend/src/features/tuning/`)

| Spec | Cobre |
|------|-------|
| `specs/features/tuning/overview.md` | Visão geral da tela de tuning, layout, abas |
| `specs/features/tuning/ve.md` | Aba VE (`#F01`–`#F16`), atalhos de teclado |
| `specs/features/tuning/ignition.md` | Aba Ignition (`#I01`–`#I16`) — prevista, bloqueada na v1 |
| `specs/features/tuning/lambda.md` | Aba Lambda (`#A01`–`#A16`) — prevista, bloqueada na v1 |
| `specs/features/tuning/config.md` | Modal de configurações do engine (campos, seções) |
| `specs/features/tuning/research-insights.md` | Análise comparativa do algoritmo vs. indústria |

### Datalog (`/datalog`, `frontend/src/features/datalog/`)

| Spec | Cobre |
|------|-------|
| `specs/features/datalog/overview.md` | Layout da tela Datalog, TimeRail, abas, guards |
| `specs/features/datalog/logs.md` | Aba Logs: upload, lista, ativação |
| `specs/features/datalog/dashboard.md` | Aba Dashboard: cards de sinais no instante do cursor |
| `specs/features/datalog/charts.md` | Aba Gráficos: painéis configuráveis de `SyncedChart` |
| `specs/features/datalog/data.md` | Aba Dados: tabela de linhas do datalog |

### Formatos MasterInjection (`*/parsers/`)

| Spec | Cobre |
|------|-------|
| `specs/master/map.md` | Formato CSV do mapa (`#Xnn`, `#I20`/`#I21`/`#Fnn`), parsing/export |
| `specs/master/datalog.md` | Formato CSV do datalog, colunas, conversões raw→real |

### Arquitetura — geral

| Spec | Cobre |
|------|-------|
| `specs/architecture/architecture.md` | Ponteiro para os specs detalhados de arquitetura |
| `specs/architecture/overview.md` | Stack, modelo de sessão, fluxo de dados, fronteiras |

### Arquitetura — backend (`backend/`)

| Spec | Cobre |
|------|-------|
| `specs/architecture/backend/backend.md` | SOLID, engines plugáveis, API REST, session store |

### Arquitetura — frontend (`frontend/`)

| Spec | Cobre |
|------|-------|
| `specs/architecture/frontend/frontend.md` | Índice da arquitetura frontend (rotas, stores, componentes) |
| `specs/architecture/frontend/api-client.md` | Camada `src/api/` — HTTP, serialização, erros |
| `specs/architecture/frontend/persistence.md` | IndexedDB + localStorage, restauração de sessão |
| `specs/architecture/frontend/routes.md` | React Router v6, guards, navegação, comportamento no F5 |
| `specs/architecture/frontend/types.md` | Tipos TypeScript compartilhados (`src/types/`) |

### Arquitetura — stores Zustand (`frontend/src/store/`)

| Spec | Cobre |
|------|-------|
| `specs/architecture/frontend/stores/map-store.md` | `useMapStore` — ciclo de vida do mapa, edição, undo |
| `specs/architecture/frontend/stores/log-store.md` | `useLogStore` — upload, remoção, reordenação de logs |
| `specs/architecture/frontend/stores/tuning-store.md` | `useTuningStore` — config, engine, execução, output |
| `specs/architecture/frontend/stores/time-store.md` | `useTimeStore` — cursor, seleção, sparkline, zoom |
| `specs/architecture/frontend/stores/ui-store.md` | `useUIStore` — layout de gráficos, colunas, aba ativa |

### Arquitetura — componentes (`frontend/src/components/`)

| Spec | Cobre |
|------|-------|
| `specs/architecture/frontend/components/heatmap-table.md` | `HeatmapTable` — tabela N×M, edição, seleção, teclado |
| `specs/architecture/frontend/components/map-chart.md` | `MapChart` e `MapWithChart` — gráficos 2D/3D do mapa |
| `specs/architecture/frontend/components/synced-chart.md` | `SyncedChart` — gráficos de linha sincronizados |
| `specs/architecture/frontend/components/time-rail.md` | `TimeRail` — barra de tempo, cursor, sparkline |
| `specs/architecture/frontend/components/top-bar.md` | `TopBar` — barra de navegação global |
| `specs/architecture/frontend/components/guards.md` | Guards de rota (mapa carregado, logs ativos) |
| `specs/architecture/frontend/components/tuning-config-modal.md` | `TuningConfigModal` — formulário dinâmico do schema |
| `specs/architecture/frontend/components/tuning-tab-link.md` | `TuningTabLink` — aba de navegação do tuning |

## Subprojetos

| Pasta | Stack | Docs |
|-------|-------|------|
| `backend/` | Python 3.12 + FastAPI + NumPy/SciPy | [backend/CLAUDE.md](backend/CLAUDE.md) |
| `frontend/` | React 18 + TypeScript + Vite + Tailwind + Zustand | [frontend/CLAUDE.md](frontend/CLAUDE.md) |

```bash
# Backend (8000)
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
# Frontend (5173)
cd frontend && npm install && npm run dev
```

## Variáveis de ambiente

| Variável | Padrão | Onde |
|----------|--------|------|
| `MIOT_CACHE_DIR` | `/tmp/miot_datalogs` | Backend — cache de datalogs |
| `VITE_API_URL` | `http://localhost:8000` | Frontend — **build-time** |

## Decisões arquiteturais

- **Backend nunca armazena o mapa.** Enviado inline em `POST /api/tuning/run`. Frontend é o dono.
- **Datalogs cacheados por SHA-1** (TTL 1h). Upload ocorre em `ensureLogsOnBackend()`, não no carregamento.
- **Parsing é sempre client-side.** `parseMapClient` e `parseDatalogClient` rodam no browser. Backend reparseia o datalog ao receber o upload para construir o `DatalogModel`.
