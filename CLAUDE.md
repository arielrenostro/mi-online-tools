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
| `map-import-export` | Parsing/exportação client-side do CSV de mapa |
| `datalog-import` | Parsing client-side do CSV de datalog; aba Logs (só inventário de logs); controle de logs na TopBar |
| `datalog-timeline` | TimeRail: cursor, seleção de intervalo, sparkline, múltiplos logs |
| `datalog-dashboard` | Aba Dashboard |
| `datalog-charts` | Aba Gráficos: painéis sincronizados, sidebar de sinais |
| `datalog-table` | Aba Dados: tabela, colunas, exportação CSV |
| `datalog-filter` | Filtro único do Datalog (modal no cabeçalho): critérios ligáveis em AND, mesma máscara para destaque e para gerar run, padrão, rascunho/Aplicar, "Mostrar pontos filtrados", persistência |
| `correction-runs` | Run de correção (compilado independente dos logs), histórico de 10, nome editável, compatibilidade por breakpoints, botão "Gerar Correção" no cabeçalho do Datalog, toast/indicador, seletor na aba Eficiência Volumétrica |
| `app-settings` | Tela Configurações (TopBar, sem guard): Constantes do motor, a constante k de confiança do Ponderado e a faixa (mín/máx) dos sinais nos gráficos |
| `datalog-constants` | Constantes (tela Configurações): cilindrada/AFR/BSFC, calibração de VE (k), sinais de runtime VE Lambda Corrigido, Potência, Torque e o hover que indica a origem deles |
| `datalog-dyno` | Aba Dinamômetro: curva potência/torque × RPM (Roda/Motor, Bruto/Suavizado, filtros próprios) |
| `datalog-xy` | Aba XY: nuvem de pontos de um sinal X contra um ou mais Y (eixo por sinal), com o filtro único, a seleção da TimeRail e o cursor |
| `heatmap-editing` | Contrato compartilhado de edição de tabela N×M (seleção, atalhos, undo/redo) |
| `mapa-arquivo` | Aba Arquivo do Mapa: subir/substituir, exportar e remover o mapa, informações do mapa (livre de guard) |
| `mapa-ve` | Aba VE: edição manual, mapa original, seção de correção (sempre presente, com estado vazio explicativo) |
| `mapa-ve-correction` | Atribuição bilinear + estatísticas por célula, heatmaps de correção (Direta/Ponderado/Amostras), proveniência e aplicação no mapa VE |
| `mapa-ignition` | Aba Ignition (bloqueada na v1) |
| `mapa-lambda` | Aba Lambda (bloqueada na v1) |
| `navigation-guards` | Rotas, guards (`RequireMap`/`RequireLog`), padrão de aba bloqueada |
| `session-persistence` | O que sobrevive a um reload, ordem de restauração, migração do snapshot antigo, runs nunca invalidados |
| `pwa` | App instalável (manifest), service worker offline, atualização automática, cache dos arquivos de update |

### Geral

| Spec | Cobre |
|------|-------|
| `specs/overview.md` | Visão geral do projeto, escopo da v1, roadmap, usuários-alvo |

### Formatos MasterInjection (`*/parsers/`)

| Spec | Cobre |
|------|-------|
| `specs/master/datalog.md` | Formato CSV do datalog, colunas, conversões raw→real (usado pelo parser client-side) |

### Arquitetura — geral

| Spec | Cobre |
|------|-------|
| `specs/architecture/architecture.md` | Ponteiro para o spec detalhado de arquitetura |
| `specs/architecture/overview.md` | Stack, fluxo de dados, persistência, fronteiras |

## Subprojetos

App 100% frontend — sem backend, sem serviço, sem variáveis de ambiente de runtime.

| Pasta | Stack | Docs |
|-------|-------|------|
| `frontend/` | React 18 + TypeScript + Vite + Tailwind + Zustand | [frontend/CLAUDE.md](frontend/CLAUDE.md) |

```bash
# Frontend (5173)
cd frontend && npm install && npm run dev
```

## Decisões arquiteturais

- **Sem backend.** Um motor de auto-tuning no servidor existiu, nunca funcionou bem na prática e foi
  removido — a correção do mapa VE é calculada inteiramente no cliente (ver `correction-runs` e `mapa-ve-correction`).
- **Parsing é sempre client-side.** `parseMapClient` e `parseDatalogClient` rodam no browser; nada é
  enviado a nenhum servidor.
- **Frontend é a única fonte de verdade.** Mapa, logs, edições, o filtro e o histórico de runs de
  correção vivem em IndexedDB/localStorage no navegador do usuário.
