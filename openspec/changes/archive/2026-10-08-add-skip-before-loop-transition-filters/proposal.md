## Why

Os pontos logo antes de uma transição de Lambda Loop (a ECU ainda em aberto prestes a fechar a malha, ou fechada prestes a abrir) também são instáveis, mas o filtro do Datalog só sabe descartar os primeiros N pontos **depois** da transição. Hoje não há como tirar o trecho que antecede a transição da correção do mapa VE.

## What Changes

- Dois novos critérios no filtro único do Datalog, ligáveis e em AND com os demais:
  - **Pular N pontos antes de entrar em Closed Loop** — descarta os N pontos imediatamente anteriores a cada transição aberto → fechado (qualquer estado fechado).
  - **Pular N pontos antes de entrar em Open Loop** — descarta os N pontos imediatamente anteriores a cada transição fechado → aberto.
- Contagem sempre **por log** (nunca atravessa a junção de logs concatenados), igual aos "depois" existentes.
- No modal de filtro, a seção "Transições de Lambda Loop" passa a ter **uma linha por tipo de transição (Closed Loop, Open Loop), com "Antes" e "Depois" lado a lado** na mesma linha; cada campo com seu próprio liga/desliga e contagem.
- Os novos critérios nascem **desligados** no padrão (N = 5 em Closed Loop, 10 em Open Loop, os mesmos valores dos "depois"), para o comportamento do filtro padrão e dos filtros já salvos não mudar.
- O filtro novo entra no rascunho, na validação (inteiro ≥ 0), na contagem de critérios ligados, na persistência (`miot:correction-filter`; filtro salvo sem os campos novos cai no padrão desligado) e nos chips da receita do run (`pula N últimos CL`/`OL`).

## Capabilities

### New Capabilities
<!-- nenhuma -->

### Modified Capabilities
- `datalog-filter`: lista de critérios (dois novos "pular antes"), filtro padrão (novos desligados), layout da seção de transições no modal (Antes/Depois lado a lado).
- `mapa-ve-correction`: definição dos filtros de skip por transição de Lambda Loop passa a incluir a variante "antes" (janela de N pontos que antecede a transição).

## Impact

- `frontend/src/types/filter.ts` (`FilterConfig`, padrão, `cloneFilter`, `countEnabled`, `filterError`, `sanitizeFilter`)
- `frontend/src/utils/filter.ts` (novas máscaras "antes", integradas em `evaluateFilterForLog`), `filterDraft.ts`, `filterMigration.ts` (padrão para o formato legado), `runRecipe.ts` (chips; tolerar runs antigos sem os campos)
- `frontend/src/features/datalog/FilterModal.tsx` (layout Antes/Depois)
- Testes colocados ao lado de cada arquivo; `frontend/CLAUDE.md` (descrição do `useFilterStore`) se citar os critérios
- Sem mudança de dados persistidos incompatível: runs existentes não guardam fator nem os novos campos, e continuam válidos.
