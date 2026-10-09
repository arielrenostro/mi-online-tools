## Context

Motivação e escopo em `proposal.md`; comportamento em `specs/datalog-xy/spec.md`. O que já existe e
será só consumido:

- `useDisplayRows()` / `useDisplaySignals()` — linhas dos logs ativos já com os sinais de runtime
  (Potência, Torque, VE Lambda Corrigido) e a lista de sinais comuns. É a fonte de tudo que exibe dados.
- `useFilterMask()` — `boolean[]` alinhado índice a índice com as linhas de exibição (os Gráficos já
  dependem desse alinhamento) e `useFilterStore().showFilteredPoints`.
- `useTimeStore()` — `selection` (intervalo) e `cursor_ms`; `findLastRow(rows, t)` acha a linha do
  cursor por busca binária.
- `SIGNAL_MAP` — `unit`, `min`, `max` e `format` de cada sinal, inclusive os de runtime.
- O padrão de aba do Dinamômetro: `DynoTab` (barra de controles + gráfico), `DynoChart` com
  `buildDynoOption` pura, `dynoStore` com `hydrate` e persistência em `miot:dyno`, restauração em
  `sessionRestorer.ts`, rota em `App.tsx`.

Há outra change em andamento, `improve-datalog-charts-performance`, que mexe em `SyncedChart.tsx`. Esta
change não altera esse arquivo.

## Goals / Non-Goals

**Goals:**
- Nuvem de pontos com X único e vários Y, cada Y com seu eixo, reutilizando filtro, seleção e cursor.
- Mexer no cursor não redesenhar a nuvem; trocar X/Y/filtro refazer sem travar com ~72 mil linhas.

**Non-Goals:**
- Modo linha, suavização, cor por terceiro sinal, regressão — decididos fora da v1.
- Alterar `SyncedChart`, o `dynoCurve` ou qualquer regra do filtro.

## Decisions

### 1. Aba separada, não um tipo de painel de Gráficos
Os painéis de Gráficos giram em torno de um eixo de tempo compartilhado (cursor, tooltip e zoom
sincronizados, layout em árvore persistido). Um painel XY seria exceção em todos esses pontos e
obrigaria a mexer em `ChartLayout`, na migração e em `SyncedChart` (que está em outra change).
*Alternativa descartada:* painel XY dentro do layout — a leitura lado a lado com o tempo não compensa o
acoplamento; a TimeRail, que fica acima de todas as abas, já liga o XY ao tempo.

### 2. Cada Y é um par de séries `scatter`: "passa" e "falha"
Cada sinal Y gera duas séries: pontos que passam o filtro (cor cheia) e que falham (versão esmaecida,
`rgba(...,0.25)` como `dim()` nos Gráficos). Com "Mostrar pontos filtrados" desligado, a série "falha"
não é criada. Isso, em vez de `itemStyle` por ponto, mantém o modo `large: true` do ECharts utilizável
(ele não aceita estilo por item) e permite desenhar os esmaecidos antes dos cheios (`z`) para os que
passam nunca ficarem cobertos. Os dois grupos saem de uma única passada sobre as linhas.
*Alternativa descartada:* uma série por Y com `visualMap`/`itemStyle` por ponto — sem `large`, trava com
dezenas de milhares de pontos.

### 3. Montagem pura e memoizada, separada do cursor
`utils/xySeries.ts` (função pura) recebe `rows`, `mask`, `selection`, `xSignal`, `ySignals` e
`showFilteredPoints` e devolve, por Y, `{ pass: [x,y][], fail: [x,y][] }`; uma linha entra numa série só
se X e aquele Y forem números (spec: "per series"). A seleção de tempo é aplicada aqui comparando
`timestamp_ms` (mesma regra do `selectDynoRows`). O resultado é memoizado por esses insumos — o cursor
**não** é um deles.

