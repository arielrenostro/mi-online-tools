# Master Injection Online Tools

Ferramenta web de auto-tuning para mapas de combustível da ECU **MasterInjection**. Importa o mapa atual e datalogs de estrada, analisa os desvios de lambda célula a célula e sugere (ou aplica automaticamente) correções no mapa de VE — com visualização em heatmap, diagnósticos e exportação no formato original da ECU.

---

## Funcionalidades

- **Importação de mapa** — leitura do CSV MasterInjection (`#I20`/`#I21`/`#F01`–`#F16`) diretamente no browser, sem envio ao servidor
- **Auto-tuning VE Lambda** — pipeline de 10 etapas: filtragem de pontos, snap para breakpoints, cálculo por fórmula, agregação com rejeição de outliers (±2σ), fator de correção ponderado e interpolação 2D para células sem dados
- **Edição manual do mapa** — tabela interativa com atalhos Excel (seleção de range, edição inline, F2 para edição em massa, Ctrl+C/V, Ctrl+Z/Y)
- **Diagnósticos** — heatmaps de VE Lambda, amostras, confiança, CV, correção e convergência; estatísticas de filtragem; warnings de monotonicidade e gradiente
- **Múltiplos datalogs** — carregamento e combinação de vários logs com toggle individual
- **Exportação** — download do mapa corrigido no formato CSV original da ECU
- **Persistência de sessão** — mapa, logs e último resultado de tuning são restaurados automaticamente ao reabrir o browser

---

## Stack

| Camada | Tecnologias |
|--------|------------|
| Backend | Python 3.12 · FastAPI · Pydantic v2 · NumPy · SciPy |
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS · Zustand · idb |
| Infra | Docker · nginx |

---

## Pré-requisitos

- **Docker + Docker Compose** — para rodar tudo com um comando
- Ou: **Python 3.12+** e **Node.js 22+** para rodar localmente

---

## Rodar com Docker

```bash
docker compose up --build
```

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost |
| Backend | http://localhost:8000 |
| Health check | http://localhost:8000/health |

Para usar uma URL de API personalizada (ex.: deploy em servidor):

```bash
docker compose build --build-arg VITE_API_URL=https://api.exemplo.com frontend
docker compose up
```

---

## Rodar localmente

**Backend:**

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend** (em outro terminal):

```bash
cd frontend
npm install
npm run dev
```

O frontend abre em `http://localhost:5173` e aponta para o backend em `http://localhost:8000` por padrão.

---

## Como usar

1. **Importe o mapa** — clique em "Importar Mapa" e selecione o CSV exportado da MasterInjection
2. **Importe os datalogs** — clique em "Datalogs" e arraste os CSVs de log (ou clique para selecionar)
3. **Rode o auto-tuning** — clique em "Auto-tuning" no mapa editável
4. **Revise os diagnósticos** — veja a seção Análise para conferir amostras, confiança e correções por célula
5. **Ajuste manualmente** — edite células diretamente na tabela se necessário
6. **Exporte** — clique em "Exportar CSV" para baixar o mapa corrigido no formato da ECU

---

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `MIOT_CACHE_DIR` | `/tmp/mft_datalogs` | Diretório de cache dos datalogs no backend (TTL 1h) |
| `VITE_API_URL` | `http://localhost:8000` | URL base da API (definida em build-time no frontend) |

---

## Estrutura do repositório

```
mi-fuel-tuner/
├── backend/          # API FastAPI + pipeline de tuning
├── frontend/         # App React
├── specs/            # Documentação de requisitos e arquitetura
├── docker-compose.yml
└── README.md
```

Documentação técnica detalhada em cada subprojeto:
- [`backend/CLAUDE.md`](backend/CLAUDE.md) — convenções, endpoints, pipeline
- [`frontend/CLAUDE.md`](frontend/CLAUDE.md) — stores, componentes, persistência
- [`specs/overview.md`](specs/overview.md) — visão geral e escopo do produto
