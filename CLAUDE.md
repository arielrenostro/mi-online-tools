# Master Injection Online Tools

App web de auto-tuning de mapas de ECU MasterInjection: importa mapa + datalogs → analisa desvios de lambda → sugere correções no mapa VE.

## IMPORTANT — Specs e código andam juntos

**Sempre que alterar um trecho de código, atualize na MESMA mudança a(s) spec(s) correspondente(s) em `specs/` para refletir o novo comportamento.** Specs e código DEVEM permanecer sincronizados — uma spec desatualizada é um bug. Antes de mexer em qualquer código, **localize a spec relevante no índice abaixo e leia-a**; depois de mexer, verifique se a spec ainda descreve a realidade e edite-a se necessário.

## Índice de specs

Mapa "assunto / área de código → arquivo(s) de spec". Use-o para achar a spec certa antes de codar.

**Frontend:** todo o comportamento do navegador (telas, abas, componentes compartilhados,
navegação, persistência) vive como capabilities do OpenSpec em `openspec/specs/<capability>/spec.md`,
no formato Purpose + Requirements + Scenarios (`WHEN`/`THEN`). Rode `openspec list --specs` para o
índice ou `openspec show <capability> --type spec` para o conteúdo completo. Estrutura de pastas,
dependências e tipos TypeScript não são duplicados como spec — são deriváveis lendo o código.

### Frontend — capabilities (OpenSpec)

| Capability | Cobre |
|------|-------|
| `home` | Tela Home (`/`), cards de entrada |
| `map-import-export` | Parsing/exportação client-side do CSV de mapa; controle de mapa na TopBar |
| `datalog-import` | Parsing client-side do CSV de datalog; aba Logs; controle de logs na TopBar |
| `datalog-timeline` | TimeRail: cursor, seleção de intervalo, sparkline, múltiplos logs |
| `datalog-dashboard` | Aba Dashboard |
| `datalog-charts` | Aba Gráficos: painéis sincronizados, sidebar de sinais |
| `datalog-table` | Aba Dados: tabela, colunas, exportação CSV |
| `heatmap-editing` | Contrato compartilhado de edição de tabela N×M (seleção, atalhos, undo/redo) |
| `tuning-ve` | Aba VE: edição manual, trigger de auto-tuning, exibição do resultado |
| `tuning-ignition` | Aba Ignition (bloqueada na v1) |
| `tuning-lambda` | Aba Lambda (bloqueada na v1) |
| `tuning-config` | Modal de configuração do engine de tuning |
| `navigation-guards` | Rotas, guards (`RequireMap`/`RequireLog`), padrão de aba bloqueada |
| `session-persistence` | O que sobrevive a um reload, ordem de restauração, invalidação |

### Geral

| Spec | Cobre |
|------|-------|
| `specs/overview.md` | Visão geral do projeto, escopo da v1, roadmap, usuários-alvo |

### Motor de tuning (backend — regra não exposta ao frontend)

| Spec | Cobre |
|------|-------|
| `specs/features/tuning-engine.md` | Algoritmo de auto-tuning VE — pipeline de 12 etapas |
| `specs/features/tuning/research-insights.md` | Análise comparativa do algoritmo vs. indústria |

### Formatos MasterInjection (`*/parsers/`)

| Spec | Cobre |
|------|-------|
| `specs/master/datalog.md` | Formato CSV do datalog, colunas, conversões raw→real (usado pelo parser client-side e pelo parser do backend) |

### Arquitetura — geral

| Spec | Cobre |
|------|-------|
| `specs/architecture/architecture.md` | Ponteiro para os specs detalhados de arquitetura |
| `specs/architecture/overview.md` | Stack, modelo de sessão, fluxo de dados, fronteiras |

### Arquitetura — backend (`backend/`)

| Spec | Cobre |
|------|-------|
| `specs/architecture/backend/backend.md` | SOLID, engines plugáveis, API REST, session store |

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
