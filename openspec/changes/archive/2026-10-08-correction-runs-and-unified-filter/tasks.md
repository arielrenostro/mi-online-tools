## 1. Filtro único: modelo e avaliador

- [x] 1.1 Criar `types/filter.ts` (`FilterConfig`, `DEFAULT_FILTER`, `filtersEqual`, `countEnabled`) e verificar com teste unitário que o padrão tem 8 critérios ligados e MAP/RPM/Pedal/Lambda Corr desligados
- [x] 1.2 Criar `utils/filter.ts` com `evaluateFilter(logs, filter)` reaproveitando `computeDeltaAmplitude` e `computeLoopTransitionSkipMask`, calculando janelas/skips só para critérios ligados; verificar com testes portados de `correctionFilters.test.ts` e `visualFilter.test.ts` (AND, limites inclusivos, faixa aberta, NaN falha o critério ligado, skips por log)
- [x] 1.3 Criar `utils/filterMigration.ts` (filtro de correção antigo → `FilterConfig`) e verificar com teste: 3 estados de Loop → critério desligado, skips 0 → desligados, `minClt`/Lambda viram faixas ligadas

## 2. Store do filtro e máscara única

- [x] 2.1 Criar `store/filterStore.ts` (`filter`, `showFilteredPoints`, `apply`, `reset`, persistência em `miot:correction-filter`/`miot:correction-show-filtered`, `hydrate` com fallback ao padrão) e verificar com teste de store que filtro ilegível volta ao padrão sem erro
- [x] 2.2 Substituir `useCorrectionMask` por `useFilterMask` (sem ramo visual) e apontar Dashboard, `SyncedChart`, `DataTab`, `TimeRail` (se usar) e o export CSV para ele; verificar com `npm run build` e `npm run test`
- [x] 2.3 Remover `visualFilterStore`, `utils/visualFilter.ts`, `utils/correctionFilters.ts` (e seus testes antigos) e conferir com `grep` que nada mais os importa

## 3. Modal de filtro e botão no cabeçalho

- [x] 3.1 Criar `FilterModal` (critérios com liga/desliga, rascunho local, validações, prévia draft×aplicado, Aplicar/Restaurar padrão, "Mostrar pontos filtrados" imediato, Esc/click fora descartam) e verificar manualmente os cenários de `datalog-filter` no navegador
- [x] 3.2 Criar `FilterButton` no `DatalogPage` (contagem de critérios, destaque quando difere do padrão, oculto em `/datalog/dyno`) e verificar que volta ao estado anterior ao sair do Dinamômetro
- [x] 3.3 Remover `CorrectionFilterPanel`, `VisualFilterModal`, o `useBlocker` e o `ConfirmDialog` de filtros em `LogsTab`; verificar que trocar de aba com o modal fechado não pede confirmação

## 4. Run de correção: modelo e geração

- [x] 4.1 Definir `CorrectionRun` e a receita em `types/correction.ts` e `breakpointsEqual`; verificar com teste unitário (iguais, RPM diferente, MAP diferente)
- [x] 4.2 Criar `generateCorrectionRun` (embrulha `generateCorrectionSnapshot`, aceita recorte por log) e `toPerLogRanges(selection, logs)`; verificar com testes: seleção cobrindo dois logs, sem seleção ("full"), log fora da seleção ("unused"), reordenar logs não muda um run já gerado
- [x] 4.3 Reescrever `store/correctionStore.ts` (runs mais novo→antigo, `selectedRunId`, `generate`, `rename`, `remove`, corte FIFO em 10, `hasUnseenRun`, sem `isStale`/`markStale`/`clear`); verificar com testes de store (limite 10, nome padrão data/hora, nome vazio volta ao padrão, excluir o selecionado escolhe o mais recente compatível)
- [x] 4.4 Remover as chamadas de `markStale()`/`clear()` de `logStore`, `timeStore` e `mapStore`; verificar que trocar de mapa e mexer em logs/seleção não altera os runs (testes de store atualizados)

## 5. Persistência e migração

