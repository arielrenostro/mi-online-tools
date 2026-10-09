## Context

O filtro único (`FilterConfig`) já tem `skipClosed`/`skipOpen` (`{ enabled, n }`): `computeClosedLoopSkipMask`/`computeOpenLoopSkipMask` em `utils/filter.ts` varrem as linhas de **um log** e, a cada transição (aberto→fechado / fechado→aberto), zeram um contador que exclui os próximos N pontos (inclusive o da transição). O mesmo tipo `FilterConfig` atravessa o rascunho do modal (`filterDraft.ts`), a persistência (`sanitizeFilter`, `miot:correction-filter`), a migração do formato legado (`filterMigration.ts`) e os chips da receita de um run (`runRecipe.ts`). Os runs guardam `recipe.filter` só para exibição, e os já salvos não têm os campos novos. Motivação em `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Dois critérios novos, `skipBeforeClosed` e `skipBeforeOpen`, que excluem os N pontos imediatamente anteriores a cada transição, por log.
- Modal com "Antes" e "Depois" lado a lado por tipo de transição.
- Nenhuma mudança de resultado para filtros existentes (padrão, salvos, runs antigos).

**Non-Goals:**
- Mudar a semântica dos "depois" existentes ou renomear as chaves `skipClosed`/`skipOpen`.
- Janela por tempo (ms): continua em número de pontos, como os existentes.
- Pular "antes" entre logs diferentes ou tratar a junção de logs como transição.

## Decisions

**1. Forma dos dados: dois campos novos do mesmo tipo `FilterSkip`.** `skipBeforeClosed` e `skipBeforeOpen` ao lado dos atuais, em vez de reestruturar para `{ before, after }` por transição. Reestruturar mudaria o formato persistido em `miot:correction-filter` e nas receitas dos runs, exigindo migração para nada ganhar em comportamento; campos novos com valor padrão resolvem por `sanitizeFilter` (ausente → padrão). O pareamento Antes/Depois é só de layout.

**2. Algoritmo "antes": varredura única, sem estado de contagem regressiva.** Uma função `computeLoopTransitionSkipBeforeMask(rows, n, isEntry)` percorre as linhas; ao achar `isEntry(prevLoop, loop)` na linha `i`, marca `i-n … i-1` (limitado a `≥ 0`). Complexidade O(linhas + N × transições), e a linha `i` não é marcada. `isEntry` é o mesmo predicado dos "depois" (extraído para constantes compartilhadas: `entersClosed`, `entersOpen`), garantindo que "antes" e "depois" concordem sobre o que é uma transição, inclusive 1↔2 não contar. Primeira linha do log nunca é transição (`prevLoop` indefinido), igual hoje, o que também impede a janela de vazar para o log anterior (cada log é avaliado isolado).
Alternativa descartada: varrer de trás para frente com contador — mais código para o mesmo resultado.

**3. Padrão desligado, N = 5 / 10.** Ligar por padrão mudaria quais pontos entram em todo run novo e na prévia do filtro padrão. N espelha os "depois" para o usuário que ligar ter um valor razoável.

**4. Compatibilidade de dados antigos.** `sanitizeFilter` já parte de `makeDefaultFilter()` e só sobrescreve chaves válidas; basta incluir as chaves novas no laço. `migrateLegacyCorrectionFilters` parte do padrão, então herda os novos desligados. `filterChips` recebe `recipe.filter` cru de runs persistidos antes da mudança (sem passar por `sanitizeFilter`), então lê os campos novos com `?.` e simplesmente não gera chip se faltarem.

**5. Layout.** Seção "Transições de Lambda Loop" vira duas linhas (Closed Loop, Open Loop), cada uma com um rótulo à esquerda e dois blocos iguais "Antes"/"Depois" (checkbox + campo numérico + "pontos") em `flex` na mesma linha. Rótulos acessíveis completos (`aria-label` "Pular pontos antes de Closed Loop" etc.). Mensagem de erro por campo sob a linha, ligada à chave do critério (`DraftErrorKey` ganha `skipBeforeClosed`/`skipBeforeOpen`).

**6. Contagem de critérios ligados.** `countEnabled` soma os dois novos quando ligados (o botão "Filtro" reflete); `filtersEqual`/`isDefaultFilter` passam a cobri-los via `cloneFilter`.

## Risks / Trade-offs

- [Janelas "antes" e "depois" de transições próximas se sobrepõem e excluem quase tudo] → é o resultado correto do AND; a prévia do modal ("X de Y pontos passariam") torna o efeito visível antes de aplicar.
- [Runs antigos sem os campos quebrarem `filterChips`] → leitura tolerante (`?.`) e teste com receita sem os campos.
- [Largura do modal: duas colunas por linha] → blocos com largura fixa e `flex-wrap` para telas estreitas, mantendo "lado a lado" quando cabe.

## Migration Plan

Sem migração de dados: filtros e receitas salvos continuam válidos e leem os campos novos como padrão desligado. Rollback = reverter o commit; um filtro salvo com os campos novos, lido por uma versão anterior, simplesmente os ignora.
