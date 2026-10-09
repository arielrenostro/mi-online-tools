## Why

Gerar e usar a correção do mapa VE hoje atravessa duas telas de forma escondida: o usuário monta as
entradas na aba Logs do Datalog (logs ativos, filtros, recorte de tempo), clica "Gerar fator de
correção" sem nenhum retorno, e o resultado aparece no fim da aba VE do Tuning — onde, antes de
existir, nem há uma seção. O resultado é um único snapshot "last" sobrescrito a cada geração, marcado
"desatualizado" sempre que o estado ambiente muda, e apagado ao trocar de mapa. Além disso, os filtros
de correção (painel na aba Logs, com rascunho + "Aplicar") e o filtro visual (modal, só de sessão)
fazem quase a mesma coisa com duas implementações, duas telas e uma regra de substituição entre eles.

O fluxo real do usuário é iterativo (olhar gráficos → ver o que o filtro corta → ajustar filtro →
gerar → editar o mapa → voltar e gerar outra) e pede: filtro acessível de qualquer aba do Datalog,
gerar de qualquer aba, e um histórico de compilados para escolher na VE.

## What Changes

- **Run de correção (novo conceito):** cada "Gerar Correção" cria um *run* — um compilado por célula
  (`n`, média, mediana, moda) + os breakpoints do mapa usados + a receita (nomes dos logs, recorte por
  log, filtros) só para exibição. O fator continua sempre derivado na leitura contra o mapa carregado.
  Run não depende mais dos logs depois de gerado.
- **Histórico de até 10 runs**, nomeados por padrão com data e hora (editável pelo usuário), com
  exclusão manual; o mais antigo sai ao passar de 10. O run selecionado persiste entre reloads.
- **Compatibilidade por breakpoints:** um run vale para qualquer mapa carregado com os mesmos
  breakpoints (permite ver quanto outro mapa seria corrigido pelos mesmos logs); com breakpoints
  diferentes, aparece como "incompatível com o mapa carregado" e nunca é reaproveitado em silêncio.
  Trocar de mapa deixa de apagar os runs.
- **BREAKING — fim do "desatualizado":** o conceito de snapshot desatualizado (`isStale`) é removido;
  o run é uma foto com receita explícita.
- **Botão "Gerar Correção" no cabeçalho do Datalog**, ao lado de Filtro e "?", em todas as abas exceto
  Dinamômetro. O botão só diz "Gerar Correção" e abre um diálogo de confirmação com o descritivo, o resumo (`N pontos · N critérios · logs`) e um switch para considerar ou não o intervalo selecionado na TimeRail. Ao confirmar, um toast (sempre no topo direito) "Run gerado — Ver na
  VE →" (sem navegação automática) e um indicador no "Tuning" da TopBar. Sai da aba Logs.
- **Filtro único (modal no cabeçalho do Datalog)** que unifica o filtro visual e os filtros de
  correção: cada critério com liga/desliga, todos em AND — faixas de MAP, RPM, Lambda 1, Lambda Corr,
  Pedal e CLT; estados de Lambda Loop; ΔTPS, ΔMAP e |Δ λ×alvo| máximos; pular os primeiros N pontos
  após entrar em Closed/Open Loop. É a mesma máscara para Dashboard, Gráficos, Dados **e** geração
  ("o que está destacado é o que gera"). Rascunho local ao modal com Aplicar/Esc, "Restaurar padrão",
  "Mostrar pontos filtrados" dentro do modal, persistente entre reloads. Padrão = os filtros de
  correção de hoje, ligados.
- **BREAKING — fim do modo "só destaque":** não existe mais filtro efêmero que não afete a geração.
  O filtro visual e o aviso/`useBlocker` de "filtros não aplicados" da aba Logs deixam de existir.
- **Aba Logs** passa a ter só o inventário de logs.
- **Tela "Configurações" (novo destino na TopBar, ao lado de Tuning e Datalog):** as Constantes
  (cilindrada, AFR, BSFC, calibração de VE) saem da aba Logs e passam a morar lá, sem exigir mapa nem
  log. Os sinais que dependem delas (VE Lambda Corrigido, Potência, Torque) ganham um texto de hover
  em Dashboard, Gráficos (sidebar e seletor) e Dados (cabeçalho e menu de colunas) dizendo que vêm das
  Configurações; a aba Dinamômetro ganha uma observação discreta (com link) de que os dados são
  calculados a partir das constantes de Configurações.