O marcador do cursor é uma série `scatter` separada, com `id` estável (um por Y), atualizada por
`chart.setOption({ series: [...] })` (merge) a cada mudança de `cursor_ms`, via ref à instância
ECharts, em vez de reconstruir o `option` inteiro. Isso cumpre "sem redesenhar a nuvem". A linha do
cursor vem de `findLastRow` nas linhas de exibição (inclusive as que o filtro esconde, conforme a spec).

### 4. Eixos: faixa padrão do sinal, lados alternados
Cada eixo (X e cada Y) usa `min`/`max` do `SignalDef`, exatamente como os Gráficos fazem para todo
sinal. Escolha: previsibilidade e leitura comparável entre sessões, em vez de uma escala que muda toda
vez que o filtro muda. *Alternativa:* escala automática pelos dados — mostra melhor a nuvem de sinais
cuja faixa padrão é larga, mas faz o eixo "pular" ao filtrar. Risco do escolhido: valor fora da faixa
padrão é cortado (mesmo comportamento dos Gráficos). Se incomodar, passa a ser opção.

Os eixos Y alternam esquerda/direita (`i` par à esquerda, ímpar à direita) com `offset` de 52 px por
par, para não lotar um lado só; as margens do `grid` crescem com o número de eixos de cada lado. Cores
da paleta dos Gráficos (`PALETTE` de 8 tons): como `sigColor` é local de `SyncedChart.tsx`, a paleta
vai para `utils/signalColor.ts` e a nova aba o importa; **`SyncedChart` só troca sua cópia local por
esse import** (mudança de uma linha, que não conflita com a change de performance). Mais de 8 Y repete
as cores — aceitável, é raro.

### 5. Escala de renderização
Séries com `large: true` e `largeThreshold` baixo (acima de ~2000 pontos), `symbolSize` ~3 e
`animation: false`. Tooltip `trigger: 'item'` mostra `X: nome valor unidade` e `Y: nome valor unidade`
com `format` do `SignalDef`. Sem amostragem: a spec exige todos os pontos.

### 5b. Linha média: curva da média de Y por faixa de X
O pedido é "o valor médio de Y por X" (ex.: pressão de óleo média por RPM), não uma constante. O
checkbox "Linha média" liga, por Y, uma série `line` (`mean-<i>`, no eixo do sinal) cujos pontos são a
média por **faixa de X**: `meanByX(points, xMin, xMax)` agrupa os pontos `pass` em 70 faixas de largura
`(xMax − xMin) / 70` sobre a faixa padrão do sinal X (RPM: 100 rpm, igual ao Dinamômetro; independente
do filtro, para as faixas não "andarem" ao filtrar), e cada faixa com **≥ 3 pontos** vira o ponto
`[média de X, média de Y]`, em ordem crescente de X. O mínimo de 3 evita que uma amostra isolada nas
pontas desenhe um segmento sem sentido. Os insumos são os `pass` (filtro + seleção já aplicados), então
os esmaecidos nunca entram e a curva segue filtro, seleção, X e Y sem lógica extra.

