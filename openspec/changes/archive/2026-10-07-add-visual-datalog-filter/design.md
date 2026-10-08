## Context

Ver `proposal.md` - Why. Hoje `useCorrectionMask()` devolve um `boolean[]` (mesma ordem de
`flattenActiveRows`) calculado por `evaluateCorrectionFilters(logs, filters)`. Três consumidores o
usam: `SyncedChart` (esmaecimento por trecho via `computeRuns`, ou descarte), `DataTab`
(`buildDisplayRows`) e `DashboardTab` (card "excluído"). `generateCorrectionSnapshot` lê `filters`
direto do `correctionStore` e **não** passa pelo hook — esse é o isolamento que o filtro visual
precisa preservar.

`DatalogPage.tsx` já hospeda o botão "?" e o `DatalogHelpModal` (padrão de modal próprio: `open`,
`onClose`, Escape via listener de `window`).

## Goals / Non-Goals

**Goals:**
- Trocar a fonte da máscara em um único ponto (`useCorrectionMask`), sem alterar `SyncedChart`,
  `DataTab` ou `DashboardTab`.
- Garantir, por construção, que o filtro visual não alcança `generate()`.

**Non-Goals:**
- Persistir o filtro visual (IndexedDB/localStorage) ou combiná-lo com os filtros de correção.
- Ranges para sinais além dos cinco pedidos na UI inicial (a avaliação é genérica; só a lista da UI
  é fixa).
- Mudar a renderização do esmaecimento (continua `computeRuns` + 25% de opacidade).

## Decisions

### 1. Troca da máscara dentro de `useCorrectionMask`
O hook lê o filtro visual do novo store; se ativo, devolve `evaluateVisualFilter(rows, ranges)`,
senão `evaluateCorrectionFilters(logs, filters)` como hoje. Os dois ramos são `useMemo` separados
por dependência para não recalcular a máscara de correção (cara: deltas e skips) enquanto só o
visual muda, e vice-versa.

**Alternativa:** um segundo hook `useVisualMask` e um parâmetro novo em cada consumidor. Rejeitada:
três pontos de ramificação em vez de um, e abre espaço para as telas divergirem.

### 2. Store de sessão separado: `useVisualFilterStore`
Estado: `filter: VisualFilterConfig` aplicado, onde `VisualFilterConfig = { ranges:
Record<VisualSignal, { enabled, min: number | null, max: number | null }>, lambdaLoop: { enabled,
states: LambdaLoopState[] } }`, com `apply(draft)` e `clear()`. Sem `persist`, sem entrada em `sessionRestorer`. O rascunho do modal
vive em estado local do componente (`useState`), copiado do store ao abrir — fechar sem aplicar
descarta. "Ativo" = ao menos um range habilitado ou o Lambda Loop habilitado (derivado, não flag separada), o que torna "Aplicar
sem nada marcado" ≡ "Limpar" sem caso especial.

**Alternativa:** estender `correctionStore`. Rejeitada: esse store é o dono do que alimenta o fator
de correção; manter o filtro visual fora dele torna a invariante "nunca afeta `generate()`" óbvia
na leitura do código e dos imports.

### 3. Avaliação como função pura em `utils/visualFilter.ts`
`evaluateVisualFilter(rows, ranges): boolean[]` — AND dos ranges habilitados, limites inclusivos,
limite `null` = aberto, `NaN` falha o range. Pura, testável com Vitest sem DOM (convenção do
projeto). Os cinco sinais são nomes de `SIGNAL_DEFS` (`MAP`, `RPM`, `Lambda 1`, `Lambda Corr`,
`Pedal`); a função aceita qualquer chave de `DatalogRow`.

O Lambda Loop não é um range: é um conjunto de estados (`LambdaLoopState` de `types/correction.ts`,
0/1/2) testado por pertencimento em `row['Lambda Loop']`, como `passesStatelessFilters` já faz para os
filtros de correção. Habilitado com conjunto vazio é inválido (nada passaria), tratado como o
min > max: bloqueia "Aplicar".

Valores comparados são os já convertidos (kPa, RPM, λ, %), os mesmos mostrados na UI — sem conversão
raw, ao contrário do mapa VE.

### 4. Modal e botão
Novo `features/datalog/VisualFilterModal.tsx` seguindo o padrão do `DatalogHelpModal`. O botão entra
em `DatalogPage.tsx` ao lado do "?", com estilo destacado quando `useVisualFilterStore` está ativo.
Validação min > max por linha desabilita "Aplicar".

## Risks / Trade-offs

- [Usuário esquece o filtro visual ativo e interpreta o esmaecimento como filtro de correção] →
  botão destacado em todas as abas do Datalog (requisito da spec).
- [Range estreito gera muitos trechos curtos → muitas séries no ECharts] → o custo já existe para
  filtros de correção ruidosos; é a Open Question de `markArea` em `improve-datalog-charts-performance`.
  Não resolvido aqui.
- [Avaliar o filtro visual é O(n) a cada aplicação em logs de ~72k linhas] → barato (comparações
  simples, sem janelas); roda só ao aplicar/limpar/mudar logs.

## Open Questions

- Se vale persistir o filtro visual depois, se o uso mostrar que recarregar a página o descarta
  demais. Hoje: não, decisão do usuário (efêmero).
