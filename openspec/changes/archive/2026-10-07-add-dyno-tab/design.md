## Context

Ver `proposal.md` - Why. Pontos do código atual que moldam a abordagem:

- Sinais derivados hoje (`VE Lambda`) são `SignalDef.compute(row)`: calculados **no parse**, uma vez, a
  partir da própria linha, e gravados no `model` persistido no IndexedDB. Isso não serve para
  Potência/Torque/VE Lambda Corrigido: dependem de constantes editáveis em runtime.
- Os consumidores de exibição (`SyncedChart`, `ChartsTab`, `TimeRail`, `DashboardTab`, `DataTab`) leem
  as linhas por `useLogStore(selectAllRows)` e os nomes por `selectAllSignals`.
  `generateCorrectionSnapshot` e `useCorrectionMask`/`evaluateCorrectionFilters` leem `logs`/
  `flattenActiveRows` direto, **sem** passar por `selectAllRows` — esse corte natural é o que isola o
  fator de correção do mapa das novas constantes.
- A fórmula vem da aba "Log" de `65lbs - *.xlsx` (colunas AL/AM/AN). O `k` da planilha é lido de outro
  arquivo (`Config!B2` externo, 1,18985849 no cache da `65lbs - 23`); o vetor de teste do spec
  (MAP 35, RPM 2567, IAT 50 ºC, λ 0,998, VE Lambda 59,225%) reproduz 9,9765 cv / 2,7835 kgf·m com esse `k`.
- Persistência de preferências leves segue o padrão `lsSet`/`lsGet` + hidratação em
  `sessionRestorer.ts` (`miot:ui`, `miot:time`, ...).

## Goals / Non-Goals

**Goals:**
- Sinais dependentes de constantes **sem** tocar o `model` persistido nem o parser.
- Reaproveitar `SIGNAL_MAP` para formatação/unidade/faixa, para os sinais novos aparecerem em
  Dashboard/Gráficos/Dados com o mínimo de código novo.
- Cálculo de potência/torque e curva do dinamômetro como funções puras, testáveis com Vitest sem DOM.
- Garantir, por construção, que `generate()` não vê as constantes.

**Non-Goals:**
- Ler/editar o mapa a partir da calibração (o campo VE é só um número digitado; MAP/RPM foram
  descartados de propósito).
- Mostrar picos (potência/torque máximos e RPM) ou comparar duas rodadas — fica para depois.
- Zoom/pan no gráfico do dinamômetro e exportar a curva.
- Unidades alternativas (hp, kW, N·m) — só cv e kgf·m.

## Decisions

### 1. Sinais de runtime numa lista separada, calculados na leitura
Nova `RUNTIME_SIGNAL_DEFS` em `signals/runtimeSignals.ts`: só metadados de exibição `{ name, unit, min, max,
defaultVisible, tableWidth, format }`; o cálculo fica em `applyRuntimeSignals(row, ctx)` (`ctx = { constants,
k }`), que preenche os três valores de uma vez — Potência e Torque saem da mesma conta, então um `compute`
por sinal chamaria `computeEnginePower` duas vezes. `signalRegistry.ts` passa a
montar `SIGNAL_MAP` com `SIGNAL_DEFS` **e** `RUNTIME_SIGNAL_DEFS` (para `format`/`unit`/faixa por nome),
e exporta `DISPLAY_SIGNAL_DEFS = [...SIGNAL_DEFS, ...RUNTIME_SIGNAL_DEFS]` (usada pela tabela Dados).
O parser continua filtrando só `SIGNAL_DEFS` — os sinais de runtime **não** entram em `ALL_SIGNALS`
nem no `model`.

**Alternativa A:** `compute(row)` no parse como `VE Lambda`. Rejeitada: o `model` persistido ficaria
com valores de constantes antigas; mudar uma constante exigiria reparsear todos os blobs.
**Alternativa B:** reparsear quando uma constante muda. Rejeitada: cara (dezenas de milhares de linhas
por log) e reescreve o IndexedDB a cada tecla.

Ordem de cálculo por linha: `VE Lambda Corrigido = VE Lambda × k`; depois Potência (usa o corrigido) e
Torque (usa Potência).

