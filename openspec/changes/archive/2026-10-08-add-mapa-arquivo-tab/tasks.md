## 1. Rename mecânico Tuning → Mapa (sem mudança de comportamento)

- [x] 1.1 `git mv frontend/src/features/tuning frontend/src/features/mapa`, `pages/TuningPage.tsx` → `pages/MapaPage.tsx`, `components/TuningTabLink.tsx` → `components/MapaTabLink.tsx` e renomear componentes/símbolos (`TuningPage`, `TuningTabLink`) e todos os imports `@/features/tuning/...`; verificar com `npm run build` e `npm run test` sem erros
- [x] 1.2 Rotas e links: em `App.tsx` trocar `tuning` por `mapa` (índice → `ve`) e adicionar a rota legada `tuning/*` redirecionando para `/mapa`; atualizar `navigate('/tuning')` da `HomePage` e os `NavLink to="/tuning"` da `TopBar`; verificar no navegador que `#/mapa`, `#/mapa/ve`, `#/mapa/ignition`, `#/mapa/lambda` abrem e que `#/tuning/lambda` cai em `#/mapa/ve` _(código e testes automatizados ok; checagem manual no navegador pendente)_
- [x] 1.3 Textos visíveis: item da `TopBar`, card e rótulos da `HomePage`, `RequireMap`, `DatalogHelpModal`, tooltips/mensagens e comentários que citam Tuning (ex.: `correctionStore`) passam a "Mapa"; verificar com `grep -rniE "tuning" frontend/src` restando só "auto-tuning" (descrições) e as stores legadas `tuning-output`/`tuning-history` em `persistence/db.ts` e `db.test.ts`
- [x] 1.4 `TuningAnalysisMode`/`tuningAnalysisMode` → `MapaAnalysisMode`/`mapaAnalysisMode` em `types/ui.ts` e `store/uiStore.ts`, com `hydrate` aceitando o campo antigo salvo em `miot:ui`; verificar com teste de store: estado salvo com `tuningAnalysisMode: 'coverage'` restaura `mapaAnalysisMode === 'coverage'` e o próximo persist grava só o nome novo

## 2. Informações do mapa (lógica pura)

- [x] 2.1 Criar `utils/mapInfo.ts` com `countEditedCells(editable, original)` e `summarizeMap(originalMap, editableMap, editableIgnitionMap, editableLambdaMap)` (nome, colunas RPM × linhas MAP, min/max de RPM e de MAP independentes da ordem dos breakpoints, células editadas por tabela); verificar com `utils/mapInfo.test.ts`: sem edições → 0/0/0, 7 VE + 2 ignição → 7/2/0, desfazer a edição volta a 0, grade de tamanho não padrão

## 3. Store: remoção e limpeza de estado derivado

- [x] 3.1 Confirmar com teste em `mapStore.test.ts` que `clear()` zera `originalMap`, as três tabelas editáveis, `isDirty*`, históricos e `lastError`, e apaga a entrada `current` da persistência; verificar com `npm run test`
- [x] 3.2 Confirmar com teste que `loadMap` com arquivo inválido mantém o mapa anterior e preenche `lastError`, e que `loadMap` bem-sucedido limpa `lastError`; ajustar o store só se o teste falhar
- [x] 3.3 Verificar se o estado de seleção compartilhado da VE/gráficos referencia células do mapa antigo após `clear()`/`loadMap` (`grep` pelo store de seleção); se sim, zerá-lo nesses pontos e cobrir com teste; se não, registrar nesta tarefa que não foi necessário _(não foi necessário: a seleção é `useState` do `VETab`, que desmonta sem mapa/ao sair da aba)_
- [x] 3.4 Verificar com teste que `clear()` não altera logs, constantes, filtro nem runs de correção (cenário "Removal keeps the rest of the session")

## 4. Rota, guard e barra de abas

- [x] 4.1 Em `App.tsx`, tirar o `RequireMap` do elemento `mapa` e envolver `ve`, `ignition` e `lambda` individualmente; adicionar a rota `mapa/arquivo` sem guard; verificar no navegador sem mapa: `/mapa/arquivo` abre normalmente, `/mapa/ve` mostra o aviso, a barra de abas aparece nos dois casos, e `/mapa` ainda redireciona para `/mapa/ve` _(código e testes automatizados ok; checagem manual no navegador pendente)_
- [x] 4.2 Trocar a tela de upload de `components/guards/RequireMap.tsx` por um aviso "Nenhum mapa carregado" com link para `/mapa/arquivo` (mantendo o spinner durante `isRestoring`); verificar que o link leva à aba Arquivo e que reload em `/mapa/ve` com mapa persistido mostra o spinner e depois o conteúdo, sem piscar o aviso
- [x] 4.3 Em `pages/MapaPage.tsx`: adicionar `MapaTabLink to="arquivo" label="Arquivo"` antes de VE e remover o menu "Ações", `handleImport`, `handleExport` e o input de arquivo; verificar que a barra mostra Arquivo, VE, Ignition, Lambda e nada mais
- [x] 4.4 Atalhos por aba: mapear explicitamente `ve → undo/redo da VE`, `ignition → ignição`, `lambda → lambda` e nenhuma ação nas demais rotas (inclui `arquivo`), em vez do `else` que cai na VE; extrair a escolha para uma função pura (`undoTargetForPath(pathname)`) e verificar com teste unitário (`/mapa/ve`, `/mapa/ignition`, `/mapa/lambda`, `/mapa/arquivo` → null) e, no navegador, que Ctrl+Z em cada aba só desfaz a tabela daquela aba e na aba Arquivo não altera nada _(código e testes automatizados ok; checagem manual no navegador pendente)_

