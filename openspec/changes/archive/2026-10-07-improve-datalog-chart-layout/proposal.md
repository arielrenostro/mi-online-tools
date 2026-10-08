## Why

Três problemas no Datalog atrapalham o uso diário:

1. "Adicionar painel abaixo" nem sempre dá um tamanho bom: a altura extra é somada ao total, mas o
   novo split é 50/50 dentro do espaço do ancestral, então o painel de origem encolhe e os vizinhos
   crescem sem ninguém pedir. O ajuste hoje é só por arrasto (divisores e alça da base), impreciso.
2. Qualquer interação que recria um gráfico (adicionar/remover sinal, dividir/adicionar painel,
   mudar filtro) devolve o zoom visual a 100%, embora o filtro de tempo continue visível na
   TimeRail. A `selection` só é reaplicada aos gráficos quando ela própria muda; para voltar ao
   zoom o usuário precisa clicar no filtro de novo.
3. A sparkline da TimeRail nunca desenha: o `ResizeObserver` é montado num efeito que roda antes
   do `<svg>` existir (ele só é renderizado depois que `dims.w > 0`), então `dims.w` fica 0 para
   sempre.

## What Changes

- **Tamanho dos painéis por botões.** Cada painel ganha botões `+`/`−` de altura e (quando está
  num split lado a lado) de largura, ao lado dos de dividir. Altura mexe na linha inteira (os
  vizinhos lado a lado acompanham); largura "come" do vizinho, mantendo a soma fixa — nunca há
  scroll horizontal. A área de gráficos rola na vertical quando o total passa da viewport e **não**
  estica quando o conteúdo é mais baixo que ela.
- **BREAKING (UX):** remover o arrasto de redimensionamento — os divisores entre painéis e a alça
  da base da área de gráficos. O estado `chartsHeight` e o `ratio` dos splits verticais deixam de
  existir; a altura passa a ser propriedade do painel. Layouts salvos em `miot:ui` são migrados.
- "Adicionar abaixo" cria o novo painel com a altura do painel de origem, sem alterar os vizinhos.
- **Zoom sobrevive à recriação de gráficos.** A `selection` do store passa a alimentar o `dataZoom`
  do `option` e é reaplicada quando uma instância fica pronta, de modo que todo gráfico — novo ou
  reconstruído — nasce no intervalo selecionado.
- **Painéis padrão.** Sem layout salvo, a aba abre com 6 painéis empilhados (RPM; MAP+Pedal;
  Lambda Target+Lambda 1+Lambda Corr; VE+VE Lambda; Inj. Pulse+Inj. DT+Inj. Efetivo; Batt Volt.).
- **Escalas de lambda.** Eixo de Lambda 1/Lambda Target em 0,7–1,3 e de Lambda Corr em −30..30.
- **Sparkline funcional e mais útil.** Corrigir o bug de medição; traço mais visível; decimação por
  min/max por bucket (picos preservados); valor ausente vira buraco em vez de 0; mostrar o valor do
  sinal no cursor e o min/max da escala.

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
- `datalog-charts`: substitui o requisito de altura ajustável por arrasto por um de tamanho por
  botões (altura da linha, largura entre vizinhos, sem scroll horizontal, sem esticar); ajusta o
  cenário "Adding a panel below"; adiciona o requisito de que o zoom da seleção persiste quando
  painéis/gráficos são recriados.
- `datalog-timeline`: o requisito da sparkline passa a exigir que ela seja efetivamente exibida,
  preserve picos, trate valores ausentes como lacuna e mostre o valor no cursor e a escala.
- `session-persistence`: layout de gráficos salvo passa a conter alturas por painel e `ratio` só
  em splits horizontais, com migração de layouts antigos.

## Impact

- `frontend/src/components/SyncedChart.tsx` — `PanelView` (botões), `LayoutRenderer` (alturas,
  ratios, sem divisores), `buildOption`/`onChartReady` (zoom da seleção). Remove `VerticalDivider`.
- `frontend/src/features/datalog/ChartsTab.tsx` — remove `ResizeHandle` e o contêiner de altura fixa.
- `frontend/src/store/uiStore.ts`, `frontend/src/types/ui.ts` — remove `chartsHeight`/ratio vertical,
  adiciona altura por painel e ações de redimensionar; migração em `hydrate`.
- `frontend/src/components/TimeRail.tsx` — `SparklineSVG` e preparação dos dados.
- Specs: `openspec/specs/{datalog-charts,datalog-timeline,session-persistence}`; `frontend/CLAUDE.md`
  (menção a `chartsHeight` em `useUIStore`).
- Coordenação: `improve-datalog-charts-performance` (em andamento, 0/10) também mexe em
  `SyncedChart.tsx` (`buildOption`, `dataZoom`, janelagem por zoom). Ver `design.md`.