### 2. `useDisplayRows()` / `useDisplaySignals()` com cache compartilhado
Um módulo `signals/displayRows.ts` guarda **uma** entrada de cache `{ logs, constants } → rows`
(comparação por referência). `useDisplayRows()` = `useMemo` sobre `logs` (logStore) e `values`
(constantsStore) chamando `getDisplayRows(logs, constants)`; assim 5 componentes montados compartilham
o mesmo array em vez de cada um refazer o `flattenActiveRows` + enriquecimento (72k linhas num log de 2h).
`getDisplayRows` = `flattenActiveRows(logs)` + preenche as 3 chaves in-place (as linhas já são cópias
rasas criadas pelo flatten). `useDisplaySignals()` = `selectAllSignals` + nomes de runtime.
Os 5 consumidores trocam `useLogStore(selectAllRows)`/`selectAllSignals` pelos hooks; `selectAllRows`/
`selectAllSignals` ficam exportados para uso não-reativo e testes.

**Alternativa:** estender `selectAllRows` para ler o `constantsStore` via `getState()`. Rejeitada: o
selector só reexecuta quando o `logStore` muda, então editar uma constante não atualizaria a tela.

**Isolamento do fator:** `generateCorrectionSnapshot` e `evaluateCorrectionFilters` continuam em
`flattenActiveRows`/`log.model.rows`, que não têm as chaves de runtime. Teste de regressão: snapshot
idêntico com calibração 1000 e 873.

### 3. Fórmula em função pura: `signals/enginePower.ts`
`computeEnginePower({ map, rpm, iatC, lambda1, veFraction }, { displacementCc, afr, bsfc })` →
`{ power, torque }` conforme o spec: `ar = map·1000·ve·(cc/1e6)·rpm / (287·(iatC+273)·2·60)`,
`comb = ar / (afr·λ1)`, `power = comb·3600·2.20462 / bsfc`, `torque = rpm>0 ? power·716.2/rpm : 0`.
`λ1 <= 0`, `rpm < 0` ou resultado não finito → `NaN` (a UI mostra "—", como o resto do app trata
`NaN`). Constantes de unidade (287, 716.2, 2.20462, 273) ficam como constantes nomeadas no próprio
módulo — não são editáveis.

**Alternativa:** fórmula dentro do `compute` do `SignalDef`. Rejeitada: o dinamômetro e os testes usam
a mesma função; `SignalDef.compute` só a chama.

### 4. `constantsStore`: valor válido no store, texto cru no componente
`useConstantsStore`: `values: { displacementCc, afr, bsfc, veAtFull }` (sempre válidos) +
`set(partial)`, `reset()`, `hydrate()`. O `ConstantsPanel` guarda o texto digitado em estado local por
campo; só chama `set` quando o texto vira número > 0 — campo inválido recebe a marca de erro e o store
mantém o último valor bom. `k = 1000 / veAtFull` derivado em um selector (`selectCalibrationFactor`),
nunca guardado. Persiste em `miot:constants` (`lsSet` a cada `set`/`reset`); `restoreConstants()` em
`sessionRestorer.ts` valida campo a campo (qualquer campo ausente/inválido cai no padrão).

`setConstants` **não** chama `correctionStore.markStale()` (spec: constantes não invalidam o snapshot).

### 5. `dynoStore` separado
`useDynoStore`: `filters { minPedal: 90, minRpm: null, maxRpm: null, minMap: null, minClt: 80,
lambdaLoop: [0,1,2] }`, `mode: 'engine' | 'wheel'`, `lossPct: 15`, `smoothing: 'raw' | 'smoothed'`.
Persiste em `miot:dyno` (a largura da faixa de RPM do suavizado não é configuração: constante `RPM_BAND_WIDTH = 100` em `dynoCurve.ts`; um `bandWidth` salvo por versão anterior é ignorado no `hydrate`). Campos numéricos com a mesma regra de rascunho local +
valor válido no store (decisão 4). Separado do `constantsStore` porque o dono é a aba Dinamômetro, não a
aba Logs, e porque as constantes alimentam sinais de todas as abas enquanto estes campos só afetam o
gráfico do dyno. `types/ui.ts`: `DatalogTab` ganha `'dyno'`.

