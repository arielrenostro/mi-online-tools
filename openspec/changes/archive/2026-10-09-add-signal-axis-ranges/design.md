## Context

Cada `SignalDef` (`signals/signalRegistry.ts`) e cada `RuntimeSignalDef` (`signals/runtimeSignals.ts`)
traz `min`/`max` fixos. `SIGNAL_MAP` (união dos dois) é lido em três lugares que moldam eixos:
`buildOption` em `SyncedChart.tsx` (eixo Y por série), `buildXYOption` em `XYChart.tsx` (eixo X, eixos Y
e o `xRange` das curvas por faixa) e, só para exibição de valor, Dashboard/Dados (que não usam
`min`/`max`). A tela Configurações já tem dois stores persistidos em `localStorage` (`constantsStore`,
`correctionSettingsStore`) com `sanitize*`/`hydrate` e restauração em `persistence/sessionRestorer.ts`.
Ver `proposal.md` para a motivação.

Observado: o spec `datalog-dashboard` diz que valores fora da faixa são destacados no cartão, mas o
`DashboardTab` hoje não usa `min`/`max`. Isso é uma divergência preexistente e fica fora desta change.

## Goals / Non-Goals

**Goals:**
- Uma única fonte da faixa efetiva de cada sinal (padrão do registro + sobrescrita do usuário),
  consumida pelos gráficos de Gráficos e XY.
- Edição imediata, validada por par (min < max), persistida, sem tocar em dados/filtro/runs.
- `buildOption` e `buildXYOption` continuam funções puras e testáveis.

**Non-Goals:**
- Dinamômetro (eixos próprios de potência/torque, `min: 0`) e sparkline da TimeRail (escala pelo trecho).
- Alterar os padrões do registro ou o destaque "fora da faixa" do Dashboard.
- Modo "auto" (eixo seguindo os dados): a faixa é sempre fixa, como hoje.
- Faixa por painel ou por gráfico: é por sinal, global.

## Decisions

**1. Store só com sobrescritas (`store/signalRangesStore.ts`).** Estado `overrides: Record<string,
{min:number; max:number}>`, chave `miot:signal-ranges`. A faixa efetiva é `overrides[name] ?? {min,max}
do SIGNAL_MAP`, via um helper puro `resolveRange(name, overrides)`. Restaurar um sinal = apagar a
chave; sinal igual ao padrão não é guardado. *Alternativa:* guardar a tabela completa — rejeitada,
porque um sinal novo no registro ou um padrão corrigido numa versão futura não chegaria a quem já
tem a tabela salva. API: `setRange(name, min, max)` (ignora par inválido), `resetOne(name)`,
`resetAll()`, `hydrate(saved)`. `sanitizeSignalRanges(saved)` descarta, entrada a entrada, nomes
inexistentes em `SIGNAL_MAP`, não-números, não finitos e `min >= max` (cai no padrão, sem erro).

**2. Gráficos recebem a faixa por parâmetro, não leem o store.** `buildOption(..., view?, ranges?)` e
`buildXYOption(series, xSignal, curves, ranges?)` ganham um último parâmetro opcional `ranges` (o
mapa de sobrescritas; padrão `{}`), e resolvem a faixa com `resolveRange`. Os componentes assinam
`useSignalRangesStore(s => s.overrides)` e o incluem nas dependências do `useMemo` do `option`, de modo
que editar uma faixa redesenha só os gráficos montados. Os testes existentes
(`SyncedChart.test.ts`, `XYChart.test.ts`) continuam valendo sem mudança. *Alternativa:* ler
`useSignalRangesStore.getState()` dentro do builder — rejeitada: esconde dependência e não dispara
redesenho. O mesmo `resolveRange` alimenta o `xRange` das curvas do XY, para que média/máx/mín usem o
mesmo intervalo do eixo X.

**3. Editar a faixa só muda o enquadramento.** Dados, `mask`, runs e tooltips não usam a faixa, então
nada a recalcular. O painel precisa de um redesenho, não de um novo `buildOption` de dados.

**4. UI: `features/settings/SignalRangesPanel.tsx`**, nova seção em `SettingsPage` depois de
Ponderado. Lista `sortSignals([...nomes de DISPLAY_SIGNAL_DEFS])` (ordem agrupada do app, inclui os
de runtime) — sem depender de log carregado. Cada linha: nome + unidade, dois `DraftNumberField` (mín e
máx; aceitam negativo e zero) e um botão "Restaurar" (desabilitado se já é o padrão); cabeçalho com
"Restaurar todas". Regra do par (`min < max`) é entre campos, então a linha guarda os últimos valores
numéricos digitados e válidos de cada campo (`pending`); ao mudar um campo, monta o par com o outro e
só chama `setRange` se `min < max`; caso contrário marca ambos com `forceInvalid` e mostra
"mínimo deve ser menor que o máximo". O último par válido segue no store. Para ir de 0,7–1,3 a 2–3 o
usuário passa por um estado inválido ao editar o mínimo primeiro; é aceitável e comunicado pela mensagem.
"Restaurar todas" remonta as linhas (mesmo padrão de `resetCount` dos outros painéis) para descartar
texto inválido em edição. A seção explica que a faixa só enquadra os eixos. Cada sinal listado usa o
`title` de origem (`signalOriginHint`) já existente para os de runtime, sem novo requisito.

**5. Persistência.** `lsSet('miot:signal-ranges', overrides)` a cada alteração; `sessionRestorer`
ganha `restoreSignalRanges()` no mesmo bloco das constantes, antes de qualquer gráfico desenhar (a
restauração já termina antes das telas serem liberadas — `SessionRestoringSpinner`).

## Risks / Trade-offs

- [Faixa estreita corta a curva e parece "dado sumido"] → a seção diz que só o eixo muda e há
  "Restaurar"; fora de escopo um indicador no gráfico.
- [Conflito de merge com `improve-datalog-charts-performance`, que mexe em `SyncedChart.tsx`/`buildOption`]
  → a mudança aqui é uma linha no mapeamento de `yAxes` + um parâmetro opcional; aplicar depois (ou
  rebasear) sobre a assinatura final de `buildOption` dessa change.
- [Muitas linhas (≈ 25 sinais × 2 campos) na tela] → lista compacta em grade, sem paginação; a página já
  rola.
- [Faixa persistida referencia sinal removido numa versão futura] → `sanitizeSignalRanges` ignora.

## Migration Plan

Aditivo: sem a chave `miot:signal-ranges` todos os sinais usam o padrão atual, então o comportamento
de quem já usa o app não muda. Rollback = remover o painel e as duas leituras; a chave órfã é inerte.

## Open Questions

- Mostrar no painel uma dica "padrão: 0.7–1.3" ao lado de campos editados? Decidir na implementação;
  não altera specs nem tarefas.
