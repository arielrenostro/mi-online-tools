# Arquitetura — Visão Geral

Specs detalhadas por camada:
- [Frontend](frontend/frontend.md)
- [Backend](backend/backend.md)

---

## Stack tecnológico

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Frontend | React 18 + TypeScript + Vite | Ecossistema maduro, tipagem forte, build rápido |
| Estilo | Tailwind CSS + shadcn/ui | Produtividade alta, componentes acessíveis |
| Gráficos | ECharts (via echarts-for-react) | Heatmap nativo, zoom, seleção de intervalo, tooltip sincronizado |
| Estado global | Zustand | Leve, sem boilerplate, fatias independentes por domínio |
| Roteamento | React Router v6 | Rotas declarativas, suporte a rotas aninhadas e guards |
| Backend | Python 3.12 + FastAPI | Async nativo, tipagem via Pydantic, ecossistema científico (numpy, scipy) |
| Serialização | Pydantic v2 | Validação automática, serialização JSON, modelos como contratos |
| Comunicação | REST JSON (HTTP) | Simples, sem necessidade de WebSocket na v1 |
| Armazenamento | Em memória (sessão) | Sem banco de dados; arquivos são carregados e descartados por sessão |

---

## Modelo de sessão

O backend é **stateless** entre requisições — não há banco de dados, cookies de sessão nem autenticação. O estado da sessão vive em memória no processo do servidor e é identificado por UUIDs gerados no upload.

```
Frontend                              Backend (processo)
──────────────────────────────────    ──────────────────────────────────
useMapStore { mapId }           →     MapStore { id → MapModel }
useLogStore { logs[].logId }    →     DatalogStore { id → DatalogModel }
```

Implicações:
- Reiniciar o servidor apaga todos os uploads — o usuário precisa reimportar
- Não há multiusuário nem autenticação na v1
- O frontend é a fonte de verdade sobre o estado visual (edições manuais, config de tuning, layout de gráficos)

---

## Diagrama de comunicação

```
┌──────────────────────────────────────────────────────────────┐
│  BROWSER (React + TypeScript)                                │
│                                                               │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ MapStore│  │ LogStore │  │TimeStore │  │TuningStore  │  │
│  └────┬────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │
│       │            │              │                 │         │
│  ┌────▼────────────▼──────────────▼─────────────────▼──────┐ │
│  │                   API Client (fetch + types)             │ │
│  └────────────────────────────┬────────────────────────────┘ │
└───────────────────────────────│──────────────────────────────┘
                                │ HTTP/JSON
┌───────────────────────────────▼──────────────────────────────┐
│  BACKEND (FastAPI + Python)                                   │
│                                                               │
│  ┌─────────┐  ┌───────────┐  ┌────────────────────────────┐  │
│  │ Parsers │  │ Exporters │  │   Engine Registry           │  │
│  └────┬────┘  └─────┬─────┘  │  ┌────────┐ ┌──────────┐  │  │
│       │              │        │  │VELambda│ │(futuros) │  │  │
│  ┌────▼──────────────▼──────┐ │  └────────┘ └──────────┘  │  │
│  │   In-memory Session Store│ └────────────────────────────┘  │
│  │   MapStore / DatalogStore│                                  │
│  └──────────────────────────┘                                  │
└───────────────────────────────────────────────────────────────┘
```

---

## Fronteira de responsabilidades

| Responsabilidade | Camada |
|-----------------|--------|
| Parsing de CSV (mapa e datalog) | Backend |
| Conversão raw → unidades reais | Backend (parser) |
| Execução do motor de tuning | Backend (pura função) |
| Exportação do CSV atualizado | Backend |
| Estado da sessão (edições, config, layout) | Frontend |
| Renderização de heatmaps e gráficos | Frontend |
| Validação de input de célula (100–9999) | Frontend (imediato) + Backend (guard) |
| Ordenação e seleção de logs | Frontend |
| Seleção de intervalo de tempo | Frontend |

---

## Persistência de estado no frontend

O usuário pode fechar o navegador, dar F5 ou reiniciar o computador e **retomar exatamente de onde parou** — sem reimportar arquivos e sem perder edições.

| Dado | Mecanismo | Motivo |
|------|-----------|--------|
| CSV dos arquivos (mapa + logs) | IndexedDB (blobs) | Tamanho de MB — localStorage não suporta |
| Modelos parseados (MapModel, DatalogModel) | IndexedDB (JSON) | Evita re-parse; restauração mais rápida |
| Mapa editável atual (células após edições/tuning) | IndexedDB (JSON) | Trabalho do usuário; não pode ser perdido |
| Último TuningOutput | IndexedDB (JSON) | Pode ser grande (~200 KB) |
| TuningConfig, engine selecionado | localStorage | Pequeno; leitura síncrona na inicialização |
| Ordem e estado enabled dos logs | localStorage | Pequeno; metadados de UI |
| Layout de gráficos, abas ativas, colunas | localStorage | Estado de UI |

Na inicialização do app, o `sessionRestorer` orquestra:
1. Lê localStorage → restaura config e preferências de UI
2. Lê IndexedDB → restaura mapa editável, logs e último output
3. Re-faz upload ao backend de forma transparente → obtém novos IDs de sessão
4. Exibe toast "Sessão restaurada" e a aplicação está pronta

Ver detalhes completos em [frontend/frontend.md → Persistência de estado](frontend/frontend.md).

---

## Fluxo principal de dados

```
1. Upload CSV mapa
   Frontend → POST /api/map/upload → Backend parseia → retorna MapModel + mapId
   Frontend armazena mapId em useMapStore

2. Upload CSV datalog(s)
   Frontend → POST /api/datalog/upload (por arquivo) → retorna DatalogModel + logId
   Frontend armazena logIds em useLogStore

3. Rodar auto-tuning
   Frontend → POST /api/tuning/run { mapId, logIds, engineId, config, timeRange }
   Backend executa engine selecionado (função pura)
   Backend retorna TuningOutput completo
   Frontend aplica suggested_map ao mapa editável, exibe análise

4. Exportar mapa
   Frontend → GET /api/map/{id}/export?cells=<editableMap JSON>
   Backend gera CSV com linhas #F01–#F16 atualizadas, demais linhas intactas
   Frontend dispara download do arquivo
```
