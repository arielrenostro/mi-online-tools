# Master Injection Online Tools

App web de auto-tuning de mapas de ECU MasterInjection: importa mapa + datalogs → analisa desvios de lambda → sugere correções no mapa VE.

Sempre busque pelas specs dos assuntos relacionados. As specs estão organizadas conforme listado abaixo.

## Specs

```
specs/
├── overview.md                 # Visão geral e escopo
├── master/map.md               # Formato CSV (#I20/#I21/#Fnn)
├── master/datalog.md           # Colunas, conversões raw→real
├── features/tuning-engine.md   # Pipeline 10 etapas
├── features/tuning/ve.md       # Aba VE, atalhos de teclado
├── features/datalog/           # Tela Datalog (overview + abas)
└── architecture/frontend/      # Stores, persistência, componentes
```

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
