## Context

Hoje a correção do mapa VE atravessa duas telas através de estado ambiente: `logStore` (logs ativos),
`correctionStore` (`draftFilters`/`filters`/`snapshot`/`isStale`), `timeStore` (seleção na timeline
concatenada) e `mapStore` (breakpoints). O snapshot é uma única linha `correction-snapshot/last` no
IndexedDB, apagada por `mapStore.loadMap`. Os filtros existem em duas implementações
(`utils/correctionFilters.ts` — sempre ligados, com janela móvel e contadores de transição — e
`utils/visualFilter.ts` — faixas opcionais), escolhidas por `useCorrectionMask()`. Não existe
componente de toast. As Constantes vivem na aba Logs (`ConstantsPanel`) e os sinais que dependem
delas são os de `runtimeSignals.ts`. Motivação e escopo: ver `proposal.md`; comportamento: ver os
specs desta change.

## Goals / Non-Goals

**Goals:**
- Um run é um valor imutável e autocontido; nada de estado ambiente decide o que ele mostra.
- Um único avaliador de filtro e uma única máscara para exibição e geração.
- Datalog produz runs, Tuning os consome; o run é o único contrato entre as telas.
- Migração sem perda do snapshot e do filtro de correção já salvos.

**Non-Goals:**
- Reprojetar um run para breakpoints diferentes, ou regerá-lo depois (o run não guarda dados brutos).
- Versionar o mapa / ligar runs a "versões" do mapa (decidido: fora de escopo).
- Unificar os filtros do Dinamômetro com o filtro único.
- Mudar a atribuição bilinear, as estatísticas por célula ou a fórmula de VE Lambda.
- Gerar Correção sem mapa carregado (os breakpoints são necessários — ver Open Questions).

## Decisions

**1. Dois stores em vez de um `correctionStore` gordo.** `filterStore` (filtro aplicado,
`showFilteredPoints`) e `correctionStore` (histórico de runs, `selectedRunId`). `visualFilterStore` é
removido. Motivo: o filtro é entrada de máscaras (Dashboard/Gráficos/Dados) que nada têm a ver com
runs, e o histórico não deveria re-renderizar o gráfico. Alternativa descartada: manter tudo em
`correctionStore`, como a proposta sugeria — acoplaria de novo as duas rotinas que se quer separar.
`filterStore` não tem `draft`: o rascunho é `useState` local do corpo do modal, que só é montado enquanto o
modal está aberto (cada abertura parte do filtro aplicado e descartar ao fechar sai de graça; some o
`useBlocker` da `LogsTab`).

**2. Modelo do filtro único** (`types/filter.ts`): um objeto com um critério por chave, cada um com
`enabled`:
```
ranges      : Record<MAP|RPM|Lambda 1|Lambda Corr|Pedal|CLT, { enabled, min|null, max|null }>
lambdaLoop  : { enabled, states: (0|1|2)[] }
maxDeltaTps : { enabled, value }     maxDeltaMap : { enabled, value }
maxDeltaLambdaTarget : { enabled, value }
skipClosed  : { enabled, n }         skipOpen    : { enabled, n }
```
`evaluateFilter(logs, filter)` substitui `evaluateCorrectionFilters` e `evaluateVisualFilter`,
reaproveitando `computeDeltaAmplitude` e `computeLoopTransitionSkipMask`, que só rodam quando o
critério está ligado (custo hoje sempre pago passa a ser opcional). Máscara memoizada por
`(logs, filter)` num único hook (`useFilterMask`, substitui `useCorrectionMask` sem o ramo visual).
`DEFAULT_FILTER` reproduz os valores de `DEFAULT_CORRECTION_FILTERS` com as faixas novas desligadas.
O critério de CLT vira uma faixa (só mínimo no padrão) para ficar uniforme com as demais.

**3. Modelo do run** (`types/correction.ts`):
```
CorrectionRun { id, name, createdAt,
                breakpoints: { map: number[], rpm: number[] },
                cells: CorrectionCell[][],          // n/mean/median/mode, como o snapshot de hoje
                recipe: { logs: { hash|null, filename, range: {start_ms,end_ms}|'full'|'unused' }[],
                          filter: FilterConfig | null } }
```
`CorrectionSnapshot`/`generateCorrectionSnapshot` seguem como o núcleo de cálculo; o run o embrulha.
`recipe.logs[].hash` é nulo só no run migrado do snapshot antigo (que gravava apenas nomes), e esse run também carrega `recipe.globalTimeRange` (o intervalo único na timeline concatenada que o app antigo gravava, sem como dividi-lo por log). O recorte
por log é calculado na geração a partir dos offsets da timeline concatenada (`flattenActiveRows` já os
conhece), pois a seleção em ms globais perde o sentido se os logs forem reordenados depois. O fator
continua derivado na leitura (`computeFactorGrid`), agora contra os breakpoints do run — por isso a
compatibilidade é só `breakpointsEqual(run.breakpoints, originalMap)`.

**4. Histórico: array ordenado do mais novo ao mais antigo, corte FIFO em 10 dentro da ação de
gerar.** Persistência: nova store IndexedDB `correction-runs` (keyPath `id`), banco v3→v4; o run
selecionado em `localStorage` (`miot:correction-selected-run`) e o filtro em `miot:correction-filter`
(chave nova, formato novo; a antiga `miot:correction-filters` é lida só para migrar e depois removida).
A store `correction-snapshot` fica órfã, como `tuning-output`/`tuning-history` já ficam (convenção
existente do `db.ts`).

