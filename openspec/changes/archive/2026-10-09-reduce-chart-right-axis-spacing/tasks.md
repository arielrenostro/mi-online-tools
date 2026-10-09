## 1. Espaçamento dos eixos

- [x] 1.1 Em `SyncedChart.tsx`, usar `axisLabel.margin: 4` e `offset`/`grid.right` vindos de `rightAxisLayout`; verificar com `SyncedChart.test.ts` (1º eixo da direita com offset 0, offsets crescentes, `grid.right` = 20 sem eixo à direita e < 60 com um)
- [x] 1.2 Criar `utils/chartAxisLayout.ts` (`rightAxisWidth`, `rightAxisLayout`, funções puras) e verificar com `chartAxisLayout.test.ts` (largura cresce com o rótulo mais largo da faixa, eixos empilham pelo fim dos rótulos do anterior + folga, `grid.right` = fim do último eixo + folga)
- [x] 1.3 Em `chartAxisLayout.ts`, adicionar `panelMargins` (esquerda = eixo do 1º sinal, sem 52 px fixos) e `sharedMargins` (máximo por lado, ignora painéis vazios); verificar com `chartAxisLayout.test.ts`
- [x] 1.4 Em `SyncedChart.tsx`, calcular `margins` de `chartLayout` + faixas (referência estável por valor), entregar por `ChartSyncContext` e passar a `buildOption(..., margins)`; verificar com `SyncedChart.test.ts` (grid usa as margens recebidas; esquerda < 52)
- [x] 1.5 Rodar `npm run test`, `npx tsc --noEmit` e `npm run build` em `frontend/` e verificar que passam

## 2. Verificação visual e spec

- [x] 2.1 Rodar `npm run dev`, abrir Gráficos com painéis de 2, 3 e 4+ sinais (ex.: RPM, MAP, Pedal, Lambda 1) e verificar visualmente que os rótulos não se sobrepõem e que não sobra espaço entre os eixos nem até a borda direita; ajustar as constantes de `chartAxisLayout.ts` se necessário
- [x] 2.2 Sincronizar `openspec/specs/datalog-charts/spec.md` com o delta (requisitos "Right-side Y axes are compactly spaced" e "Plot areas line up across panels") e confirmar com `openspec validate reduce-chart-right-axis-spacing`
