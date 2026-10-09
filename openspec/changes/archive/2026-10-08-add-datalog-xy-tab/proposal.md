## Why

Hoje o Datalog só mostra os sinais contra o tempo (Gráficos) ou contra RPM em um caso fixo
(Dinamômetro). Para entender como um sensor responde a outro — MAP × RPM, Lambda × MAP, Pedal ×
Inj. Pulse — o usuário precisa comparar a olho dois gráficos de tempo. Uma nuvem de pontos XY, que
já respeita o filtro único do Datalog, responde isso diretamente.

## What Changes

- Nova aba **XY** no Datalog (`/datalog/xy`), atrás do guard de log ativo.
- **Nova ordem das abas** do Datalog: Logs → Dados → Dashboard → Gráficos → XY → Dinamômetro (hoje: Logs, Dashboard, Gráficos, Dados, Dinamômetro).
- Um seletor de sinal para o eixo **X** (padrão RPM) e uma lista de sinais para o eixo **Y** (padrão
  MAP), com **um ou mais** sinais; cada sinal do Y tem sua série, sua cor e seu próprio eixo.
- Gráfico de **nuvem de pontos** (sem modo linha de pontos, sem Bruto/Suavizado).
- Checkboxes **Linha média**, **Linha máxima** e **Linha mínima**: traçam, por sinal Y, a curva do valor médio, do maior e do menor Y em cada faixa de X (ex.: pressão de óleo média por RPM), só com os pontos que passam no filtro.
- Qualquer sinal Y pode ser removido, inclusive o único (a aba pede para adicionar um).
- Resumo de pontos na barra da aba e seção da aba na ajuda do Datalog.
- Usa o **filtro único** do Datalog (a mesma máscara dos Gráficos/Dados) e o "Mostrar pontos
  filtrados": pontos que não passam ficam esmaecidos ou são omitidos.
- Respeita o **intervalo selecionado** na TimeRail e destaca o ponto do **cursor**.
- Sinais escolhidos (X e Y) e os checkboxes **persistem** entre reloads.
- Os botões "Filtro" e "Gerar Correção" continuam visíveis nesta aba (a regra existente os esconde
  só no Dinamômetro).

Fora do escopo: modo linha dos pontos, suavização por mediana móvel, cor por um terceiro sinal, regressão/ajuste de curva.

## Capabilities

### New Capabilities
- `datalog-xy`: aba XY — seleção de sinal X e de um ou mais sinais Y, nuvem de pontos com eixo por
  sinal, filtro único e "Mostrar pontos filtrados", intervalo da TimeRail, cursor e persistência da
  escolha.

### Modified Capabilities
- `navigation-guards`: a rota `/datalog/xy` passa a exigir ao menos um log ativo (redireciona para
  Logs), como Dashboard, Gráficos, Dados e Dinamômetro; e passa a existir um requisito com a ordem das
  abas do Datalog.
- `datalog-dyno`: a aba Dinamômetro deixa de ser "depois de Dados" e passa a ser a última, depois de XY.
- `session-persistence`: a lista do que sobrevive a um reload inclui a escolha de sinais da aba XY
  (X e Y), com fallback silencioso para o padrão quando ausente ou ilegível.

## Impact

- Novos: `frontend/src/features/datalog/XYTab.tsx`, `frontend/src/components/XYChart.tsx`, um store
  pequeno `xyStore` (persistência em `miot:xy`), função pura de montagem das séries em `utils/`.
- Alterados: `frontend/src/App.tsx` (rota), `frontend/src/pages/DatalogPage.tsx` (link da aba e nova ordem das abas),
  `frontend/src/types/ui.ts` (`DatalogTab`), `DatalogHelpModal.tsx` (ajuda), `sessionRestorer.ts`
  (restauração do store).
- Sem mudança em `datalog-filter`, `correction-runs`, `datalog-timeline` nem no pipeline do
  Dinamômetro: a máscara e a seleção são só consumidas, e as regras de visibilidade dos botões já
  cobrem a nova aba. Sem dependência nova (ECharts já está no projeto).
