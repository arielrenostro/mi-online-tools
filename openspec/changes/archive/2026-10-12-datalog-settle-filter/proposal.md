## Why

Depois de um transitório (degrau de pedal ou de MAP, troca de marcha, mudança de Lambda Loop) o lambda
leva 2–3 s (20–30 pontos a 10 Hz) para assentar: primeiro fica pobre, a ECU enriquece, e só depois a
correção volta a ~0. Os pontos desse intervalo entram na média da célula e sujam o fator de VE. Hoje o
filtro só enxerga o transitório enquanto ele acontece (delta de Pedal/MAP em 200 ms) e, para o Lambda
Loop, em pontos — nada descarta os pontos pelo tempo de assentamento, e a troca de marcha não é vista.
O usuário só consegue descartar esses trechos olhando o log à mão.

## What Changes

- **Hold-off por evento** (novo): depois de um evento, os próximos N pontos do log são descartados
  (N configurável; a 10 Hz, N = 25 ≈ 2,5 s). Três eventos, cada um com seu próprio critério ligável e
  seu próprio N:
  - **Degrau de pedal** — amplitude do Pedal nos 200 ms anteriores acima de um limite;
  - **Degrau de MAP** — idem para o MAP;
  - **Troca de marcha** — o valor de Marcha difere do da linha anterior.
  A contagem começa no **último** ponto do evento, para um degrau que dura vários pontos só começar a
  contar quando termina. Rampas lentas não disparam o evento, então acelerações contínuas
  (pulls) continuam entrando.
- **Janela de estabilidade** (novo): critérios para Pedal e para MAP — o ponto só passa se a amplitude
  (máx − mín) do sinal nos últimos N pontos ficou abaixo de um limite. Cobre o regime estacionário e
  a deriva lenta, que o hold-off não pega.
- Os cinco critérios novos são independentes, ligáveis em AND com os demais, e ganham uma seção no modal.
- **Novo filtro padrão** (só para quem ainda não tem filtro salvo): Lambda 1 0,70–1,09; CLT ≥ 87;
  Lambda Loop fechado e fechado + auto-correção; Máx |Δ Lambda×Alvo| 0,05; descartar 5 pontos depois de
  entrar em closed loop; descartar após degrau de Pedal e de MAP (degrau 5, 15 pontos) e após troca de
  marcha (15 pontos); estabilidade do Pedal (amplitude 5, janela de 10 pontos). Ficam desmarcados: Máx
  Delta TPS e Máx Delta MAP, o pulo depois de open loop e a estabilidade do MAP.
- Filtros salvos antes (sessão ou receita de run) são lidos com os critérios novos **desligados**, mesmo
  que o padrão novo ligue alguns — passam os mesmos pontos de antes. O filtro antigo no formato legado
  também é convertido com eles desligados. Os chips da receita do run listam os critérios novos quando ligados.
- Sem mudança nos critérios existentes: o delta de 200 ms e os "pular N pontos" por transição de Lambda
  Loop continuam como são. Os critérios novos contam em **pontos**, a mesma unidade dos skips de Lambda
  Loop (e não em segundos), então o valor depende da taxa de amostragem do log.

**Fora de escopo:** Lambda Corr como critério de estabilidade (descartado — com o mapa muito errado
ele varia justamente nas células que precisam de correção, o que as esconderia da correção); salto de
RPM; janela *antes* da troca de marcha; auto-detecção de instabilidade.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `datalog-filter`: novos critérios (hold-off de degrau de Pedal, degrau de MAP e troca de marcha;
  estabilidade de Pedal e de MAP), a seção correspondente no modal, o novo padrão, a leitura
  de filtros salvos sem esses critérios e a validação dos campos.
- `mapa-ve-correction`: definição de evento, de hold-off e de janela de estabilidade (ao lado das
  definições de delta de TPS/MAP e dos skips de transição), incluindo tratamento por log, histórico
  insuficiente e log sem coluna de Marcha.

## Impact

- Código: `frontend/src/types/filter.ts` (tipos, padrão, clone, igualdade, contagem, validação,
  `sanitizeFilter`), `frontend/src/utils/filter.ts` (máscaras de hold-off e de estabilidade, reuso de
  `computeDeltaAmplitude`), `frontend/src/utils/filterDraft.ts`, `frontend/src/features/datalog/FilterModal.tsx`,
  `frontend/src/utils/runRecipe.ts` (chips) e o texto de ajuda em `DatalogHelpModal.tsx`.
- Testes: `filter.test.ts`, `types/filter.test.ts`, `filterDraft.test.ts`, `runRecipe.test.ts`,
  `filterStore.test.ts`, `sessionRestorer.test.ts`.
- Dados: o filtro persistido (localStorage) e a receita de cada run ganham campos opcionais; leitura
  retrocompatível, sem migração de banco.
- Desempenho: até cinco passadas O(n) a mais por log, só quando o critério está ligado.
- Sem backend, sem novas dependências. Independe da change `ve-correction-per-point-ratio` (outros
  arquivos).