- **Aba VE:** a seção de correção passa a estar sempre visível. Sem nenhum run, mostra um texto
  explicando que a correção é gerada pelo Datalog (botão "Gerar Correção") e leva para lá; com runs,
  o cabeçalho ganha o seletor de run (renomear/excluir) e os filtros usados em chips.
- **Migração:** o snapshot "last" existente vira o "Run 1"; o `miot:correction-filters` antigo migra
  para o formato do filtro unificado; o IndexedDB sobe para a versão 4 com uma store de runs.

## Capabilities

### New Capabilities
- `correction-runs`: o run de correção e seu histórico (conteúdo, limite de 10, nome editável,
  seleção persistente, compatibilidade por breakpoints), o botão "Gerar Correção" no cabeçalho do
  Datalog com diálogo de confirmação/toast/indicador, e o seletor de run na VE.
- `app-settings`: a tela Configurações (destino na TopBar, sem guard) que hospeda as Constantes e diz
  quais sinais dependem delas.
- `datalog-filter`: o filtro único do Datalog (modal no cabeçalho, critérios ligáveis em AND, padrão,
  rascunho/Aplicar, Restaurar padrão, "Mostrar pontos filtrados", persistência) e a máscara única
  consumida por Dashboard, Gráficos, Dados e geração.

### Modified Capabilities
- `datalog-visual-filter`: todos os requisitos removidos — absorvidos por `datalog-filter`.
- `tuning-ve-correction`: sai o painel de filtros na aba Logs, o rascunho, o aviso ao sair, a
  "desatualização" e o botão na aba Logs; "Gerar" passa a criar um run; proveniência vira chips do run.
- `tuning-ve`: seção de correção sempre visível, com estado vazio explicativo e seletor de run.
- `datalog-import`: a aba Logs deixa de ter o painel de filtros e as Constantes.
- `session-persistence`: persistência de runs, run selecionado e filtro unificado; regras de
  invalidação (sem "desatualizado"; trocar de mapa não apaga runs); migração do snapshot "last".
- `datalog-charts`, `datalog-table`, `datalog-dashboard`: máscara de destaque passa a ser a do filtro
  único (sem a alternativa "filtro visual").
- `datalog-dyno`: observação sobre as constantes na aba; "Data selection" e "Dyno filters" passam a
  referenciar o filtro único.
- `heatmap-editing`: hover nas tabelas editáveis (VE, Ignição, Lambda) com valor original, atual e diferença percentual.
- `datalog-constants`: seção Constantes vai para Configurações (requisito renomeado); hover nos sinais
  dependentes; sem "marcar snapshot como desatualizado".

## Impact

- **Stores:** `correctionStore` deixa de guardar `filters`/`draftFilters`/`snapshot`/`isStale` e passa a
  ser dono do filtro unificado + runs; `visualFilterStore` é removido; `mapStore.loadMap` deixa de chamar
  `correctionStore.clear()`; `logStore`/`timeStore` deixam de chamar `markStale()`.
- **Utils/hooks:** `correctionFilters.ts` e `visualFilter.ts` convergem para um avaliador único;
  `useCorrectionMask` perde o ramo visual; `correctionGeneration.ts` recebe recorte por log.
- **Rotas/UI:** nova rota `/settings` e item "Configurações" na `TopBar`; `ConstantsPanel` muda de
  `LogsTab` para a nova página; hover (`title`) nos sinais de runtime no Dashboard, `ChartsTab`/
  `SyncedChart` e `DataTab`; nota no `DynoTab`; novo botão/menu no `DatalogPage`; `VisualFilterModal` + `CorrectionFilterPanel` viram o modal
  de filtro único; `LogsTab` perde o painel e o `useBlocker`; `CorrectionSection` ganha estado vazio e
  seletor; `TopBar` ganha o indicador; toast (componente novo ou existente — ver design).
- **Persistência:** IndexedDB v3 → v4 (store `correction-runs`; `correction-snapshot` fica órfã como
  `tuning-output`/`tuning-history`); `localStorage`: `miot:correction-filters` com formato novo e
  chave do run selecionado.
- **Specs:** mudanças acima; `CLAUDE.md` raiz e `frontend/CLAUDE.md` (tabela de capabilities, seção de
  stores e de correção) precisam ser atualizados junto do código.
