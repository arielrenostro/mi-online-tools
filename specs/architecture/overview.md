# Arquitetura — Visão Geral

Specs detalhadas por camada: [Frontend](frontend/frontend.md) · [Backend](backend/backend.md)

## Stack tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estilo | Tailwind CSS + shadcn/ui |
| Gráficos | ECharts (via echarts-for-react) — heatmap, zoom, seleção, tooltip sincronizado |
| Estado global | Zustand — fatias independentes por domínio |
| Roteamento | React Router v6 — rotas aninhadas e guards |
| Backend | Python 3.12 + FastAPI — async, ecossistema científico (numpy, scipy) |
| Serialização | Pydantic v2 — modelos como contratos |
| Comunicação | REST JSON (HTTP) — sem WebSocket na v1 |
| Armazenamento | Em memória / disco temporário — sem banco de dados |

## Modelo de sessão

O backend é **stateless** entre requisições — sem banco de dados, cookies de sessão ou autenticação. Os datalogs ficam em cache no disco do servidor, indexados por hash SHA-1 (TTL 1h). O mapa **nunca** é armazenado no backend.

Implicações:
- Reiniciar o servidor / expirar o cache → o frontend reenvia os logs de forma transparente
- Não há multiusuário nem autenticação na v1
- O **frontend é a fonte de verdade** do estado (mapa, edições manuais, config de tuning, layout)

## Fronteira de responsabilidades

| Responsabilidade | Camada |
|-----------------|--------|
| Parsing de CSV (mapa) | Frontend (`parseMapClient`) |
| Parsing de CSV (datalog) + conversão raw→real | Frontend (`parseDatalogClient`) e Backend (reparseia no upload) |
| Execução do motor de tuning | Backend (função pura) |
| Exportação do CSV atualizado | Frontend (`mapExporter`) |
| Estado da sessão (edições, config, layout) | Frontend |
| Renderização de heatmaps e gráficos | Frontend |
| Validação de input de célula (100–9999) | Frontend (imediato) + Backend (guard) |
| Ordenação/seleção de logs e seleção de intervalo | Frontend |

## Persistência de estado no frontend

O usuário pode fechar o navegador, dar F5 ou reiniciar o computador e **retomar de onde parou** — sem reimportar arquivos e sem perder edições.

| Dado | Mecanismo | Motivo |
|------|-----------|--------|
| CSV dos arquivos (mapa + logs) | IndexedDB (blobs) | Tamanho de MB |
| Modelos parseados (MapModel, DatalogModel) | IndexedDB (JSON) | Evita re-parse |
| Mapa editável atual | IndexedDB (JSON) | Trabalho do usuário |
| Último TuningOutput | IndexedDB (JSON) | Pode ser grande (~200 KB) |
| TuningConfig, engine, ordem/enabled dos logs, layout/abas/colunas | localStorage | Pequenos; leitura síncrona na inicialização |

Na inicialização, o `sessionRestorer` lê o localStorage e o IndexedDB, popula os stores, reenvia os logs ao backend de forma transparente e exibe "Sessão restaurada". Detalhes em [frontend/persistence.md](frontend/persistence.md).

## Fluxo principal de dados

1. **Upload do mapa** — parseado no browser; o `MapModel` vai para `useMapStore` e o IndexedDB. O backend não recebe o mapa.
2. **Upload de datalog(s)** — `POST /api/datalog/upload` (por arquivo, com header `X-Content-Hash`); o backend parseia (ou usa o cache por hash) e retorna `DatalogModel`. Frontend também parseia client-side.
3. **Rodar auto-tuning** — `POST /api/tuning/run` com `{ engineId, rpmBreakpoints, mapBreakpoints, cells, logHashes, timeRange, config }`; o mapa vai **inline** a cada chamada. O backend executa o engine (função pura) e retorna o `TuningOutput`; o frontend aplica `suggestedMap` ao mapa editável.
4. **Exportar mapa** — exportação **client-side** (`mapExporter`): gera o CSV substituindo as linhas dos mapas editados (`#F`/`#I`/`#A`), mantendo as demais intactas.
