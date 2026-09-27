# Arquitetura — Visão Geral

App 100% client-side (SPA estática, sem backend). Specs detalhadas de comportamento vivem como
capabilities do OpenSpec em `openspec/specs/` (`openspec list --specs`).

## Stack tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estilo | Tailwind CSS + shadcn/ui |
| Gráficos | ECharts (via echarts-for-react) — heatmap, zoom, seleção, tooltip sincronizado |
| Estado global | Zustand — fatias independentes por domínio |
| Roteamento | React Router v6 — rotas aninhadas e guards |
| Armazenamento | IndexedDB + localStorage — sem backend, sem banco de dados |

## Modelo de sessão

Não há servidor. O **frontend é a única fonte de verdade** do estado (mapa, datalogs, edições
manuais, filtros e resultado de correção, layout). Fechar o navegador, reiniciar o computador ou
perder conexão de rede não afeta nada — o app não depende de rede após o load inicial.

## Fronteira de responsabilidades

| Responsabilidade | Camada |
|-----------------|--------|
| Parsing de CSV (mapa e datalog) + conversão raw→real | Frontend, 100% client-side |
| Filtragem de pontos, atribuição bilinear, agregação por célula, cálculo de fator de correção | Frontend (`utils/correctionFilters.ts`, `utils/correctionGeneration.ts`) |
| Exportação do CSV atualizado | Frontend (`mapExporter.ts`) |
| Estado da sessão (edições, filtros, layout) | Frontend |
| Renderização de heatmaps e gráficos | Frontend |
| Validação de input de célula (100–9999) | Frontend |
| Ordenação/seleção de logs e seleção de intervalo | Frontend |

## Persistência de estado no frontend

O usuário pode fechar o navegador, dar F5 ou reiniciar o computador e **retomar de onde parou** —
sem reimportar arquivos e sem perder edições.

| Dado | Mecanismo | Motivo |
|------|-----------|--------|
| CSV dos arquivos (mapa + logs) | IndexedDB (blobs) | Tamanho de MB |
| Modelos parseados (MapModel, DatalogModel) | IndexedDB (JSON) | Evita re-parse |
| Mapa editável atual | IndexedDB (JSON) | Trabalho do usuário |
| Último snapshot de correção VE (com proveniência) | IndexedDB (JSON) | Pode ser grande |
| Filtros de correção, toggle de visibilidade, ordem/enabled dos logs, layout/abas/colunas | localStorage | Pequenos; leitura síncrona na inicialização |

Na inicialização, o `sessionRestorer` lê o localStorage e o IndexedDB e popula os stores — sem
nenhuma chamada de rede. Detalhes em [frontend/persistence.md](frontend/persistence.md).

## Fluxo principal de dados

1. **Upload do mapa** — parseado no browser; o `MapModel` vai para `useMapStore` e o IndexedDB.
2. **Upload de datalog(s)** — parseado no browser (`parseDatalogClient`); o `DatalogModel` vai para
   `useLogStore` e o IndexedDB.
3. **Configurar filtros e gerar correção** — filtros de correção (aba Logs) recortam o conjunto de
   pontos ao vivo; "Gerar fator de correção" roda a atribuição bilinear + agregação por célula
   inteiramente no browser e produz um snapshot (ver `openspec/specs/tuning-ve-correction`).
4. **Aplicar correções** — multiplica cada célula do mapa editável pelo fator do snapshot.
5. **Exportar mapa** — exportação client-side (`mapExporter`): gera o CSV substituindo as linhas
   dos mapas editados (`#F`/`#I`/`#A`), mantendo as demais intactas.
