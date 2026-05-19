# Master Injection Online Tools

Aplicação web de auto-tuning de mapas de ECU MasterInjection. O usuário importa o mapa atual e datalogs de estrada; a aplicação analisa desvios de lambda e sugere correções no mapa de combustível (VE).

Specs completas em `specs/`. Leia `specs/overview.md` antes de qualquer coisa.

## Subprojetos

| Pasta | Stack | CLAUDE.md |
|-------|-------|-----------|
| `backend/` | Python 3.12 + FastAPI + NumPy/SciPy | [backend/CLAUDE.md](backend/CLAUDE.md) |
| `frontend/` | React 18 + TypeScript + Vite + Tailwind + Zustand | [frontend/CLAUDE.md](frontend/CLAUDE.md) |

## Rodar localmente

```bash
# Backend (porta 8000)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (porta 5173)
cd frontend
npm install
npm run dev
```

## Docker (produção)

```bash
docker compose up --build
# Backend: http://localhost:8000
# Frontend: http://localhost:80
```

Para apontar o frontend para uma URL de API diferente:
```bash
docker compose build --build-arg VITE_API_URL=https://api.exemplo.com frontend
```

## Variáveis de ambiente

| Variável | Padrão | Onde |
|----------|--------|------|
| `MIOT_CACHE_DIR` | `/tmp/mft_datalogs` | Backend — diretório de cache dos datalogs |
| `VITE_API_URL` | `http://localhost:8000` | Frontend — URL base da API (build-time) |

## Decisões arquiteturais importantes

- **O backend nunca armazena o mapa.** O mapa é enviado inline em cada `POST /api/tuning/run`. O frontend é o dono do mapa.
- **Datalogs são cacheados por SHA-1.** TTL de 1h; o frontend sobe o log apenas quando o tuning for executado (`ensureLogsOnBackend`), não no carregamento.
- **Parsing do mapa é client-side.** Apenas o frontend lê e escreve o CSV da MasterInjection. O backend nunca recebe o arquivo do mapa.
- **Parsing do datalog é também client-side** (browser), mas o backend reparseia ao receber o upload para construir o `DatalogModel` persistido em disco.

## Estrutura de specs

```
specs/
├── overview.md                    # Visão geral e escopo
├── master/
│   ├── map.md                     # Formato CSV da MasterInjection (#I20/#I21/#Fnn)
│   └── datalog.md                 # Formato CSV de datalog, colunas e conversões raw→real
├── features/
│   ├── tuning-engine.md           # Pipeline de 10 etapas, fórmulas, contratos
│   └── tuning/
│       ├── ve.md                  # Aba VE: layout, edição, atalhos de teclado
│       └── config.md              # Modal de configuração de tuning
└── architecture/
    ├── backend/backend.md         # API REST, engines, DiskStore, SOLID
    └── frontend/frontend.md       # Stores, persistência, componentes
```
