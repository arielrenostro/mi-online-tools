## Context

See `proposal.md` - Why. Estado atual relevante:

- **Tamanho.** `uiStore` guarda `chartsHeight` (altura total, default 400) e cada `ChartSplit` tem
  `ratio` (só o vertical é usado; o horizontal é `flex-1`/`flex-1`, 50/50 fixo). `ChartsTab`
  renderiza `SyncedChart` num `div` de altura `chartsHeight` dentro de um contêiner `overflow-y-auto`
  e uma `ResizeHandle`. "+↓" faz `chartsHeight += painel.clientHeight`, mas o split novo é 50/50 no
  espaço do ancestral.
- **Zoom.** `selection` (timeStore) é a fonte da verdade. Um efeito em `SyncedChart` com dependência
  `[selection]` faz `dispatchAction(dataZoom)` em todas as instâncias registradas. O `option` de cada
  `PanelView` usa `notMerge={true}` e `dataZoom` sem `start`/`end`, então qualquer `setOption`
  reinicia o zoom da instância a 100%; um `PanelView` remontado (a árvore muda de forma ao dividir)
  ou um gráfico que aparece pela primeira vez (painel vazio → 1º sinal) também nasce a 100%.
- **Sparkline.** `SparklineSVG` mede o contêiner via `ResizeObserver` num efeito `[]`, mas só
  renderiza o `<svg>` depois de `dims.w > 0` — circular. Decimação atual: 1 a cada N pontos.

## Goals / Non-Goals

**Goals:**
- Tamanho de painéis previsível, por botões, sem scroll horizontal, sem esticar.
- Zoom da seleção sempre refletido nos gráficos, sem o usuário reselecionar.
- Sparkline que desenha, preserva picos e mostra o valor no cursor.
- Não reconstruir as séries (custo alto em logs grandes) a cada mudança de seleção.

**Non-Goals:**
- Não mexer em janelagem por zoom, `large` mode ou manter a aba montada — é a change
  `improve-datalog-charts-performance`.
- Não mudar o contrato bidirecional seleção ↔ zoom (`datalog-timeline`/`datalog-charts`).
- Não adicionar redimensionamento em pixels de largura (só proporção).

## Decisions

### 1. Altura é do painel (px); largura é proporção do split horizontal
`ChartPanel` ganha `height` (px). `ChartSplit.ratio` passa a existir só para `direction:
'horizontal'` (participação de `children[0]` na largura). `chartsHeight` e o `ratio` vertical somem.

Altura efetiva de um nó: painel → `height`; split vertical → soma dos filhos; split horizontal →
máximo dos filhos. O contêiner raiz tem altura `h(raiz)` em px (nunca `100%`), logo **não estica**
e o `overflow-y-auto` existente cuida de rolar. Dentro de um split horizontal os filhos ocupam a
altura da linha; uma pilha vertical mais baixa que a linha se estica proporcionalmente (`flex-grow`
= altura de cada filho, `flex-basis: 0`), o que é exato quando a soma já iguala a linha.

Largura por proporção (e não px) garante a soma constante: `+` largura em `children[0]` faz
`ratio += 0,1`; em `children[1]`, `ratio -= 0,1`; clamp `[0,15; 0,85]`. Mexe-se no split lado a lado **mais próximo acima do painel** (mesmo que haja uma pilha vertical no
caminho) e, se ele já está no limite, não se sobe para um split de fora; o "vizinho" pode ser um
subgrupo inteiro.

**Alternativa considerada:** largura em px por painel. Rejeitada: a soma deixaria de caber na tela
quando a janela encolhe, reintroduzindo scroll horizontal.

### 2. "Altura mexe a linha": operação pura em `uiStore`/util
`resizePanelHeight(layout, panelId, delta)`: acha a **linha** do painel (sobe enquanto o pai for
split horizontal; o nó mais alto alcançado é a linha), calcula `H' = clamp(h(linha) + delta)` e
aplica `setRowHeight(nó, H', foco)`: painel → `height = H'`; split horizontal → recursa em ambos os
filhos; split vertical → o filho que contém o painel focado absorve a diferença, os demais ficam
iguais (se a linha só tem pilhas, cada pilha ajusta o filho que está no caminho do foco, ou o
último se o foco não está nela). Constantes: passo 100, mín. 150, máx. 1000 por painel.
O caso comum (painéis lado a lado, ou um painel sozinho na linha) reduz-se a "todos recebem `H'`".
Funções puras → testáveis sem DOM, no estilo de `mapEditOps.ts`.

**Alternativa considerada:** deixar cada painel com a altura própria e a linha ser o máximo.
Rejeitada: o `−` no painel mais alto pareceria não fazer nada até igualar com o vizinho.

### 3. "Adicionar abaixo" não altera ninguém
O novo painel entra no split vertical com `height` = altura do painel de origem. Como a altura do
split vertical é a soma dos filhos, nada mais muda — some a lógica `extraHeight`/`clientHeight`.

