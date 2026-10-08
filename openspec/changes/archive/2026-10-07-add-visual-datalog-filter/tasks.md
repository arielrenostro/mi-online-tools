## 1. Avaliação pura do filtro visual

- [x] 1.1 Criar `frontend/src/utils/visualFilter.ts` com os tipos (`VisualRange`, `VisualFilterRanges`) e `evaluateVisualFilter(rows, ranges): boolean[]` (AND dos ranges habilitados, limites inclusivos, `null` = aberto, `NaN` falha o range, nenhum range habilitado = "inativo"). Verificar com `visualFilter.test.ts` ao lado, cobrindo: um range; dois ranges em AND; só min; só max; range habilitado sem limites; linha desabilitada ignorada; valor `NaN`.
- [x] 1.2 Exportar um helper `isVisualFilterActive(ranges)` (≥1 range habilitado) e `hasInvalidRange(ranges)` (min > max em linha habilitada). Verificar com testes no mesmo arquivo de teste.

- [x] 1.3 Estender o filtro com Lambda Loop: `VisualFilterConfig = { ranges, lambdaLoop: { enabled, states } }`, avaliação por pertencimento a `row['Lambda Loop']` em AND com os ranges, `isVisualFilterActive` também ativo só com o Lambda Loop habilitado, e `hasInvalidRange` sinalizando Lambda Loop habilitado sem estado. Verificar com testes em `visualFilter.test.ts` (subconjunto de estados, três estados = tudo passa, linha desabilitada ignorada, combinação com ranges, valor ausente/NaN falha) e em `visualFilterStore.test.ts` (Lambda Loop sozinho ativa o filtro).

## 2. Store de sessão

- [x] 2.1 Criar `frontend/src/store/visualFilterStore.ts` (`ranges`, `apply(ranges)`, `clear()`), sem persistência e sem entrada em `sessionRestorer`. `apply` com nenhum range habilitado equivale a `clear`. Verificar com `visualFilterStore.test.ts` (apply, clear, apply-vazio) e conferindo que nada em `persistence/` o referencia.

## 3. Troca da máscara

- [ ] 3.1 Alterar `frontend/src/hooks/useCorrectionMask.ts` para devolver `evaluateVisualFilter` quando o filtro visual está ativo e `evaluateCorrectionFilters` caso contrário, com `useMemo` independentes para os dois ramos. Verificar que `SyncedChart`, `DataTab` e `DashboardTab` continuam sem alteração de código e que, com o filtro visual ativo, os três refletem a nova máscara (checagem manual em `npm run dev`).
- [x] 3.2 Confirmar que `correctionStore.generate()` e `generateCorrectionSnapshot` não importam nem leem o store do filtro visual. Verificar com `rg visualFilter frontend/src/store/correctionStore.ts frontend/src/utils/correctionGeneration.ts` (sem resultados) e, em teste, que `generate()` produz o mesmo snapshot com o filtro visual ativo e inativo.

## 4. UI: botão e modal

- [ ] 4.1 Criar `frontend/src/features/datalog/VisualFilterModal.tsx` (padrão do `DatalogHelpModal`, Escape fecha): uma linha por MAP, RPM, Lambda 1, Lambda Corr e Pedal com checkbox + min + max, mais uma linha Lambda Loop com checkbox "usar" e checkboxes Aberto / Fechado / Fechado + auto-correção (habilitada sem estado marcado = erro e "Aplicar" desabilitado); rascunho local copiado do store ao abrir; erro visual e "Aplicar" desabilitado quando `hasInvalidRange`; "Aplicar" chama `apply` e fecha; "Limpar" chama `clear` e zera o rascunho. Verificar manualmente: fechar sem aplicar não altera o filtro; reabrir mostra os ranges e estados de Lambda Loop aplicados.
- [ ] 4.2 Em `frontend/src/pages/DatalogPage.tsx`, adicionar o botão "Filtro visual" ao lado do "?" (estilo destacado quando `isVisualFilterActive`), abrindo o modal. Verificar manualmente que o destaque aparece em todas as abas do Datalog e some após "Limpar".

## 5. Verificação integrada

- [ ] 5.1 Com um log carregado, aplicar MAP 80–120 + RPM 3000–4000 (e, num segundo teste, só Lambda Loop = Fechado) e verificar: Gráficos esmaecem/ocultam fora do range (conforme o toggle), Dados esmaece/omite as mesmas linhas, Dashboard marca o cursor fora do range; "Limpar" devolve o esmaecimento dos filtros de correção; recarregar a página deixa o filtro inativo; "Gerar fator de correção" com o filtro ativo gera o mesmo resultado que sem ele.
- [x] 5.2 Rodar `npm run test` e `npm run build` em `frontend/` e verificar que passam.

## 6. Specs

- [ ] 6.1 Ao concluir, sincronizar as specs delta com `openspec/specs/` (`openspec-sync-specs` ou arquivamento) e verificar `openspec validate add-visual-datalog-filter --strict`. Atualizar também o índice de capabilities nos `CLAUDE.md` (raiz e `frontend/`) com a nova `datalog-visual-filter`, e a seção de stores/estrutura em `frontend/CLAUDE.md`.
