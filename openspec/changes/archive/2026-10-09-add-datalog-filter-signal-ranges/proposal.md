## Why

O filtro do Datalog só limita MAP, RPM, Lambda 1, Lambda Corr, Pedal e CLT. Para isolar pontos
confiáveis (tensão de bateria estável, injetores fora do limite, alvo de lambda e boost em uma faixa
conhecida) o usuário hoje não tem como filtrar por esses sinais.

## What Changes

- O filtro ganha sete faixas (mínimo e máximo, limites inclusivos): **IAT** (ºC), **Batt Volt.** (V), **Inj. DT**
  (ms), **Inj. Utiliz.** (%), **Inj. Pulse** (ms), **Lambda Target** (λ) e **Boost** (kPa).
- Todas nascem **desligadas e sem valor** (mín e máx vazios) no filtro padrão, então o padrão não
  muda e o botão "Filtro" continua ocioso.
- Mesmas regras das faixas existentes: campos travados com o critério desligado, lado aberto quando
  só um limite é preenchido, mínimo > máximo é inválido, ponto sem valor numérico falha quando a
  faixa está ligada, AND com os demais critérios, destaque e geração de run usam a mesma máscara.
- Filtros salvos antes (sessão e receita de runs antigos) continuam carregando: as faixas novas
  entram desligadas e vazias, sem mudar quais pontos passam.

## Capabilities

### New Capabilities

### Modified Capabilities
- `datalog-filter`: a lista de faixas do requisito "Switchable criteria combined with AND" cresce
  em sete sinais; o requisito "Default filter" passa a declará-las desligadas e vazias; a persistência
  garante que filtros salvos sem elas ainda carregam.

## Impact

- `frontend/src/types/filter.ts`: `FILTER_RANGE_SIGNALS` e o padrão (`makeDefaultFilter`); o resto
  (`cloneFilter`, `countEnabled`, `filterError`, `sanitizeFilter`) já itera sobre a lista.
- `frontend/src/utils/filter.ts`, `filterDraft.ts` e `FilterModal.tsx` já são genéricos sobre a lista;
  esperado só testes novos.
- `frontend/src/utils/runRecipe.ts`: `filterChips` precisa tolerar receitas de runs antigos sem as
  chaves novas.
- `frontend/src/features/datalog/DatalogHelpModal.tsx` e `frontend/CLAUDE.md`: texto que enumera as faixas.
- `openspec/specs/datalog-filter/spec.md` (via delta). Sem mudança em parser, correção do mapa VE ou cálculo dos runs.
