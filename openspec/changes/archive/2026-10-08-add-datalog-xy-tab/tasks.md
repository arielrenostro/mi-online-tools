## 1. Estado e persistência

- [x] 1.1 Criar `store/xyStore.ts` (`xSignal`, `ySignals`, `setX`, `addY`, `removeY`, `hydrate`, persistência em `miot:xy`) e `store/xyStore.test.ts`; verificar com `npm run test` que cobre: padrão RPM/[MAP], não remove o último Y, ignora Y duplicado, `hydrate` descarta lixo/duplicados e cai no padrão com dado ausente ou ilegível
- [x] 1.2 Adicionar `restoreXY()` em `persistence/sessionRestorer.ts` (mesmo desenho de `restoreDyno`) e verificar, via teste do store ou do restorer, que um valor salvo é restaurado e um valor ilegível não gera erro

## 2. Montagem das séries

- [x] 2.1 Extrair a paleta para `utils/signalColor.ts` e trocar a cópia local de `SyncedChart.tsx` por esse import (única mudança no arquivo); verificar que `SyncedChart.test.ts` e o restante de `npm run test` continuam passando
- [x] 2.2 Criar `utils/xySeries.ts` (função pura: linhas + máscara + seleção + X + Y + "mostrar filtrados" → `{pass, fail}` por Y) e `xySeries.test.ts`; verificar casos: linha sem X ou sem aquele Y é pulada só naquela série, seleção de tempo recorta, "ocultar" zera `fail`, sinal ausente em um log não afeta os outros Y, máscara mais curta que as linhas não quebra

## 3. Gráfico

- [x] 3.1 Criar `components/XYChart.tsx` com `buildXYOption` pura (duas séries `scatter` por Y, `large`, eixos por sinal com `min`/`max` do `SignalDef`, lados alternados, tooltip com nome/valor/unidade) e `XYChart.test.ts`; verificar que o option tem o número certo de eixos/séries, cores iguais entre chip e eixo, e que "ocultar" não gera série `fail`
- [x] 3.2 Adicionar o marcador de cursor (série com `id` estável por Y, atualizada via `setOption` na instância ECharts quando `cursor_ms` muda, usando `findLastRow`) e verificar manualmente que mover o cursor na TimeRail move o marcador sem redesenhar a nuvem; cobrir a escolha da linha do cursor em teste unitário
- [x] 3.3 Mostrar a mensagem de "sem dados" quando nenhuma série tem pontos e verificar com um filtro que exclui tudo

## 3b. Linha média

- [x] 3b.1 Adicionar `showMean` (padrão `false`, `setShowMean`, saneado no `hydrate`, persistido em `miot:xy`) ao `xyStore` e cobrir em `xyStore.test.ts`: padrão, alternar persiste, `hydrate` aceita só booleano e cai no padrão com lixo
- [x] 3b.2 Criar `meanByX(points, xMin, xMax, bands=70, minSamples=3)` em `utils/xySeries.ts` (pura; ordenada por X; ponto = média de X e de Y da faixa) e `buildXYOption(series, xSignal, showMean)` com uma série `line` `mean-<i>` por Y com curva (cor da série, halo, tooltip), sem série com `showMean` desligado nem para Y sem faixa com ≥ 3 pontos; verificar em `xySeries.test.ts`/`XYChart.test.ts`: média por faixa correta, faixa com < 3 pontos ignorada, pontos `fail` fora da média, seleção respeitada, ordem crescente de X
- [x] 3b.3 Adicionar o checkbox "Linha média" à barra de `XYTab.tsx` e verificar no navegador, com X = RPM e Y = Pressão Óleo, que a curva segue a nuvem, muda ao aplicar filtro e ao selecionar intervalo, e que o estado sobrevive a um reload

## 3c. Linhas máxima e mínima

- [x] 3c.1 Adicionar `showMax`/`showMin` (padrão `false`, `setShowMax`/`setShowMin`, saneados no `hydrate`, persistidos em `miot:xy`) ao `xyStore` e cobrir em `xyStore.test.ts`: padrão, alternar persiste sem mexer nos outros, `hydrate` só aceita `true`
- [x] 3c.2 Generalizar `meanByX` em `bandCurve(points, xMin, xMax, stat)` (`mean`/`max`/`min`) em `utils/xySeries.ts` e fazer `buildXYOption` aceitar `{ mean, max, min }`, criando as séries `max-<i>`/`min-<i>` pontilhadas em cinza-claro; verificar em `xySeries.test.ts`/`XYChart.test.ts`: máximo e mínimo por faixa corretos, `fail` fora dos extremos, mínimo de 3 pontos, cada linha independente das outras, máxima ≥ média ≥ mínima em cada faixa, tooltip com "máximo de"/"mínimo de"
- [x] 3c.3 Adicionar os checkboxes "Linha máxima" e "Linha mínima" à barra de `XYTab.tsx` e verificar no navegador que cada um liga/desliga sozinho, que envolvem a nuvem junto com a média e que sobrevivem a um reload

## 3d. Remover o único Y

- [x] 3d.1 Permitir `removeY` do último sinal no `xyStore` (lista vazia) e `hydrate` restaurar lista vazia como vazia (só ausente/não-lista/lista sem nome válido cai no padrão), cobrindo em `xyStore.test.ts`; verificar que o teste antigo "não remove o último Y" foi trocado pelo novo comportamento
- [x] 3d.2 Em `XYTab.tsx`, tirar o fallback para MAP e o bloqueio do botão ×, e mostrar a mensagem "Adicione um sinal ao eixo Y" quando a lista efetiva é vazia; verificar no navegador: remover o único Y mostra a mensagem, adicionar volta ao gráfico, e a lista vazia sobrevive a um reload

## 4. Aba e navegação

- [x] 4.1 Criar `features/datalog/XYTab.tsx` (barra com seletor de X, chips de Y com cor e remover, "adicionar Y" sem repetir sinais, Y efetivo = salvos ∩ disponíveis; lista vazia mostra a mensagem de adicionar Y) e verificar manualmente adicionar/remover Y e trocar X
- [x] 4.2 Registrar a rota `xy` sob `RequireLog` em `App.tsx`, o `TabLink` "XY" em `DatalogPage.tsx` e a nova ordem das abas (Logs, Dados, Dashboard, Gráficos, XY, Dinamômetro) e `'xy'` em `DatalogTab` (`types/ui.ts`); verificar que `/datalog/xy` sem log ativo redireciona para Logs e que "Filtro" e "Gerar Correção" aparecem nesta aba
- [x] 4.3 Adicionar a descrição da aba em `DatalogHelpModal.tsx` e verificar que o modal a mostra

## 5. Specs e documentação

- [x] 5.1 Atualizar os índices de capabilities em `CLAUDE.md` (raiz) e `frontend/CLAUDE.md` com `datalog-xy`, `xyStore` na seção de stores e `miot:xy` na lista de localStorage; verificar relendo as tabelas
- [x] 5.2 Rodar `openspec validate add-datalog-xy-tab --strict` e confirmar que a spec nova e os deltas de `navigation-guards` e `session-persistence` passam

## 6. Verificação final

- [x] 6.1 Rodar `npm run test` e `npm run build` em `frontend/` sem erros
- [x] 6.2 Com um log de ~72 mil linhas, verificar manualmente que trocar X, adicionar um Y e aplicar um filtro atualizam a aba sem travar, todos os pontos são desenhados e um reload restaura X e os Y