### 6. Pipeline do dinamômetro: três funções puras
1. `utils/dynoFilter.ts` — `selectDynoRows(rows, filters, selection)`: filtra por seleção de tempo
   (`timestamp_ms` em `[start_ms, end_ms]`, sobre as linhas de `useDisplayRows`, mesmos timestamps
   deslocados do TimeRail) e AND dos campos preenchidos (`null` = sem limite; `NaN` falha o campo);
   Lambda Loop por pertencimento. Função própria — `evaluateVisualFilter` tem a lista de sinais fixa
   em 5 (sem CLT) e semântica de "destaque", e o dyno precisa de **seleção**; só o tipo
   `LambdaLoopState` é reaproveitado.
2. `utils/dynoCurve.ts` — `buildRawCurve(rows)` → pontos `{rpm, power, torque}` ordenados por RPM
   (linhas com `NaN` descartadas); `buildSmoothedCurve(rows, bandWidth)`:
   `bin = floor(rpm / bandWidth)`, mediana por faixa (potência e torque separados; ponto em RPM = média
   dos RPM da faixa), depois mediana móvel de 3 faixas vizinhas (as vazias não existem — a vizinhança
   é entre faixas com amostra) e média móvel de 3. Nas pontas, a mediana móvel usa a regra de ponta de
   Tukey (mediana de si, da vizinha suavizada e da extrapolação linear das duas seguintes): exata numa
   tendência linear — uma janela deslizante/encolhida achata justamente o começo e o fim da curva de
   potência, que é crescente — e ainda remove um spike na primeira/última faixa. A média móvel usa só os
   vizinhos existentes.
3. `applyLoss(points, lossPct)` — multiplica por `1 − loss/100`; aplicado **depois** da
   suavização (linear, então a ordem não muda o resultado, e suavizar uma vez só evita recalcular a
   curva ao mexer em `lossPct`).

A aba memoiza cada etapa pelos seus insumos (`rows`+filtros+seleção → pontos; pontos →
curva; curva+modo/loss → dados do gráfico), então mexer na perda ou no switch Roda/Motor não refaz o
filtro nem o binning.

**Alternativa de suavização:** Savitzky-Golay. Rejeitada: preserva picos reais mas **também** spikes
(que o usuário quer eliminar) e exige pontos uniformes em RPM. Bins por RPM é o mesmo recorte da aba
"Potência Máx" da planilha. **Alternativa:** só média móvel — rejeitada, um spike vira um morro baixo
em vez de sumir.

### 7. Gráfico do dinamômetro: componente próprio com ECharts
`components/DynoChart.tsx` (não reutiliza `SyncedChart`: eixo X é RPM — `type: 'value'` — e não tempo, e
não participa de cursor/zoom do TimeRail). Duas `yAxis` (potência cv à esquerda, torque kgf·m à
direita, cores distintas dos eixos e séries), duas séries `line`; Bruto: `showSymbol` com símbolo
pequeno e `large` ligado acima de ~10k pontos; Suavizado: linha suave sem símbolos. Tooltip por eixo X.
Sem pontos → mensagem "nenhum dado nos filtros atuais" no lugar do gráfico.

### 8. Rota e navegação
`App.tsx`: `{ path: 'dyno', element: <RequireLog><DynoTab /></RequireLog> }`; `DatalogPage.tsx`: `<TabLink
to="dyno" label="Dinamômetro" />` depois de "Dados". `RequireLog` já exige log ativo.

### 9. Faixa dos sinais novos no gráfico
`VE Lambda Corrigido`: 0–150 (como `VE Lambda`); `Potência`: 0–300 cv; `Torque`: 0–40 kgf·m. Valores fora
da faixa continuam plotados (o eixo é só o padrão do painel, como nos sinais existentes).

### 10. Marcha: sinal opcional do parse + filtro do dinamômetro
- **Parse:** `SIGNAL_DEFS` ganha `{ name: 'Marcha', column: '0', optional: true, ... convert: parseInt }`. O
  CSV tem duas colunas `0` e a gear é a última; `colMap[f.trim()] = i` já deixa o último índice vencer —
  fica documentado no parser e coberto por teste. `optional`: coluna ausente não derruba o import
  (`REQUIRED_COLUMNS` a exclui) e valor não numérico omite a chave em vez de descartar a linha.
  `model.signals` lista só os sinais efetivamente presentes no cabeçalho.
