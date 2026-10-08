## 1. Sparkline da TimeRail

- [x] 1.1 Extrair a preparação dos dados para uma função pura (ex.: `buildSparkline(rows, signal, buckets)` em `utils/`) que devolve segmentos min/max por bucket, ignorando `undefined`/`NaN` (quebra o segmento) e o min/max da escala. Verificar com testes unitários: pico de 1 amostra num log longo sobrevive; lacuna gera dois segmentos; sinal sem nenhum valor devolve vazio.
- [x] 1.2 Reescrever `SparklineSVG` em `TimeRail.tsx` com `viewBox` fixo, `preserveAspectRatio="none"` e `vector-effect: non-scaling-stroke`, sem `ResizeObserver`/estado de medidas; traço e preenchimento mais visíveis. Verificar no app (`npm run dev`) que a sparkline aparece já na primeira renderização com um log ativo e acompanha a troca de sinal.
- [x] 1.3 Mostrar rótulos de min/max da escala (HTML) na rail e, na `StatusBar`, o valor do sinal no cursor formatado por `SIGNAL_MAP`, com um ponto sobre a linha na posição do cursor (busca binária na linha ≤ cursor). Verificar manualmente arrastando o cursor e com teste da função de busca/valor.

## 2. Modelo de tamanho dos painéis

- [x] 2.1 Em `types/ui.ts`: `ChartPanel.height`, `ChartSplit.ratio` só horizontal; remover `chartsHeight` de `UIState`. Verificar com `npx tsc --noEmit` apontando todos os usos a ajustar.
- [x] 2.2 Implementar funções puras (ex.: `utils/chartLayoutSize.ts`): `layoutHeight`, `resizePanelHeight(layout, panelId, delta)` (regra da linha, design §2), `resizePanelWidth(layout, panelId, delta)` (ratio do split horizontal imediato, clamp 0,15–0,85) e `canResize*` para habilitar/desabilitar botões. Verificar com testes cobrindo: painel único, dois lado a lado, pilha dentro de coluna, aninhados, limites mín./máx., painel sem vizinho horizontal.
- [x] 2.3 Ajustar `uiStore`: `addChartPanel` cria o painel com a altura do de origem (remover `extraHeight`), novas ações `resizePanelHeight`/`resizePanelWidth`, remover `setChartsHeight`/`updateSplitRatio` vertical e `chartsHeight` da persistência. Verificar com testes de store (padrão `mapStore.test.ts`, `persistence` mockado).
- [x] 2.4 Migração em `hydrate` (design, Migration Plan): layout sem `height` → alturas equivalentes a `chartsHeight` × ratios; `chartsHeight` ignorado. Verificar com testes: layout antigo vertical 50/50 com `chartsHeight` 400, antigo só horizontal, já migrado (idempotente), valores inválidos.

## 3. UI de tamanho

- [x] 3.1 `PanelView`: botões `+`/`−` de altura e (só com vizinho horizontal) de largura ao lado de ↔ e +↓, desabilitados nos limites; "+↓" sem `clientHeight`. Verificar manualmente os cenários de `datalog-charts` (altura da linha, largura rouba do vizinho, sem botões de largura em painel sozinho).
- [x] 3.2 `LayoutRenderer`: contêiner raiz com altura em px (sem `100%`), split vertical sem divisor e com `flex-grow` por altura, split horizontal com larguras por `ratio`; remover `VerticalDivider`. Verificar que sem scroll horizontal em nenhum tamanho e que conteúdo mais baixo que a viewport não estica.
- [x] 3.3 `ChartsTab`: remover `ResizeHandle` e o contêiner de altura fixa, mantendo o scroll vertical. Verificar que arrastar a borda entre painéis ou a base da área não altera nada.

## 4. Zoom da seleção ao recriar gráficos

- [x] 4.1 Expor `applySelectionZoom(inst)` no `ChartSyncContext` (mesmo `dispatchAction` do efeito `[selection]`, sob `updatingFromExternal`), e fatorar o efeito existente para usá-lo. Verificar que mover a seleção na TimeRail continua dando zoom nos painéis.
- [x] 4.2 Em `PanelView`, chamar `applySelectionZoom` em `onChartReady` e num `useEffect` `[option]`. Verificar manualmente, com uma seleção ativa: adicionar sinal, remover sinal, 1º sinal num painel vazio, dividir, "+↓", remover painel e mudar filtros — todos os painéis seguem no intervalo selecionado e a seleção da rail não muda.
- [x] 4.3 Conferir que o handler de `datazoom` não limpa a seleção por causa das reaplicações (nenhum `clearSelection` espúrio). Verificar acompanhando a seleção durante os cenários de 4.2.

## 5. Specs e docs

- [x] 5.1 Rodar `openspec validate improve-datalog-chart-layout --strict` e verificar que passa.
- [x] 5.2 Atualizar `frontend/CLAUDE.md` (`useUIStore`: remover `chartsHeight`, descrever altura por painel/`ratio` horizontal; estrutura se surgirem arquivos novos) e conferir que os deltas desta change descrevem o comportamento final antes de `openspec archive`.

## 6. Painéis padrão e escalas de lambda

- [x] 6.1 Layout inicial com os 6 painéis padrão (`buildDefaultChartLayout`, altura 280) usado quando não há layout salvo ou ele é ilegível; verificado por teste do `uiStore` e no app limpo.
- [x] 6.2 Escalas: Lambda 1 e Lambda Target 0,7–1,3; Lambda Corr −30..30 (`signalRegistry.ts`); verificado no app (eixos dos painéis).