## 5. Aba Arquivo

- [x] 5.1 Criar `features/mapa/arquivo/ArquivoTab.tsx` com o estado vazio (mensagem, "Importar mapa", área de soltar arquivo), input `accept=".csv"` limpo após cada escolha e botões desabilitados durante `isLoading`; verificar no navegador sem mapa: CSV válido carrega e permanece em `/mapa/arquivo`, soltar vários arquivos carrega o primeiro `.csv`, soltar só não-CSV não faz nada, CSV inválido mostra `lastError` _(código e testes automatizados ok; checagem manual no navegador pendente)_
- [x] 5.2 Criar o cartão de informações usando `summarizeMap` (nome, grade, faixa RPM, faixa MAP, células editadas por tabela VE/Ignição/Lambda alvo, ou "sem edições"); verificar no navegador: editar células na VE e na Ignição, voltar à aba Arquivo e ver as contagens; desfazer e ver zerar _(código e testes automatizados ok; checagem manual no navegador pendente)_
- [x] 5.3 Implementar "Exportar mapa" chamando `exportMapCsv` + `downloadCsv` com o nome `<original>_tuned.csv`, renderizado só com mapa carregado; verificar baixando o arquivo e comparando o conteúdo com o export anterior (mesmas linhas, só VE/ignição/lambda alterados)
- [x] 5.4 Com mapa carregado, o botão "Importar mapa" (mesmo rótulo do estado vazio; picker + soltar arquivo) com `ConfirmDialog` quando `isDirty || isDirtyIgnition || isDirtyLambda`, guardando o `File` pendente até confirmar/cancelar; verificar no navegador: sem edições troca direto; com edições o diálogo aparece, Cancelar mantém mapa e edições, Confirmar carrega o novo; logs, seleção de tempo e runs permanecem _(código e testes automatizados ok; checagem manual no navegador pendente)_
- [x] 5.5 Implementar "Remover mapa" com `ConfirmDialog` (texto cita edições perdidas e sugere exportar quando há edições), chamando `mapStore.clear()` e permanecendo em `/mapa/arquivo`; renderizado só com mapa carregado; verificar no navegador: confirmar mostra o estado vazio, reload não restaura o mapa, cancelar não muda nada, logs e runs continuam _(código e testes automatizados ok; checagem manual no navegador pendente)_

## 5b. Rótulo "Eficiência Volumétrica"

- [x] 5b.1 Trocar o rótulo da aba VE em `MapaPage` e os textos que a citam (`TopBar`, `WeightingPanel`, `GenerateCorrectionDialog` com o toast "Ver em Eficiência Volumétrica →", `DatalogHelpModal`) e as specs/`CLAUDE.md`; verificar com `grep -rn "aba VE\|Ver na VE" frontend/src openspec/specs` sem ocorrências _(checagem manual no navegador pendente)_

## 6. TopBar

- [x] 6.1 Remover de `components/TopBar.tsx` o nome do mapa e o uso de `useMapStore`, preservando o restante (links, indicador de run novo, Configurações); verificar no navegador com e sem mapa que nenhum badge de mapa aparece e o logo continua levando à Home _(código e testes automatizados ok; checagem manual no navegador pendente)_
- [x] 6.2 Conferir com `grep` que nenhum componente depende de import/export fora da aba Arquivo e da Home e rodar `npm run build` e `npm run test` sem erros

## 7. Specs e documentação

- [x] 7.1 Renomear os diretórios de spec com `git mv` (`tuning-ve` → `mapa-ve`, `tuning-ve-correction` → `mapa-ve-correction`, `tuning-ignition` → `mapa-ignition`, `tuning-lambda` → `mapa-lambda`) e atualizar o `Purpose`/texto interno de cada uma; verificar com `openspec list --specs` mostrando os novos ids
- [x] 7.2 Trocar "Tuning"/`/tuning`/ids antigos pelos novos nas demais specs principais que os citam (`correction-runs`, `app-settings`, `datalog-*`, `heatmap-editing`, `session-persistence`, `home` Purpose etc.), sem alterar o sentido; verificar com `grep -rniE "tuning" openspec/specs` restando só "auto-tuning" e eventuais títulos de cenário (7.4)
- [x] 7.3 Sincronizar/arquivar a change (`/opsx:sync` ou `/opsx:archive`) para criar `mapa-arquivo` e aplicar os deltas de `map-import-export`, `navigation-guards`, `home` e `heatmap-editing`; verificar com `openspec validate --specs --strict`
- [x] 7.4 Renomear nas specs principais os três títulos de cenário que ainda dizem Tuning ("Visiting the Tuning index", "Accessing Tuning without a map", "Reload while on Tuning or Datalog") para Mapa; verificar com `grep`
- [x] 7.5 Atualizar o `CLAUDE.md` da raiz e `frontend/CLAUDE.md`: tabela de capabilities (ids `mapa-*`, `mapa-arquivo`), estrutura de pastas (`features/mapa/`, `features/mapa/arquivo/`, `utils/mapInfo.ts`, `MapaPage.tsx`), descrição de `map-import-export` sem controle na TopBar e menção ao indicador do item Mapa; verificar relendo os dois arquivos e com `grep -n -i tuning`
