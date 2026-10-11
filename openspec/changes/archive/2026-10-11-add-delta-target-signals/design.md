## Context

Sinais vivem em `frontend/src/signals/signalRegistry.ts` (`SIGNAL_DEFS`). Um `SignalDef` com `column` é
lido do CSV; um com `compute` é derivado no parse (`VE Lambda`, `Inj. Efetivo`), opcionalmente com
`inputs`. Derivados do parse são gravados no `model` do log; os que dependem das constantes são de
runtime (`runtimeSignals.ts`) e nunca gravados. `Boost`, `Lambda 1`, `Lambda Target` e `Turbo Target`
são colunas **obrigatórias** do CSV, então os dois deltas existem em todo log.

O nome do sinal é também o identificador: chave em `DatalogRow`, em `model.signals`, no layout dos
Gráficos, em `columnVisibility`, no XY, no sparkline e nas faixas personalizadas (`miot:*` no
localStorage). Logs salvos são reparseados do `csvBlob` quando `parserVersion` < `PARSER_VERSION`.

## Goals / Non-Goals

**Goals:**
- Os dois deltas e o rename com o mínimo de superfície: a UI já itera `DISPLAY_SIGNAL_DEFS`, então
  Dashboard, Gráficos, Dados e XY devem passar a mostrá-los sem mudança de componente.
- Nenhuma escolha persistida do usuário se perde no rename.

**Non-Goals:**
- Usar os deltas no filtro ou na geração de correção.
- Mudar o nome da coluna do CSV (`Turbo Target` continua sendo o que a ECU grava).
- Renomear o critério `maxDeltaLambdaTarget` do filtro (variação do alvo entre linhas, outro conceito).

## Decisions

**1. Deltas como derivados do parse, não de runtime.** Dependem só de colunas do CSV, não de
constantes; então ficam no `SIGNAL_DEFS` com `compute` (padrão de `Inj. Efetivo`), gravados no `model`.
Alternativa (runtime) descartada: recalcularia a cada leitura sem motivo. Sem `inputs`, pois as
entradas são colunas obrigatórias. Funções em `signals/targetDelta.ts` (um arquivo por fórmula, como
`injectionEffective.ts`). Subtração direta, sem clamp, como `Inj. Efetivo`.

**2. Convenção de sinal "medido − alvo".** Positivo = mais pobre / boost acima do alvo. É o sentido
natural de "delta X target" e igual ao do `Lambda Corr`. Registrado na spec.

**3. Nomes exatos pedidos:** `Delta Lambda 1 Target` e `Delta Boost Target`. Faixas de eixo padrão:
−0,3…+0,3 λ e −50…+50 kPa (simétricas em torno de zero, editáveis em Configurações). Formato com
sinal explícito (`+0.012`, `+12 kPa`), como `Lambda Corr`/`dACC`.

**4. Rename só no nome do sinal.** `SignalDef` passa a `name: 'Boost Target', column: 'Turbo Target'`;
o `column` já é separado de `name`, então o parser não muda de lógica. `specs/master/datalog.md` (formato
do CSV) mantém `Turbo Target`, com nota do nome no app.

**5. Migração do nome salvo por um mapa único.** `LEGACY_SIGNAL_NAMES = { 'Turbo Target': 'Boost Target' }`
e `canonicalSignalName(name)` no registro, aplicada nos pontos que já sanitizam estado salvo:
`signalRangesStore.sanitizeSignalRanges` (hoje descartaria a faixa por nome desconhecido),
`xyStore.sanitizeXYSettings` (com dedupe), `sparklineSensor` em `restoreTime`, e na hidratação do
`uiStore` (`columnVisibility` e `signals` de cada painel do `chartLayout`, com dedupe).
Alternativa (aceitar os dois nomes em todo lugar) descartada: espalha o nome antigo pelo app.
O mapa permite futuros renames sem novo código.

**6. `PARSER_VERSION` 3 → 4.** Regrava os logs com `Boost Target` e os deltas via o
`upgradeLogEntry` existente; sem mudança nessa função. Os `Run`s de correção não usam esses sinais e
não são tocados (nunca são invalidados).

**7. Grupos de exibição.** `['RPM','MAP','Boost','Boost Target','Delta Boost Target']` e
`['Lambda 1','Lambda Target','Delta Lambda 1 Target','Lambda Corr','Lambda Loop']`; o teste que casa
`FILTER_RANGE_SIGNALS` com `SIGNAL_GROUPS` continua válido (os deltas não entram no filtro).

## Risks / Trade-offs

- [Linhas de log gravadas ficam maiores (2 números a mais)] → desprezível frente às ~25 colunas já gravadas.
- [Algum ponto de persistência que cite o nome antigo escapar da migração] → varredura por
  `Turbo Target` em `src/` na implementação e testes por store; sinal desconhecido já é ignorado
  sem erro pelos consumidores, então o pior caso é a escolha voltar ao padrão.
- [Painel com `Delta Lambda 1 Target` e `Lambda 1` juntos: eixos de escalas bem diferentes] → o eixo é
  por sinal (já suportado), sem ação.
- [Reparse de logs grandes no primeiro restore] → mesmo custo de bumps anteriores do parser.

## Migration Plan

Automática no primeiro carregamento: logs reparseados do CSV guardado, estados `miot:*` normalizados
na hidratação. Reverter o código deixaria `model.signals` com nomes que a versão antiga ignora, mas os
logs seriam reparseados de novo pelo parser antigo só se a versão fosse maior — aceitável, o app é
single-user e client-side.