A nuvem tem a cor da série e uma linha da mesma cor some nela: a curva é **tracejada e vermelha**
(`meanLineColor`: `#ef4444`; `#b91c1c` quando a cor da série é o próprio vermelho da paleta, para não
sumir na nuvem), com `shadowBlur` escuro (halo) e `z` acima dos pontos (abaixo do marcador do cursor).
Como com vários Y todas as curvas seriam vermelhas, os marcadores de cada curva levam a **cor do sinal**
(e o tooltip também), o que liga curva e série. Pontos pequenos na linha permitem o
tooltip de item ("média de <sinal>: valor, X: média da faixa"). O dado entra no `option` (muda com os
dados, não com o cursor). Estado `showMean` no `xyStore` (padrão `false`, mesma chave persistida).
*Alternativas descartadas:* linha horizontal na média global (primeira leitura do pedido — não responde "por
X"); média móvel/mediana suavizada como no Dinamômetro (o pedido é a média, e a faixa fixa já suaviza);
largura de faixa pelos dados filtrados (a curva se deslocaria a cada filtro).

### 5c. Linha máxima e mínima: o mesmo cálculo por faixa, outra estatística
"Linha máxima"/"Linha mínima" são o envelope da nuvem por faixa de X. Reaproveitam tudo da média: o
agrupamento é uma função só, `bandCurve(points, xMin, xMax, stat)` com `stat` em `mean | max | min`
(`meanByX` vira um atalho dela); o ponto sai em `[média de X, estatística de Y]` da faixa, com as mesmas
70 faixas e o mínimo de 3 pontos, sobre os `pass`. São séries `line` `max-<i>` / `min-<i>`, **pontilhadas
em cinza-claro** (`#e5e7eb`), com `z` abaixo da média: a média continua a linha principal (vermelha,
tracejada) e o envelope não disputa a cor com a nuvem nem com ela; qual é a máxima e qual é a mínima
fica claro pela posição e pelo tooltip. Estado `showMax`/`showMin` no `xyStore`, independentes de
`showMean`.
*Alternativa descartada:* uma cor por estatística (laranja/azul) — as 8 cores da paleta da nuvem já
cobrem essas tonalidades.

### 6. Estado e persistência
`useXYStore` (`xSignal`, `ySignals: string[]`, `showMean`/`showMax`/`showMin: boolean`) com ações `setX`,
`addY`, `removeY` (qualquer Y sai, inclusive o único — a lista pode ficar vazia; ignora duplicado),
`setShowMean`/`setShowMax`/`setShowMin` e `hydrate`, persistindo em `miot:xy` — mesmo desenho do
`dynoStore`. `hydrate` descarta o que não for `string` e deduplica; **lista salva vazia é uma escolha
válida e volta vazia**, e só dado ausente, não-lista ou lista não vazia sem nenhum nome válido cai no
padrão (RPM / [MAP]). O store **não** filtra por sinais disponíveis: a aba calcula "Y efetivo" = salvos
∩ disponíveis, **sem voltar ao MAP** (lista efetiva vazia mostra a mensagem "adicione um sinal ao eixo
Y" no lugar do gráfico), de modo que um sinal de um log inativo volta quando o log volta (spec: "left out without being deleted").
Restauração em `sessionRestorer.ts` como `restoreXY()`, igual a `restoreDyno()`.

### 7. Rota e cabeçalho
Rota `xy` em `App.tsx` sob `RequireLog`; `TabLink` em `DatalogPage`, que também passa a ordenar as abas Logs, Dados, Dashboard, Gráficos, XY, Dinamômetro (só a ordem dos links; rotas e guards não mudam); `DatalogTab` ganha `'xy'`. Os botões
"Filtro" e "Gerar Correção" só somem em `/dyno` (`endsWith('/dyno')`), então já aparecem no XY sem
código novo. O `DatalogHelpModal` ganha um parágrafo sobre a aba.

## Risks / Trade-offs

- **Faixa padrão corta valores fora dela** → mesmo comportamento dos Gráficos; documentado na decisão 4,
  vira opção se incomodar.
- **Alinhamento máscara × linhas** → o desenho depende dele, assim como `SyncedChart`; teste de unidade
  de `xySeries` cobre máscara e linhas de comprimentos diferentes (ignora o excedente) para não explodir.
- **Muitos Y (>4)** → o gráfico fica espremido; sem limite imposto, o usuário remove. Os chips mostram a
  cor de cada eixo para leitura.
- **Duas séries por Y dobram o número de séries ECharts** → o custo é de pontos, não de séries, e
  `large` cobre; medir com um log de ~72 mil linhas durante a implementação.
- **`setOption` imperativo para o cursor** → quando o `option` memoizado é reaplicado (`notMerge`), o
  marcador precisa ser reaplicado em seguida; o efeito do cursor depende também da instância e do option.
  O `echarts-for-react` aplica o `option` de forma assíncrona na montagem; um `setOption` de merge antes
  disso cria séries sem tipo (`Unknown series undefined`). O primeiro cursor, portanto, vai em
  `onChartReady`, e o efeito só reaplica com a instância pronta e não descartada (achado na verificação).
