## Why

O mapa de VE do usuário não tem o valor absoluto de VE correto: a forma da tabela está boa, mas a
escala inteira está deslocada. Hoje o usuário corrige isso em uma planilha Excel por fora (aba "Log"
de `65lbs - *.xlsx`), onde um fator único (`Config!B2`) escala o VE Lambda e daí sai a estimativa de
potência e torque por consumo de combustível. Trazer esse cálculo para o app permite ver a curva de
potência/torque do motor direto dos datalogs, sem exportar para o Excel a cada rodada.

## What Changes

- Nova seção **"Constantes"** na aba Logs, com os campos editáveis: cilindrada (padrão 1587 cc), AFR
  estequiométrico (padrão 9, etanol), BSFC (padrão 0,8) e **"VE atual onde a VE deveria ser 100%"**.
  O usuário olha no mapa a célula onde o VE deveria ser 100% e informa o valor que está lá hoje; o
  app deriva o fator de calibração `k = 100% / VE informado`. Sem campos de MAP/RPM — só o valor.
- Três novos sinais de log, calculados em runtime (dependem das constantes, então não podem ser
  gravados no log persistido): **VE Lambda Corrigido** (`VE Lambda × k`), **Potência** (cv, do motor)
  e **Torque** (kgf·m, do motor), pelo cálculo da planilha usando o VE Lambda Corrigido. Aparecem
  como qualquer outro sinal em Dashboard, Gráficos e Dados.
- Nova aba **"Dinamômetro"** na tela Datalog: gráfico X = RPM com dois eixos Y (potência e torque),
  switch **Roda / Motor** com campo de **perda de transmissão (%)** (padrão 15%), switch
  **Bruto / Suavizado** (suavizado sem spikes) e **campos de filtro próprios** da aba (Pedal mín,
  RPM mín/máx, MAP mín, CLT mín, Lambda Loop, **Marcha**), em AND com a seleção de tempo do TimeRail.
- Novo sinal **Marcha**, lido da última coluna `0` do CSV (0 a 5 nos logs atuais), opcional no parse;
  logs já salvos o ganham ao restaurar (reparse do CSV guardado, sem reimportar).
- Constantes, calibração de VE e configurações do dinamômetro (filtros, switches, perda %) persistem
  entre reloads.
- **Sem impacto no fator de correção do mapa:** "Gerar fator de correção" continua usando o VE
  Lambda **sem** `k`; do contrário o mapa seria reescalado por `k` a cada geração.

## Capabilities

### New Capabilities
- `datalog-constants`: seção Constantes na aba Logs (cilindrada, AFR, BSFC, VE atual → fator `k`),
  validação dos campos e os sinais derivados em runtime (VE Lambda Corrigido, Potência, Torque), com
  a fórmula e o isolamento do fator de correção do mapa.
- `datalog-dyno`: aba Dinamômetro — gráfico potência/torque × RPM, Roda/Motor + perda %,
  Bruto/Suavizado, filtros próprios, comportamento sem dados.

### Modified Capabilities
- `datalog-import`: a aba Logs passa a hospedar também a seção Constantes (além da lista de logs e do
  painel de filtros de correção); o parse passa a ler o sinal opcional Marcha.
- `datalog-table`: o conjunto de colunas padrão passa a incluir os sinais derivados em runtime.
- `navigation-guards`: a rota `/datalog/dyno` exige ao menos um log ativo, como Dashboard/Gráficos/Dados.
- `datalog-visual-filter`: o botão "Filtro visual" fica oculto na aba Dinamômetro (o filtro não tem efeito ali); o filtro em si não muda.
- `session-persistence`: passam a persistir as constantes/calibração e as configurações do dinamômetro;
  logs salvos por uma versão antiga do leitor de CSV (sem Marcha) são reconstruídos do CSV guardado ao restaurar.

## Impact

- `frontend/src/signals/` — nova lista de sinais de runtime (`runtimeSignals.ts`) + fórmula pura de
  potência/torque (`enginePower.ts`); `signalRegistry.ts` passa a expor também esses sinais no
  `SIGNAL_MAP`, mas o parser **não** os calcula nem os grava no `model`.
- `frontend/src/hooks/` — `useDisplayRows`/`useDisplaySignals` substituem `selectAllRows`/
  `selectAllSignals` nos consumidores de exibição (`SyncedChart`, `ChartsTab`, `TimeRail`,
  `DashboardTab`, `DataTab`). `generateCorrectionSnapshot` segue em `flattenActiveRows`, sem os sinais
  novos.
- Novos stores: `constantsStore` (`miot:constants`) e `dynoStore` (`miot:dyno`), mais restauração em
  `sessionRestorer.ts`.
- Nova função pura de suavização/binning por RPM (`utils/dynoCurve.ts`) e filtros do dinamômetro
  (`utils/dynoFilter.ts`), com testes Vitest (vetor de teste: linha 2 da planilha → 9,9765 cv e
  2,7835 kgf·m com `k = 1,18985849`).
- `frontend/src/features/datalog/` — `ConstantsPanel.tsx` (aba Logs) e `DynoTab.tsx`;
  `DatalogPage.tsx`, `App.tsx` (rota) e `types/ui.ts` (`DatalogTab`) ganham a aba nova.
- Coexiste com a mudança em andamento `improve-datalog-charts-performance`: ambas tocam
  `SyncedChart.tsx` (aquela no `buildOption`/windowing, esta só na origem das linhas/sinais). O
  gráfico do dinamômetro é separado do `SyncedChart` (eixo X é RPM, não tempo).
- Specs: novas `openspec/specs/datalog-constants` e `datalog-dyno`; atualizar o índice nos
  `CLAUDE.md` (raiz e `frontend/`).