**5. Migração do snapshot "last".** Em `sessionRestorer`, `restoreCorrection` passa a rodar **depois**
de `restoreMap` (hoje todos rodam em paralelo em `Promise.allSettled`): se a store de runs está vazia e
existe `last`, cria o "Run 1" usando os breakpoints do mapa restaurado — válido porque o `loadMap`
antigo apagava o snapshot a cada mapa novo, então o snapshot sempre correspondeu ao mapa carregado. Se
não houver mapa restaurado, o snapshot antigo é descartado (não dá para conhecer seus breakpoints).
Depois da migração a chave `last` é apagada para não migrar duas vezes. Filtros antigos → filtro novo:
Lambda min/max → faixa de Lambda 1 ligada; `minClt` → faixa de CLT; `lambdaLoop` com 3 estados →
critério desligado, senão ligado; skips com 0 → desligados; deltas e |Δ λ×alvo| ligados.

**6. Gerar no cabeçalho do Datalog.** Um componente `GenerateCorrectionButton` ao lado de
`FilterButton` e do "?" no `DatalogPage`, ambos ocultos em `/datalog/dyno` (mesma lógica que já
esconde o Filtro visual). Ele lê `filterStore`, `logStore`, `timeStore` e `mapStore` só na hora do
clique no botão para abrir o `GenerateCorrectionDialog`, que mostra o resumo (pontos que passam = contagem da máscara, dentro da seleção só quando o switch do intervalo está ligado) e chama `generate({ useTimeSelection })`. Sem mapa, fica
desabilitado (ver Open Questions).

**7. Toast e indicador.** Um `toastStore` mínimo + `ToastHost` montado no `RootLayout`, com ação
opcional que navega (`useNavigate`) só quando clicada — respeita "No automatic navigation". O
indicador no item Tuning da `TopBar` vem de uma flag `hasUnseenRun` em `correctionStore`, zerada ao
abrir `/tuning/ve`. Alternativa descartada: reutilizar o `ConfirmDialog` — é modal e bloqueante.

**8. Filtro em modal, com rascunho local.** `FilterModal` junta `VisualFilterModal` e
`CorrectionFilterPanel`: estado `draft` em `useState`, inicializado a cada abertura a partir do filtro
aplicado; "Aplicar" chama `filterStore.apply`; "Restaurar padrão" põe `DEFAULT_FILTER` no rascunho;
a prévia mostra `evaluateFilter` do rascunho (memoizada, só enquanto o modal está aberto) ao lado da
contagem do aplicado. "Mostrar pontos filtrados" age direto no store (sem rascunho).

**9. Seção de correção na VE.** `CorrectionSection` deixa de retornar `null`: sem runs mostra o texto
explicativo + link para `/datalog`; com runs mostra o seletor (renomear inline, excluir com
`ConfirmDialog`), os chips da receita e as três tabelas. Um run incompatível substitui as tabelas por
um aviso. Os runs ordenam-se por data; selecionar não reordena.

**10. Configurações.** Nova rota `settings` (sem guard) e `SettingsPage` com o `ConstantsPanel`
movido; item "Configurações" na `TopBar`. Hover: um helper `signalOriginHint(name)` baseado em
`RUNTIME_SIGNAL_NAMES` devolve o texto (ou `undefined`), aplicado como `title` nos cartões do
Dashboard, na sidebar/seletor de Gráficos e no cabeçalho/menu de colunas de Dados. Nota discreta no
`DynoTab` com `Link` para a rota de configurações.

## Risks / Trade-offs

- [Gerar sem mapa carregado fica impossível, e o usuário percebe isso como "acoplamento"] → botão
  desabilitado com mensagem clara; ver Open Questions.
- [Uma faixa ligada esquecida restringe o próximo run] → resumo no diálogo de confirmação, chips da receita no run,
  "Restaurar padrão" e botão de filtro destacado quando difere do padrão (mitigações já nos specs).
- [Semântica de NaN muda: hoje `NaN < x` é falso e o ponto passa nos filtros de correção; o spec novo
  faz o ponto falhar o critério ligado] → afeta só linhas sem CLT/Lambda numérico, raro; coberto por
  teste do avaliador.
- [Migração depende do mapa restaurado] → pior caso: o snapshot antigo é descartado em vez de virar
  Run 1; documentado e testado.
- [Runs gravam receita com `filter` completo; o formato do filtro pode evoluir] → `recipe.filter` é só
  para exibição e tolera formato desconhecido (mostra "—"), nunca é reavaliado.
- [Banco v4 não tem rollback] → a store antiga continua intacta (órfã); voltar a uma versão antiga do
  app ainda enxerga o snapshot "last" desde que a migração não o tenha apagado — por isso a migração
  só apaga `last` depois de gravar o Run 1.

## Migration Plan

1. Subir `miot-db` para v4 (criar `correction-runs`).
2. No primeiro restore: migrar snapshot "last" → Run 1 e `miot:correction-filters` →
   `miot:correction-filter` (ordem: depois de `restoreMap`).
3. Remover as chaves/stores antigas só depois de gravar as novas.
4. Atualizar `CLAUDE.md` raiz e `frontend/CLAUDE.md` (tabela de capabilities, seções de Stores e de
   Correção VE) na mesma mudança de código, e ajustar o `## Purpose` dos main specs
   `datalog-import` e `datalog-constants` ao arquivar (o Purpose não passa por delta).

## Open Questions

- Gerar Correção exige mapa (breakpoints). Se o uso real mostrar que o usuário quer gerar antes de
  importar um mapa, dá para oferecer um seletor de "grade" (breakpoints) no popover do botão, sem mudar
  o formato do run. Fica para depois da primeira versão.
- Medir o custo de `evaluateFilter` com critérios de janela ligados em logs grandes; se a prévia do
  modal ficar lenta, atrasar a prévia (debounce) sem mudar o comportamento.
