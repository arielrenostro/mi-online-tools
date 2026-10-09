## 1. Modelo do filtro (`types/filter.ts`)

- [x] 1.1 Adicionar `skipBeforeClosed` e `skipBeforeOpen` (`FilterSkip`) a `FilterConfig`, ao padrão (desligados, n = 5 e 10), a `cloneFilter` e a `countEnabled`; verificar em `types/filter.test.ts` que o padrão os traz desligados, que `filtersEqual` os distingue e que `countEnabled` os conta quando ligados
- [x] 1.2 Estender `filterError` (rótulos "Pular antes de Closed/Open Loop", inteiro ≥ 0) e `sanitizeFilter` (ler as chaves novas; ausentes → padrão desligado); verificar em `types/filter.test.ts` que um filtro salvo sem os campos novos carrega igual ao salvo + novos desligados e que valores inválidos caem no padrão

## 2. Avaliação (`utils/filter.ts`)

- [x] 2.1 Extrair os predicados de transição (entra em fechado / entra em aberto) para reuso e implementar `computeLoopTransitionSkipBeforeMask` + `computeClosedLoopSkipBeforeMask`/`computeOpenLoopSkipBeforeMask`; verificar em `utils/filter.test.ts`: marca os N pontos anteriores, não marca o ponto da transição, limita no início do log, 1↔2 não gera janela, N = 0 não exclui nada
- [x] 2.2 Integrar as duas máscaras em `evaluateFilterForLog` (só calculadas quando ligadas, em AND com os demais); verificar em `utils/filter.test.ts` o filtro completo: "antes" sozinho, "antes" + "depois" excluindo os dois lados, dois logs ativos sem vazar a janela para o log anterior, e o padrão produzindo a mesma máscara de antes

## 3. Rascunho, migração e receita

- [x] 3.1 Em `utils/filterDraft.ts`, incluir as chaves novas em `FilterDraft`, `DraftErrorKey`, `toDraft`, `draftErrors` e `draftToFilter`; verificar em `utils/filterDraft.test.ts` ida e volta `toDraft`→`draftToFilter` e erro quando ligado com texto inválido (e nenhum erro quando desligado)
- [x] 3.2 Garantir que `migrateLegacyCorrectionFilters` devolve os novos desligados e que `filterChips` (`utils/runRecipe.ts`) gera "pula N últimos CL/OL" para os ligados e tolera `recipe.filter` sem os campos; verificar em `utils/filterMigration.test.ts` e `utils/runRecipe.test.ts` (incluindo receita de run antigo, sem exceção)
- [x] 3.3 Verificar em `store/filterStore.test.ts` e `persistence/sessionRestorer.test.ts` que um filtro persistido sem os campos novos é restaurado com eles desligados e com o resto intacto

## 4. Modal (`features/datalog/FilterModal.tsx`)

- [ ] 4.1 Trocar a lista `SKIPS` por duas linhas (Closed Loop, Open Loop), cada uma com blocos "Antes" e "Depois" lado a lado na mesma linha (checkbox + campo numérico + "pontos", `aria-label` completo), ligados a `skipBeforeClosed`/`skipClosed` e `skipBeforeOpen`/`skipOpen`, com `patchNumber` e erros por chave; verificar subindo `npm run dev` e conferindo no navegador: layout em 2 linhas × 2 campos, campo trava com o switch desligado, erro em vermelho com valor inválido e "Aplicar" bloqueado, prévia de pontos muda ao ligar "Antes", "Restaurar padrão" desliga os "antes"

## 5. Specs e documentação

- [x] 5.1 Atualizar `frontend/CLAUDE.md` (descrição do `useFilterStore`: incluir os critérios "pular antes de Closed/Open Loop") e conferir se o `CLAUDE.md` da raiz precisa de ajuste; verificar com `grep -n "skip" CLAUDE.md frontend/CLAUDE.md`
- [x] 5.2 Rodar `cd frontend && npm run test && npm run build` e `openspec validate add-skip-before-loop-transition-filters --strict`; todos devem passar sem erros de tipo