- **Versão do leitor:** `DatalogModel.parserVersion?: number` gravado no parse (`PARSER_VERSION = 2`, o
  `model` antigo conta como 1). `restoreLogs` reconstrói de `csvBlob` (`parseDatalogText`) quando
  `parserVersion < PARSER_VERSION`, regrava no IndexedDB e segue com o resto da restauração; falha de
  leitura/parse mantém o `model` como estava. Preferi uma versão a "falta o sinal Marcha" para um log
  cujo CSV realmente não tem a coluna não ser reparseado a cada reload.
- **Filtro:** `DynoFilters.gears: number[]` (subconjunto de 0–5, padrão todos, ao menos um). Restrição
  só vale quando nem todas as marchas estão marcadas; aí `selectDynoRows` exige `Marcha` finita e
  pertencente ao conjunto. Com tudo marcado, linhas sem Marcha passam (logs antigos/sem coluna não
  quebram o padrão). UI: checkboxes `0 1 2 3 4 5`, mesmo padrão do Lambda Loop. Aviso "estes logs não
  têm informação de marcha" quando há restrição e nenhum log ativo traz `Marcha`.
- **Semântica do 0:** nos 91 logs de exemplo a coluna vai de 0 a 5 e a relação RPM/km/h em 1–5 bate
  com marchas reais (146 → 75 → 53 → 40 → 32); 0 é tratado como "sem marcha engatada" e rotulado só "0".
  Gear 6 não existe nos logs: um valor fora de 0–5 só passa com todas marcadas.

### 11. Filtros do dinamômetro em modal
`features/datalog/DynoFilterModal.tsx`, mesma casca do `VisualFilterModal` (overlay `bg-black/70`, `role="dialog"`,
cabeçalho com ×, corpo rolável, rodapé; Escape e clique fora fecham). Aberto por um botão "Filtros" na barra
da aba. **Sem rascunho/Aplicar**, ao contrário do filtro visual: os campos já gravam direto no `dynoStore`
(`DraftNumberField` só confirma valores válidos), então fechar mantém tudo e o modal mostra "N de M linhas
usadas" para dar o retorno que o gráfico, coberto pelo overlay, não dá. O campo de **Perda** mora no modal; o
switch Roda/Motor e o Bruto/Suavizado ficam na barra da aba. Rodapé: "Restaurar padrões" (filtros + perda,
via `dynoStore.resetFilters`) e "Fechar".
**Alternativa:** rascunho + Aplicar como o filtro visual. Rejeitada: reescreveria os campos validados
`DraftNumberField` e o filtro do dinamômetro é persistido, sem o "substitui outro destaque" que justifica
o Aplicar do filtro visual.

## Risks / Trade-offs

- [Memória: mais 3 chaves por linha (~72k linhas) e um segundo array de linhas vivo] → o cache de uma
  entrada compartilha o array entre componentes; o custo é o mesmo do `flattenActiveRows` atual +
  3 números por linha.
- [Cache de uma entrada recalcula tudo ao mexer numa constante] → é uma varredura O(n) barata (sem
  ordenação); aceitável. Se pesar em log muito grande, o `constantsStore` pode ganhar debounce de
  escrita sem mudar o contrato.
- [`selectAllRows` e `useDisplayRows` coexistindo] → risco de um consumidor novo usar o errado. Mitigação:
  comentário no `selectAllRows` ("não inclui sinais de runtime") e os dois consumidores não-reativos
  (`correctionGeneration`, `useCorrectionMask`) já usam `flattenActiveRows`, não ele.
- [Mudança concorrente `improve-datalog-charts-performance` mexe no `SyncedChart`] → esta change só troca
  a origem de `allRows`/`allSignals` ali (2 linhas); conflito de merge é textual e pequeno.
- [Reparse ao restaurar logs antigos custa tempo de CPU uma única vez por log (dezenas de milhares de linhas) e roda dentro do `restoreSession` já assíncrono] → regrava o `model` novo; a UI não bloqueia na primeira renderização.
- [Suavização com poucas amostras por faixa (log curto/esparso)] → a mediana móvel entre faixas vizinhas
  cobre faixas de 1–2 amostras; documentado no spec ("isolated band").
- [Usuário digita VE em escala errada (87,3 em vez de 873)] → o rótulo explica a escala ("100% = 1000")
  e o fator `k` exibido ao lado denuncia o erro de ordem de grandeza (k ≈ 11,5).

## Open Questions

- Largura/estilo exatos dos campos de filtro do dyno (um painel retrátil acima do gráfico vs. coluna
  lateral) — decisão de layout na implementação, sem impacto nos specs.
