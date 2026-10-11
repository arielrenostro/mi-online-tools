## Why

Para afinar o mapa o usuário precisa enxergar, a cada instante, o quanto a ECU está longe do que
pediu: o lambda medido contra o alvo e o boost medido contra o alvo. Hoje só dá para comparar duas
linhas "a olho" em Gráficos; não existe um sinal que seja o erro em si, que possa ser plotado,
listado no Dashboard/Dados e usado no XY. Além disso o alvo de boost se chama "Turbo Target" no app
enquanto o sinal medido se chama "Boost", o que atrapalha a leitura do par.

## What Changes

- Novo sinal derivado **Delta Lambda 1 Target** = `Lambda 1 − Lambda Target` (λ; positivo = mais pobre
  que o alvo, negativo = mais rico).
- Novo sinal derivado **Delta Boost Target** = `Boost − Boost Target` (kPa; positivo = acima do alvo).
- Ambos são derivados no parse (não dependem das constantes), aparecem como qualquer sinal: Dashboard,
  Gráficos (sidebar/seletor), Dados (coluna + CSV), XY, e entram na ordem agrupada ao lado do par que
  comparam.
- **Renomear o sinal "Turbo Target" para "Boost Target"** (nome no app). A coluna do CSV do ECU
  continua `Turbo Target` — só o nome de exibição/identificador do sinal muda.
- Estado salvo que cita "Turbo Target" (layout dos Gráficos, visibilidade de colunas, escolha do
  XY, sinal do sparkline, faixa personalizada do eixo) passa a apontar para "Boost Target" ao
  restaurar, sem perder a escolha do usuário.
- Logs já salvos são reparseados do CSV guardado (`PARSER_VERSION` 3 → 4) e ganham os dois deltas e o
  novo nome.

## Capabilities

### New Capabilities
<!-- nenhuma: os sinais entram nas capabilities existentes -->

### Modified Capabilities
- `datalog-import`: dois novos sinais derivados; sinal "Turbo Target" passa a se chamar "Boost Target"
  (coluna do CSV inalterada); ordem agrupada atualizada.
- `session-persistence`: reparse de logs antigos passa a cobrir os novos sinais/nome; nome salvo
  "Turbo Target" é migrado para "Boost Target" nas escolhas persistidas.

## Impact

- Código (`frontend/src`): `signals/signalRegistry.ts` (defs, grupos), novo `signals/targetDelta.ts`
  (funções de cálculo), `parsers/datalogParser.ts` (`PARSER_VERSION`), migração de nome nas
  hidratações de `uiStore`, `xyStore`, `timeStore` e `signalRangesStore`
  (via `sessionRestorer.ts`), testes correspondentes.
- Docs: `openspec/specs/datalog-import`, `openspec/specs/session-persistence`,
  `specs/master/datalog.md` (tabela de colunas/derivados), `frontend/CLAUDE.md` (versão do parser).
- Sem impacto no filtro nem na geração de runs de correção (nenhum critério usa os novos sinais), nas
  constantes ou em dependências. O filtro existente `maxDeltaLambdaTarget` (variação do alvo entre
  linhas) é outra coisa e não muda.
