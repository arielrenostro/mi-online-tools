# Master Injection Online Tools

> Ferramenta web de auto-tuning para mapas de combustível da ECU **MasterInjection**.  
> Importa mapa + datalogs → analisa desvios de lambda → sugere correções precisas no mapa VE.

## O que faz

- **Importação client-side** — lê CSV MasterInjection (`#I20`/`#I21`/`#F01`–`#F16`) direto no browser, sem upload
- **Auto-tuning VE Lambda** — pipeline de 12 etapas: filtra pontos, snap a breakpoints, calcula desvio/célula, agrega com rejeição de outliers (±2σ), pondera confiança, interpola 2D vazios
- **Edição manual** — tabela interativa com atalhos Excel (range, F2 inline, Ctrl+C/V/Z/Y)
- **Diagnósticos** — heatmaps (VE Lambda, amostras, confiança, CV, correção, convergência), estatísticas de filtro, avisos de monotonicidade/gradiente
- **Multi-log** — carregamento e combinação de vários datalogs com toggle individual
- **Exportação** — download do mapa corrigido em CSV original da ECU
- **Persistência** — mapa, logs e resultado do tuning restaurados automaticamente

## Stack

```
Backend   → Python 3.12 · FastAPI · NumPy/SciPy · Pydantic
Frontend  → React 18 · TypeScript · Vite · Tailwind · Zustand · IndexedDB
Deploy    → Docker Compose · nginx
```

## Início rápido

### Com Docker (recomendado)

```bash
docker compose up --build
```

- Frontend: http://localhost
- Backend: http://localhost:8000

### Localmente

**Backend:**
```bash
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend** (outro terminal):
```bash
cd frontend && npm install && npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000 (padrão)

## Usar

1. **Importar mapa** → selecione CSV da MasterInjection
2. **Datalogs** → arraste ou selecione CSVs de log
3. **Auto-tuning** → clique em "Executar"
4. **Análise** → revise heatmaps de confiança/amostras/correção
5. **Ajustar** → edite células manualmente se necessário
6. **Exportar** → baixe CSV pronto para a ECU

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `MIOT_CACHE_DIR` | `/tmp/miot_datalogs` | Cache de datalogs (TTL 1h) |
| `VITE_API_URL` | `http://localhost:8000` | URL da API (build-time no frontend) |

## Documentação

| Tipo | Localização |
|------|-----------|
| **Backend** | [`backend/README.md`](backend/README.md) · [`backend/CLAUDE.md`](backend/CLAUDE.md) |
| **Frontend** | [`frontend/README.md`](frontend/README.md) · [`frontend/CLAUDE.md`](frontend/CLAUDE.md) |
| **Specs** | [`specs/`](specs/) (39 arquivos) · [`CLAUDE.md`](CLAUDE.md) |

## Estrutura

```
├── backend/          API FastAPI + pipeline VE Lambda
├── frontend/         App React + UI
├── specs/            39 arquivos de requisito/arquitetura
├── docker-compose.yml
└── README.md
```
