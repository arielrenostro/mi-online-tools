## 1. Tipos e lógica do filtro

- [x] 1.1 Adicionar `IAT`, `Batt Volt.`, `Inj. DT`, `Inj. Utiliz.`, `Inj. Pulse`, `Lambda Target` e `Boost` a `FILTER_RANGE_SIGNALS` e ao `makeDefaultFilter` (desligadas, `min`/`max` `null`); verificar com `npx tsc --noEmit` em `frontend/` sem erros
- [x] 1.2 Em `filter.test.ts` (types), cobrir: padrão com as sete desligadas e vazias, `countEnabled` inalterado no padrão, `filterError` para mín > máx numa faixa nova, `sanitizeFilter` de um filtro antigo (sem as chaves) e de um com as chaves; `npm test` passa
- [x] 1.3 Em `utils/filter.test.ts`, cobrir a avaliação: faixa nova ligada com limites inclusivos, lado aberto, ponto sem valor numérico falha (coluna opcional ausente), faixa desligada ignorada; `npm test` passa
- [x] 1.4 Em `filterDraft.test.ts`, cobrir `toDraft`/`draftToFilter`/`draftErrors` para uma faixa nova (campos vazios, texto inválido, mín > máx); `npm test` passa

## 2. Modal, receita e textos

- [x] 2.1 Conferir no `FilterModal` que as sete faixas aparecem em "Faixas" com unidade (ºC, V, ms, %, ms, λ, kPa), campos travados enquanto desligadas, e que o botão "Filtro" não muda no padrão; verificar manualmente com `npm run dev`
- [x] 2.2 Tornar `filterChips` (`utils/runRecipe.ts`) tolerante a receitas sem as chaves novas (`filter.ranges[sig]?.enabled`) e adicionar teste com receita antiga e com uma faixa nova ligada; `npm test` passa
- [x] 2.3 Atualizar o texto do `DatalogHelpModal` e a descrição de `useFilterStore` em `frontend/CLAUDE.md` para citar as novas faixas; conferir por leitura

## 3. Specs e verificação final

- [x] 3.1 Rodar `openspec validate add-datalog-filter-signal-ranges --strict` sem erros; ao arquivar, `openspec/specs/datalog-filter/spec.md` reflete o delta
- [x] 3.2 Rodar `npm test` e `npm run build` em `frontend/` sem falhas