- [x] 5.1 Subir `persistence/db.ts` para v4 com a store `correction-runs` (`keyPath: id`) e criar `runPersistence.ts` (save/load all/delete); verificar com teste que o upgrade 3→4 mantém as stores antigas
- [x] 5.2 Atualizar `sessionRestorer`: restaurar runs, `miot:correction-selected-run` e filtro; rodar `restoreCorrection` depois de `restoreMap`; verificar com testes de restorer
- [x] 5.3 Implementar a migração do snapshot `last` → Run 1 (breakpoints do mapa restaurado; descarta se não houver mapa; só apaga `last` depois de gravar o run) e `miot:correction-filters` → `miot:correction-filter`; verificar com testes: com snapshot e mapa, sem mapa, sem snapshot, restauração repetida não duplica

## 6. Gerar Correção, toast e indicador

- [x] 6.1 Criar `toastStore` + `ToastHost` no `RootLayout` com ação opcional que navega só ao clicar; verificar com teste de store e manualmente que o toast some sozinho e não navega sozinho
- [x] 6.2 Criar `GenerateCorrectionButton` no `DatalogPage` (originalmente com resumo no botão — ver 10.1; desabilitado sem mapa ou sem pontos com mensagem, oculto no Dinamômetro); verificar manualmente os cenários de `correction-runs`
- [x] 6.3 Ao gerar: criar o run, disparar o toast "Ver na VE" (seleciona o run e navega para `/tuning/ve`) e acender o indicador no item Tuning da `TopBar`, apagado ao abrir `/tuning/ve`; verificar manualmente gerando a partir de Gráficos

## 7. Seção de correção na VE

- [x] 7.1 Refazer `CorrectionSection`: estado vazio com o texto explicativo e link para `/datalog` (navega só ao clicar); verificar abrindo a VE sem runs
- [x] 7.2 Adicionar o seletor de run (lista com nome/hora/nº de logs/compatibilidade, renomear inline, excluir com confirmação) e os chips da receita (logs, recorte por log, critérios ligados); verificar os cenários de "Run selector" em `correction-runs`
- [x] 7.3 Passar `CorrectionSection` a usar os breakpoints do run: run incompatível mostra aviso sem tabelas nem "Aplicar"; run compatível com outro mapa de mesmos breakpoints recalcula fatores; Moda desabilitada para run sem moda; verificar com testes de `correctionDisplay` e manualmente trocando de mapa
- [x] 7.4 Garantir que "Aplicar correções no mapa" continua sendo 1 undo e age sobre o run selecionado; verificar com teste de `mapStore` e manualmente

## 8. Configurações

- [x] 8.1 Criar a rota `settings` em `App.tsx` (sem guard), `SettingsPage` com o `ConstantsPanel` movido (e texto listando os sinais dependentes) e o item "Configurações" na `TopBar`; verificar a navegação, o reload na rota e o uso sem mapa/log
- [x] 8.2 Remover `ConstantsPanel` da `LogsTab`; verificar que a aba Logs mostra só a importação e a lista de logs
- [x] 8.3 Criar `signalOriginHint(name)` (baseado em `RUNTIME_SIGNAL_NAMES`) e aplicá-lo como `title` nos cartões do Dashboard, na sidebar e no seletor de Gráficos e no cabeçalho/menu de colunas de Dados; verificar com teste do helper (3 sinais sim, RPM não) e manualmente nas três abas
- [x] 8.4 Adicionar a nota discreta com link para Configurações no `DynoTab`; verificar manualmente que o link navega só ao clicar

## 9. Specs, docs e validação final

- [x] 9.1 Atualizar `CLAUDE.md` da raiz e `frontend/CLAUDE.md` (tabela de capabilities: `correction-runs`, `datalog-filter`, `app-settings`, remoção de `datalog-visual-filter`; seções de Stores, Correção VE, Persistência e Estrutura); verificar relendo os dois arquivos
- [x] 9.2 Atualizar `DatalogHelpModal` e `HomePage` se citarem filtro visual, aba Logs ou fluxo antigo de geração; verificar com `grep`
- [x] 9.3 Rodar `npm run test` e `npm run build` em `frontend/` sem erros
- [x] 9.4 Rodar `openspec validate correction-runs-and-unified-filter --strict` sem erros e ajustar o `## Purpose` do main spec `datalog-import` (o Purpose não passa por delta; o de `datalog-constants` já não cita a aba Logs)
- [x] 9.5 Ao arquivar a change, remover à mão o main spec `datalog-visual-filter`, que ficará sem requisitos depois do sync (verificar com `openspec list --specs`)

