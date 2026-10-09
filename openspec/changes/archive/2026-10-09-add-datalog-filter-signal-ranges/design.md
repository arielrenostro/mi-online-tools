## Context

O filtro já trata faixas de forma genérica: `FILTER_RANGE_SIGNALS` (`types/filter.ts`) é a única lista, e
`cloneFilter`, `countEnabled`, `filterError`, `sanitizeFilter`, `toDraft`/`draftErrors`/`draftToFilter`,
`evaluateFilterForLog`, `filterChips` e o grid "Faixas" do `FilterModal` iteram sobre ela. Os nomes são
os de `SIGNAL_DEFS` (já em unidade real): `Batt Volt.` (V), `Inj. DT` (ms), `Inj. Utiliz.` (%),
`Inj. Pulse` (ms), `Lambda Target` (λ) e `Boost` (kPa). `Batt Volt.`, `Inj. DT` e `Inj. Pulse` são
colunas `optional`; `Inj. Utiliz.`, `Lambda Target` e `Boost` são sempre lidas.

## Goals / Non-Goals

**Goals:**
- Sete faixas novas, desligadas e vazias por padrão, com o comportamento das faixas existentes.
- Nenhuma mudança de resultado para filtros e runs já salvos.

**Non-Goals:**
- Valores padrão, presets ou limites sugeridos pelo `min`/`max` do registro de sinais.
- Novos tipos de critério (deltas, janelas) para esses sinais.
- Mudar o filtro do Dinamômetro (`DynoFilterModal`), que é independente.

## Decisions

- **Estender `FILTER_RANGE_SIGNALS` e o padrão, nada mais na lógica.** O tipo `Record<FilterRangeSignal, …>`
  obriga `makeDefaultFilter` a declarar as sete chaves (`range(false, null, null)`), e todo o resto herda.
  Alternativa (estrutura separada para "sinais de injeção") foi descartada: duplicaria validação,
  rascunho, persistência e modal sem ganho.
- **Ordem no modal = ordem do painel lateral dos Gráficos** (`SIGNAL_GROUPS`): RPM, MAP, Boost, Pedal,
  Lambda 1, Lambda Target, Lambda Corr, Inj. Pulse, Inj. DT, Inj. Utiliz., CLT, IAT, Batt Volt. A lista
  é escrita nessa ordem e um teste compara com `sortSignals`, para não divergirem.
- **Sinal ausente no log ⇒ ponto falha** (regra já existente para valor não numérico). Evita aprovar
  silenciosamente pontos de um log sem a coluna; consequência assumida: ligar `Inj. DT` num log sem
  essa coluna zera os pontos que passam, e o contador do modal deixa isso visível.
- **Compatibilidade de filtros salvos:** `sanitizeFilter` parte do padrão e só sobrescreve chaves
  presentes, então filtros antigos já carregam com as faixas novas desligadas — só precisa de teste.
  O ponto de atenção é a **receita dos runs**: ela guarda o `FilterConfig` cru (`RunRecipe.filter`,
  sem `sanitizeFilter`), então `filterChips` deve usar `filter.ranges[sig]?.enabled` para não quebrar
  em runs antigos sem as chaves novas.
- **Chips da receita:** reaproveitam `rangeChip` (`Boost ≥ 120`, `Inj. Utiliz. ≤ 85`); o chip não
  inclui unidade, como nas faixas atuais.

## Risks / Trade-offs

- [Run antigo sem as chaves novas quebra `filterChips`] → acesso opcional + teste com receita antiga.
- [Texto de ajuda e `frontend/CLAUDE.md` enumeram as faixas e ficam desatualizados] → atualizar na
  mesma mudança (regra do projeto: spec e código andam juntos).
- [Modal mais alto com 12 faixas] → a seção já rola (`overflow-y-auto`); sem mudança de layout.