### 4. Zoom: reaplicar a `selection` por efeito, não via `option`
Colocar `startValue/endValue` no `option` obrigaria a reconstruir todas as séries a cada mudança
de seleção (cada gesto de zoom/arrasto na TimeRail), o oposto do objetivo da change de
performance. Em vez disso, o `PanelView` mantém um ref da seleção atual e chama
`syncCtx.applySelectionZoom(inst)` (a) em `onChartReady` e (b) num `useEffect` com dependência
`[option]` — que roda depois do `setOption` do `echarts-for-react` (efeito do filho precede o do
pai). `applySelectionZoom` faz o mesmo `dispatchAction` do efeito atual (`startValue/endValue`, ou
`start:0,end:100` sem seleção) sob a flag `updatingFromExternal`, para não retroalimentar o store
via o handler de `datazoom`. A flag hoje é liberada em `requestAnimationFrame`; as chamadas novas
usam o mesmo mecanismo. O `setOption` e o `dispatchAction` ocorrem na mesma tarefa, antes do paint,
então não há piscada a 100%.

**Alternativa considerada:** `dataZoom` com `startValue/endValue` no `option`. Rejeitada pelo custo
acima; ainda é a saída se um dia o `option` já depender da seleção (ver coordenação abaixo).

### 5. Sparkline: `viewBox` fixo em vez de medir o contêiner
O `<svg>` passa a ser sempre renderizado com `viewBox="0 0 1000 100"`,
`preserveAspectRatio="none"` e `vector-effect: non-scaling-stroke` — o navegador escala e não há
`ResizeObserver` nem estado de medidas, eliminando a classe de bug.
- **Decimação:** ~800 buckets uniformes no tempo; cada bucket emite seu mínimo e seu máximo, na
  ordem em que ocorrem, para os picos sobreviverem (mesmo princípio de "não esconder transiente"
  da change de performance).
- **Lacunas:** valores `undefined`/`NaN` quebram o traço em segmentos (`<path>` com vários `M`),
  sem desenhar zero. Escala Y por min/max dos valores válidos.
- **Visibilidade:** traço ~0,85 de opacidade e preenchimento ~0,18.
- **Painéis estreitos:** a barra de controles do painel quebra linha (`flex-wrap`) e o painel recorta
  o excedente, para os botões não transbordarem quando a largura chega a 15%.
- **Escala e cursor:** rótulos min/max em HTML (texto SVG distorceria com a escala não uniforme)
  nos cantos da rail; um ponto sobre a linha na posição do cursor e o valor formatado
  (`SIGNAL_MAP.get(sinal).format`) na `StatusBar`, obtido por busca binária na linha ≤ cursor
  (mesma regra de `findLastRow`).

## Risks / Trade-offs

- [Sem arrasto, perde-se ajuste fino] → passo de 100 px / 10% e limites; aceito pelo usuário.
- [Pilha dentro de linha: regra de `setRowHeight` é a mais intricada] → função pura com testes
  para: painel único, 2 lado a lado, pilha em coluna, aninhamentos, clamps.
- [Layouts salvos antigos] → migração em `hydrate` (abaixo); sem `height`, assume-se formato antigo.
- [Reaplicar zoom por efeito depende da ordem de efeitos React/echarts-for-react] → teste manual
  explícito (adicionar sinal, dividir, 1º sinal em painel vazio, mudar filtros com seleção ativa);
  se a ordem falhar, plano B é o `dataZoom` no `option` (decisão 4, alternativa).
- [Coordenação com `improve-datalog-charts-performance`] Ambas mexem em `SyncedChart.tsx`, mas em
  regiões diferentes (esta: `PanelView` controles, `LayoutRenderer`, contexto de zoom; aquela:
  `buildOption` e janelagem). Se a janelagem entrar primeiro, o `option` passa a depender da
  seleção e o efeito `[option]` já cobre a reaplicação; se esta entrar primeiro, a janelagem só
  precisa manter o efeito. Ordem livre; reler `SyncedChart.tsx` antes de aplicar a segunda.

## Migration Plan

`uiStore.hydrate` detecta layout antigo (algum painel sem `height`). Converte percorrendo a árvore
com `H = chartsHeight` salvo (ou 400): split vertical → filho 0 recebe `H·ratio`, filho 1
`H·(1−ratio)`; split horizontal → ambos recebem `H`; folha → `height = round(clamp(H))`. O `ratio`
de splits verticais é descartado; o de horizontais, se ausente, vira 0,5. `chartsHeight` deixa de
ser lido e de ser gravado em `miot:ui`. Idempotente (layout já migrado não é tocado). Rollback: o
formato novo é ignorado por versões antigas (que recaem nos padrões); nenhum dado de log/mapa é
afetado.