## 10. Ajustes pós-revisão

- [x] 10.1 Renomear o botão para "Gerar Correção" (só o rótulo, sem resumo) e abrir um diálogo de confirmação com descritivo, resumo (pontos, critérios, logs) e o switch "Considerar o intervalo selecionado na linha do tempo" (ligado por padrão se houver seleção; desligado e indisponível sem seleção; a contagem segue o switch); `generate({ useTimeSelection })` registra o recorte só quando ligado; verificar com teste de store e no navegador (cancelar não cria run, confirmar cria)
- [x] 10.2 No modal de filtro, desabilitar todos os campos de um critério enquanto o seu checkbox estiver desmarcado (e parar de ligar o critério ao digitar); verificar no navegador que os campos travam e destravam mantendo os valores
- [x] 10.3 Posicionar o toast sempre no topo direito (abaixo da TopBar); verificar no navegador gerando de qualquer aba
- [x] 10.4 Na seção de correção da VE, mover o seletor de run (com Renomear/Excluir) e os chips para baixo do título e colocar o rótulo "Valores" com o switch Média | Mediana | Moda logo abaixo; verificar no navegador
- [x] 10.5 Rodar `npm run test`, `npm run build` e `openspec validate correction-runs-and-unified-filter --strict`; atualizar a ajuda do Datalog e os `CLAUDE.md` se citarem o comportamento antigo

## 11. Correção em percentual e escala de cores

- [x] 11.1 Exibir as tabelas Direta e Ponderado como variação percentual do fator (1.05 → +5.0%, 0.95 → -5.0%, 0 → 0.0%), inclusive no tooltip, mantendo o fator para "Aplicar"; verificar com testes de `factorToPercent`/`formatPercentDelta`/`percentGrid` e no navegador
- [x] 11.2 Nova escala de cor `correction` (não linear, pela correção absoluta: 5% amarelo, 10% vermelho, 15% vinho/limite, sem escurecer além disso); verificar com testes de `correctionColor` e no navegador
- [x] 11.3 Fazer Direta e Ponderado caberem lado a lado sem rolagem horizontal (largura do par considera o espaço entre elas e uma folga; vale para qualquer divisão mapa/gráfico); verificar com testes de `computePairCellWidth` e medindo `scrollWidth` no navegador em vários tamanhos de janela

## 12. Constante k do Ponderado nas Configurações

- [x] 12.1 Criar `correctionSettingsStore` (k padrão 100, aceita ≥ 0, persiste em `miot:correction-settings`, hydrate com fallback) e restaurá-lo no `sessionRestorer`; verificar com testes de store e de restorer
- [x] 12.2 Passar o k a `computeWeightedFactor`/`computeFactor`/`computeFactorGrid` (padrão 100) e usá-lo em `CorrectionSection` (tabela Ponderado, tooltip e "Aplicar"); verificar com testes de `correctionDisplay` (k = n aplica metade, k = 0 iguala ao direto)
- [x] 12.3 Criar a seção "Correção — Ponderado" na `SettingsPage` (campo k, explicação da fórmula, Restaurar padrão) e conferir no navegador que mudar o k atualiza a tabela Ponderado e que sobrevive a um reload

## 13. Switch "Cores" (Valor | Amostras)

- [x] 13.1 Adicionar o switch "Cores" ao lado de "Valores" na seção de correção: "Valor" (atual) ou "Amostras" — mesmas cores do valor, desbotando para o tom neutro de célula vazia conforme a confiança `n / (n + k)` (sem escurecer: o vinho não vira ponto escuro); só muda a pintura, nunca os números; verificar com testes de `confidenceWeightGrid`/`confidenceOpacity`/`fadeToNeutral` e no navegador alternando e mudando o k nas Configurações

## 14. Hover com original, atual e diferença nas tabelas editáveis

- [x] 14.1 Nas tabelas editáveis de VE, Ignição e Lambda, mostrar no hover de cada célula "Original", "Atual" e "Diferença" em percentual (`+5.0%`, `-5.0%`, `—` sem base; Lambda com 3 casas), implementado uma vez em `EditableMapSection` via `cellTitle`; verificar com testes de `diffPercent`/`formatCellDiffTitle` e no navegador editando uma célula nas três abas e desfazendo

