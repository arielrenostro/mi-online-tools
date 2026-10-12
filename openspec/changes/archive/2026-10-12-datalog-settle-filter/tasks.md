## 1. Tipos e persistência do filtro

- [x] 1.1 Em `frontend/src/types/filter.ts`, adicionar `holdPedal`, `holdMap`, `holdGear`, `stablePedal`, `stableMap` a `FilterConfig` (padrão desligado, limite 5 e n = 25) e cobri-los em `makeDefaultFilter`, `cloneFilter` (ordem estável das chaves), `countEnabled` e `isDefaultFilter`; escrever antes os testes em `types/filter.test.ts` (padrão desligado e contagem do botão inalterada; clone e `filtersEqual` detectam mudança em cada campo) e verificar com `cd frontend && npx vitest run src/types/filter.test.ts`
- [x] 1.2 Em `filterError` e `sanitizeFilter`, validar `value ≥ 0` e `n` inteiro (≥ 0 nos hold-offs, ≥ 2 nas janelas de estabilidade) dos critérios ligados e ler os campos novos com fallback ao padrão desligado; testes: filtro antigo sem as chaves volta idêntico com os critérios desligados, filtro com as chaves é restaurado, valores ilegíveis caem no padrão sem erro (`types/filter.test.ts`, `filterStore.test.ts`)

## 2. Avaliação (TDD)

- [x] 2.1 Em `frontend/src/utils/filter.test.ts`, escrever os testes dos cenários de `mapa-ve-correction`: degrau de Pedal/MAP com hold contado em pontos a partir do último ponto do degrau, rampa lenta sem evento, segundo evento estendendo o hold, troca de marcha (inclusive 2→0→3 e linha sem número), log sem coluna Marcha, hold que não atravessa logs, hold independente de `maxDeltaTps` desligado
- [x] 2.2 Escrever os testes da janela de estabilidade: cruzeiro estável passa, deriva lenta é excluída, início do log sem histórico completo não é excluído, janelas diferentes por sinal, janela não cruza logs
- [x] 2.3 Em `frontend/src/utils/filter.ts`, implementar as máscaras de hold-off (evento via `computeDeltaAmplitude` em `DELTA_WINDOW_MS` + varredura de `lastEventIdx`) e de estabilidade (núcleo de deques extraído de `computeDeltaAmplitude` e usado com janela de N pontos, mantendo o delta de 200 ms por tempo), calculadas só quando o critério está ligado e integradas em `evaluateFilterForLog`; verificar que os testes de 2.1 e 2.2 e os existentes de `filter.test.ts` passam

## 3. Rascunho, modal e receita

- [x] 3.1 Em `frontend/src/utils/filterDraft.ts`, adicionar os campos de rascunho em texto, as chaves de erro e a conversão `toDraft`/`draftErrors`/`draftToFilter`; testes em `filterDraft.test.ts` (limite negativo, pontos negativos, fracionários, não numéricos ou, na estabilidade, menores que 2 marcam erro só quando ligado; ida e volta preserva os valores)
- [x] 3.2 Em `frontend/src/features/datalog/FilterModal.tsx`, criar a seção "Estabilização" (cinco linhas, campos travados quando desligadas, nota de que a detecção de degrau de 200 ms é separada do Máx Delta TPS/MAP) e verificar manualmente no app (`cd frontend && npm run dev`): ligar cada linha, ver a prévia de pontos mudar, erro bloqueando "Aplicar", "Restaurar padrão" desligando tudo
- [x] 3.3 Em `frontend/src/utils/runRecipe.ts`, adicionar os chips dos critérios novos com encadeamento opcional; testes em `runRecipe.test.ts` (chip por critério ligado com seu limite/pontos, receita antiga sem as chaves não quebra)
- [x] 3.4 Atualizar o texto do item de filtro em `frontend/src/features/datalog/DatalogHelpModal.tsx` para citar o hold-off e a estabilidade

## 4. Sessão e specs

- [x] 4.1 Em `frontend/src/persistence/sessionRestorer.test.ts`, cobrir a restauração de um filtro salvo sem os critérios novos (mesmos pontos passam) e de um com eles ligados
- [x] 4.2 Sincronizar as specs principais com os deltas desta change (`datalog-filter` e `mapa-ve-correction`, via `/opsx:sync` ou ao arquivar) e conferir com `openspec validate datalog-settle-filter --strict` que não há divergência
- [x] 4.3 Rodar `cd frontend && npm test && npx tsc --noEmit` e confirmar que toda a suíte e a checagem de tipos passam

## 5. Novo padrão do filtro

- [x] 5.1 Em `frontend/src/types/filter.ts`, ajustar `makeDefaultFilter` (Lambda 1 0,70–1,09; CLT 87; |Δλ×alvo| 0,05; Máx Delta TPS/MAP, `skipOpen` e estabilidade do MAP desligados; descartar após degrau Pedal/MAP 5/15, troca de marcha 15 e estabilidade do Pedal 5/10 ligados), fazer `sanitizeFilter` e `migrateLegacyCorrectionFilters` lerem os critérios de estabilização ausentes como desligados e atualizar os testes (`types/filter.test.ts`, `filterMigration.test.ts`, `runRecipe.test.ts`, `filterDraft.test.ts`, `filterStore.test.ts`, `sessionRestorer.test.ts`); verificar com `cd frontend && npm test`
