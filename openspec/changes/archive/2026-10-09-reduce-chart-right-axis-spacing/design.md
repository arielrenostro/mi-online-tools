## Context

`buildOption` (`SyncedChart.tsx`) posiciona o 1º sinal à esquerda e os demais à direita. Antes, o
i-ésimo eixo da direita (i > 1) recebia `offset: (i - 1) * 52` e a grade reservava
`right: rightCount * 52 + 20`. Os rótulos usam fonte 9 px (~5 px por caractere) e a margem padrão do
ECharts entre linha do eixo e rótulo (8 px). Um print do usuário (1ª tentativa, passo fixo de 40 px)
mostrou que um passo fixo continua folgado: os rótulos reais têm 2–3 caracteres (`100`, `1.3`, `30`),
bem menos que os 5 dígitos supostos, e a margem à direita do último eixo sobrava.

## Goals / Non-Goals

**Goals:**
- Cada eixo da direita ocupa só a largura dos seus próprios rótulos; a margem direita da grade é a
  soma exata do que os eixos empilhados ocupam.
- `offset` e `grid.right` saem da mesma função, para nunca divergirem.

**Non-Goals:**
- Mexer em `XYChart`/`DynoChart` ou no tamanho dos painéis.
- Tornar o espaçamento configurável pelo usuário.

## Decisions

- **Largura por eixo, calculada da faixa.** `rightAxisLayout` (`utils/chartAxisLayout.ts`, função
  pura) estima a largura de cada eixo da direita como `traço (5) + margem do rótulo (4) +
  caracteres × 5`, onde os caracteres vêm do maior texto entre `min` e `max` da faixa efetiva do
  sinal (a faixa é fixa — padrão ou sobrescrita —, então o rótulo é previsível, sem medir texto no
  DOM). Sem faixa conhecida, assume 5 caracteres. Alternativas: passo fixo (tentado com 40 px:
  ainda folgado para rótulos curtos e apertado para `10000`); medir o texto renderizado (preciso,
  mas custo e complexidade desnecessários).
- **Posições:** o 1º eixo da direita fica colado na área (offset 0); cada seguinte começa onde
  terminam os rótulos do anterior + 6 px de folga. `grid.right` = fim dos rótulos do último eixo +
  4 px de folga na borda.
- **Sem eixo à direita:** `grid.right` = 20 px, só para o último rótulo do eixo X (centrado na
  borda da área) não ser cortado.
- **`axisLabel.margin: 4`** (era 8) em todos os eixos Y.
- **Esquerda:** `grid.left` = largura do eixo do 1º sinal (mesma fórmula) + 4 px, sem os 52 px fixos.
- **Margem comum a todos os painéis.** `sharedMargins` (`chartAxisLayout.ts`) calcula a margem de cada
  painel (`panelMargins`) e toma o máximo de cada lado; `SyncedChart` a calcula de `chartLayout` +
  faixas e a entrega por `ChartSyncContext` (junto das demais entradas congeladas, então um painel
  escondido não reconstrói), e `buildOption` a recebe como parâmetro opcional (`margins`; sem ela usa
  a do próprio painel). O objeto só muda de referência quando `left`/`right` mudam, para adicionar um
  sinal que não altera o máximo não reconstruir todos os painéis. Alternativa: margem por painel
  (como antes) — mais simples, mas deixa o eixo de tempo e o cursor desalinhados entre painéis.
  Painéis lado a lado também usam a margem global (mais simples que margem por coluna).
- A estimativa de 5 px/caractere é um ponto de partida; ajustar após inspeção visual. Rótulos de
  casas decimais intermediárias (ex.: `0.95` numa faixa 0.9–1.1) são cobertos pela folga de 6 px.

## Risks / Trade-offs

- [Rótulos largos de faixas editadas em Configurações (ex.: `100000`) podem encostar no eixo
  vizinho] → o spec exige "sem sobreposição" para o caso de até 5 dígitos; faixas maiores são
  improváveis e podem pedir um passo maior depois.
- [Adicionar/remover o sinal que define a margem máxima redesenha todos os painéis (em log grande, o
  "Carregando…" cobre todos)] → só ocorre quando o máximo muda; a referência estável de `margins`
  evita o resto.
- [Passo menor deixa os eixos mais "apertados" visualmente] → intencional, é o pedido.
