# Frontend — Master Injection Online Tools

**Stack:** React 18 · TypeScript 5 · Vite 5 · Tailwind CSS 3 · Zustand 4 · idb 8

App 100% client-side — sem backend, sem chamadas de rede em runtime.

## Specs do frontend

Todo o comportamento do frontend vive como capabilities do OpenSpec em
`../openspec/specs/<capability>/spec.md` (Purpose + Requirements + Scenarios). Rode
`openspec list --specs` na raiz do repo para o índice, ou `openspec show <capability> --type spec`
para o conteúdo completo. Veja também o índice geral no `CLAUDE.md` da raiz.

| Capability | Cobre |
|------|-------|
| `home` | Tela Home (`/`), cards de entrada |
| `map-import-export` | Parsing/exportação client-side do CSV de mapa |
| `datalog-import` | Parsing client-side do CSV de datalog; aba Logs (só a lista de logs); controle na TopBar |
| `datalog-timeline` | TimeRail: cursor, seleção de intervalo, sparkline, múltiplos logs |
| `datalog-dashboard` | Aba Dashboard |
| `datalog-charts` | Aba Gráficos: painéis sincronizados, sidebar de sinais |
| `datalog-table` | Aba Dados: tabela, colunas, exportação CSV |
| `datalog-filter` | Filtro único do Datalog (modal no cabeçalho): critérios ligáveis em AND, mesma máscara para destaque e para gerar run |
| `correction-runs` | Run de correção, histórico de 10, compatibilidade por breakpoints, "Gerar Correção" no cabeçalho do Datalog, toast/indicador, seletor na aba Eficiência Volumétrica |
| `app-settings` | Tela Configurações (TopBar, sem guard): Constantes do motor, k de confiança do Ponderado e faixa (mín/máx) dos sinais nos gráficos |
| `datalog-constants` | Constantes (tela Configurações): cilindrada/AFR/BSFC, calibração de VE (k), sinais de runtime VE Lambda Corrigido, Potência, Torque e o hover de origem |
| `datalog-dyno` | Aba Dinamômetro: curva potência/torque × RPM (Roda/Motor, Bruto/Suavizado, filtros próprios) |
| `datalog-xy` | Aba XY: nuvem de pontos de um sinal X contra um ou mais Y (eixo por sinal), com o filtro único, a seleção da TimeRail e o cursor |
| `heatmap-editing` | Edição de tabela N×M (seleção, atalhos de teclado, undo/redo) — usada por VE/Ignition/Lambda |
| `mapa-arquivo` | Aba Arquivo do Mapa: subir/substituir, exportar e remover o mapa, informações do mapa (livre de guard) |
| `mapa-ve` | Aba VE: mapa original, mapa editável, seção de correção (sempre presente) |
| `mapa-ve-correction` | Atribuição bilinear + agregação por célula, heatmaps de correção, proveniência, aplicação no mapa |
| `mapa-ignition` | Aba Ignition (bloqueada na v1) |
| `mapa-lambda` | Aba Lambda (bloqueada na v1) |
| `navigation-guards` | Rotas, guards (`RequireMap`/`RequireLog`), padrão de aba bloqueada |
| `session-persistence` | O que sobrevive a um reload, ordem de restauração, migração do snapshot antigo, runs nunca invalidados |
| `pwa` | App instalável (manifest), service worker offline, atualização automática, cache dos arquivos de update |

`../specs/master/datalog.md` documenta o formato CSV do datalog (usado pelo parser client-side). O
formato do mapa CSV é coberto pela capability `map-import-export` acima.

**IMPORTANT — specs e código andam juntos:** sempre que alterar o código, atualize na mesma mudança a(s) spec(s) correspondente(s) em `specs/`. Specs e código DEVEM permanecer sincronizados.

```bash
npm run dev    # http://localhost:5173
npm run build
npm run test   # vitest run — unit tests
```

## Testar

Vitest, ambiente `node` (stores/utils são lógica pura — nada de DOM). Testes ficam colocados junto
ao arquivo testado (`mapStore.test.ts` ao lado de `mapStore.ts`), não em uma pasta `tests/`
separada. Módulos com efeito colateral (ex: `persistence/*`, que fala com IndexedDB) são mockados
com `vi.mock` nos testes de store, para o teste continuar puro e determinístico.

## Estrutura

```
src/
├── api/          client.ts (só computeHash — dedupe de logs por SHA-1)
├── components/   HeatmapTable.tsx · SyncedChart.tsx · TimeRail.tsx · DynoChart.tsx · XYChart.tsx · DraftNumberField.tsx · Switch.tsx · ToastHost.tsx
├── features/     mapa/ (arquivo/ArquivoTab.tsx · ve/ · ignition/ · lambda/ · CorrectionSection.tsx · RunSelector.tsx) · datalog/ (inclui FilterModal.tsx · FilterButton.tsx · GenerateCorrectionButton.tsx · GenerateCorrectionDialog.tsx · DynoTab.tsx · XYTab.tsx) · settings/ (ConstantsPanel.tsx · WeightingPanel.tsx · SignalRangesPanel.tsx)
├── pages/        MapaPage.tsx · DatalogPage.tsx · SettingsPage.tsx
├── parsers/      mapParser.ts · datalogParser.ts
├── persistence/  db.ts · *Persistence.ts · runPersistence.ts · legacySnapshotPersistence.ts · legacyMigration.ts · localStorage.ts · sessionRestorer.ts
├── signals/      signalRegistry.ts (sinais crus + derivados) · veLambdaFormula.ts · injectionEffective.ts · enginePower.ts · runtimeSignals.ts · signalOrigin.ts · displayRows.ts
├── utils/        filter.ts · filterDraft.ts · filterMigration.ts · correctionGeneration.ts · runRecipe.ts · generationSummary.ts · dynoFilter.ts · dynoCurve.ts · xySeries.ts · signalColor.ts · mapRowOrder.ts · mapInfo.ts · undoTarget.ts · mapEditOps.ts · mapGridSelection.ts · chartLayoutSize.ts · chartLayoutMigration.ts · sparkline.ts · findLastRow.ts · chartWindow.ts · railDrag.ts · runWithBusy.ts · serialQueue.ts
├── hooks/        useFilterMask.ts · useDisplayRows.ts · useAfterPaint.ts
├── store/        mapStore · logStore · filterStore · correctionStore · correctionSettingsStore · toastStore · constantsStore · signalRangesStore · dynoStore · xyStore · timeStore · uiStore
└── types/        map · datalog · filter · correction · ui
```

## Stores

- **`useMapStore`** — dono do mapa. `updateCell` = 1 undo; `bulkUpdateCells` = 1 undo para o batch inteiro. Histórico session-only, não persiste em IndexedDB.
- **`useLogStore`** — dono dos logs (parsing, ativação, ordem). `flattenActiveRows(logs)` concatena os logs ativos com timestamps deslocados — usada por qualquer código que precise da timeline única.
- **`useFilterStore`** — o filtro único do Datalog (`filter: FilterConfig` — critérios ligáveis: faixas de MAP/RPM/Lambda 1/Lambda Corr/Pedal/CLT/IAT/Batt Volt./Inj. DT/Inj. Utiliz./Inj. Pulse/Lambda Target/Boost/IAT — as sete últimas desligadas e vazias por padrão —, estados de Lambda Loop, ΔTPS, ΔMAP, |Δ λ×alvo|, pular pontos depois **e antes** de entrar em closed/open loop — `skipClosed`/`skipOpen`/`skipBeforeClosed`/`skipBeforeOpen`, os "antes" desligados por padrão —, todos em AND) e `showFilteredPoints`. Sem rascunho aqui: o rascunho vive no `useState` do `FilterModal`. `useFilterMask()` devolve a máscara (cache de 1 entrada em `evaluateFilterCached`) que Dashboard/Gráficos/Dados usam **e** que `generate()` usa — "o que está destacado é o que gera". Persiste em `miot:correction-filter` / `miot:correction-show-filtered`.
- **`useCorrectionStore`** — histórico de runs (`runs`, do mais novo ao mais antigo, máx. `MAX_RUNS` = 10, corte FIFO), `selectedRunId` (persiste em `miot:correction-selected-run`) e `hasUnseenRun` (ponto no item Mapa da TopBar; zerado ao abrir a VE). `generate({ useTimeSelection })` (padrão true) lê filtro, logs ativos, seleção de tempo (só se `useTimeSelection`) e mapa e cria um `CorrectionRun`; não há mais `isStale`/`markStale`/`clear` — um run é uma foto imutável. `isRunCompatible(run, map)` compara breakpoints.
- **`useCorrectionSettingsStore`** — `values.confidenceK` (k do Ponderado: `w = n / (n + k)`, padrão 100, aceita ≥ 0), editado na tela Configurações (`WeightingPanel`), persiste em `miot:correction-settings`. Separado de `useConstantsStore` de propósito: as constantes do motor nunca afetam a correção; o k afeta a exibição do Ponderado e o que "Aplicar" escreve, mas nunca os runs (que só guardam `n`). Passa-se como argumento a `computeWeightedFactor`/`computeFactorGrid` (padrão `DEFAULT_CONFIDENCE_K`).
- **`useToastStore`** — toasts efêmeros (`ToastHost` no `RootLayout`, sempre no topo direito, abaixo da TopBar); a ação opcional só roda no clique, nunca navega sozinha.
- **`useConstantsStore`** — `values`: cilindrada, AFR, BSFC e `veAtFull` ("VE atual onde a VE deveria ser 100%", escala da tabela: 100% = 1000); só guarda valores válidos (> 0) — o texto cru em edição vive em `DraftNumberField`. `selectCalibrationFactor` → `k = 1000 / veAtFull`. Persiste em `miot:constants`. Mudar uma constante **não** altera os runs de correção. O painel fica na tela Configurações (`SettingsPage`, rota `/settings`).
- **`useSignalRangesStore`** — `overrides`: só as faixas (`{min, max}`) que o usuário mudou na seção "Faixa dos sinais" da tela Configurações (`SignalRangesPanel`); sinal sem entrada usa o padrão de `SIGNAL_MAP`. `resolveRange(name, overrides)` é a faixa efetiva do eixo; `setRange` ignora par inválido (finitos, `min < max`) e um par igual ao padrão apaga a entrada. A regra do par é entre campos, então cada linha do painel guarda um rascunho dos dois e só grava quando fecha (`DraftNumberField` com `forceInvalid`). Persiste em `miot:signal-ranges`; `hydrate` descarta entrada a entrada sinal desconhecido/faixa inválida. Só enquadra eixos (Gráficos e XY): nunca altera dados, filtro nem runs. Dinamômetro e sparkline da TimeRail não usam.
- **`useDynoStore`** — filtros do dinamômetro (`null` = sem limite; `gears` = marchas aceitas, subconjunto de 0–5, todas = sem restrição, ao menos uma), `mode` (`engine`/`wheel`), `lossPct`, `smoothing` (`raw`/`smoothed`, padrão suavizado). Persiste em `miot:dyno`; `resetFilters()` devolve filtros e perda aos padrões. A faixa de RPM do suavizado é fixa (`RPM_BAND_WIDTH = 100` em `dynoCurve.ts`), não é configuração.
- **`useXYStore`** — `xSignal` (um), `ySignals` (ordem = cor/posição do eixo; sem repetição; **pode ficar vazia** — `removeY` tira até o único), `showMean`/`showMax`/`showMin` (checkboxes "Linha média/máxima/mínima" — curvas de média, maior e menor Y por faixa de X —, padrão desligados) da aba XY. Persiste em `miot:xy`. **Não** filtra por sinais disponíveis: a aba mostra salvos ∩ disponíveis (lista vazia = mensagem "Adicione um sinal ao eixo Y", sem voltar ao MAP; X cai em RPM se o salvo faltar) sem apagar o salvo; `hydrate` restaura lista vazia como vazia (só ausente/corrompida cai no padrão RPM/[MAP]), para o sinal de um log inativo voltar com o log.
- **`useTimeStore`** — cursor_ms, selection, sparklineSensor, chartZoom. Persiste em `miot:time`.
- **`useUIStore`** — chartLayout (árvore de painéis), columnVisibility, datalogTab. Persiste em `miot:ui`. O tamanho dos painéis vive no layout: cada `ChartPanel` tem `height` (px) e o split `horizontal` tem `ratio` (fração da largura de `children[0]`); pilha vertical não tem proporção. Altura de uma linha = a maior dos painéis lado a lado; o total é a soma das linhas e a área rola na vertical (nunca estica). Só botões `+`/`−` redimensionam (`utils/chartLayoutSize.ts`, funções puras); não há arrasto. `hydrate` migra layouts antigos (`chartsHeight` + `ratio` vertical) via `utils/chartLayoutMigration.ts`.

## Convenções críticas

**Imports:** `correctionStore` importa `mapStore`/`logStore`/`timeStore`/`filterStore` na raiz; nenhum deles importa `correctionStore` (runs nunca são invalidados por mudanças ambientes). Se algum dia um store precisar de `correctionStore`, use `import()` dinâmico dentro de método async para não criar ciclo.

**Seção Mapa:** rotas `/mapa/arquivo` (livre de guard — sobe/substitui/exporta/remove o mapa), `/mapa/ve`, `/mapa/ignition`, `/mapa/lambda` (cada uma sob `RequireMap`, que sem mapa mostra um aviso com link para Arquivo). `#/tuning/*` (nome antigo) redireciona para `#/mapa`. Ctrl+Z/Y agem só na tabela editável da aba em exibição (`undoTargetForPath`); a aba Arquivo não tem tabela. A `TopBar` não mostra o nome do mapa.

**Gráficos montados e última aba:** o `RootLayout` renderiza o `DatalogPage` (depois da 1ª visita ao Datalog; `visible` falso nas outras seções = escondido, sem cabeçalho/TimeRail/abas, só os gráficos vivos) e o `DatalogPage` resolve a aba pela rota (`tabFromPath`), sem `<Outlet/>` — as rotas `datalog/*` só guardam os caminhos e o índice (links de aba absolutos). Ele renderiza o `ChartsTab` (só com log ativo, `hidden` fora da aba Gráficos); `useDisplayRows(enabled)` não recalcula enquanto os gráficos estão fora de vista. `SyncedChart` recebe `active` e, escondido, usa uma cópia **congelada** das entradas (`frozenRef`) — nada reconstrói nem recebe zoom, e a volta aplica o que mudou uma vez. As rotas índice `/datalog` e `/mapa` renderizam `LastTabRedirect` (lê `uiStore.datalogTab`/`mapaTab`, gravados por `DatalogPage`/`MapaPage` a partir do caminho — `utils/lastTab.ts`); a `TopBar` segue apontando para `/datalog` e `/mapa` (apontar direto para a aba salva faria o `NavLink` deixar de marcar a seção nas outras abas).

**Roteamento por hash:** `App.tsx` usa `createHashRouter` (URLs `/#/datalog/charts`) para funcionar no CloudFront/S3 sem fallback para `index.html`. Leia a rota sempre via `useLocation`/`useBlocker`, nunca `window.location` (o `pathname` global é sempre `/`). Não use `href="#..."` como âncora.

**Favicon e preview de link:** ícones e `og-image.png` (1200×630) ficam em `public/` e são servidos na raiz; as tags `<link rel="icon">`/`og:*` estão em `index.html`. `og:url`/`og:image` precisam ser URL **absoluta** (o WhatsApp ignora caminho relativo) — hoje com o placeholder `https://SEU-DOMINIO`, trocar pelo domínio de produção. O `Makefile` sobe `public/*` com cache `immutable` de 1 ano (sem hash no nome): ao trocar uma imagem, renomeie o arquivo.

**PWA:** `vite-plugin-pwa` (config em `vite.config.ts`; manifest + `sw.js` gerados no `npm run build`, nada a registrar no código). Ícones `pwa-*.png` em `public/`. `sw.js`/`registerSW.js`/`manifest.webmanifest`/`index.html` não podem ter cache longo (ver `Makefile` e `nginx.conf`). Spec: `pwa`.

**Parsing client-side:** `parseMapClient` lê `#I20` (RPM), `#I21` (MAP), `#F01–#F16`. `parseDatalogClient` converte raw→real e calcula SHA-1 (só para deduplicar logs, sem upload).

**Sinais derivados:** um `SignalDef` tem `column`+`convert` (lido do CSV) OU `compute` (calculado de outros sinais já convertidos da mesma linha) — nunca os dois. `datalogParser.ts` aplica primeiro todos os `convert`, depois todos os `compute`, por linha. Exemplos: `VE Lambda`, `Inj. Efetivo` (`Inj. Pulse − Inj. DT`). Um derivado pode declarar `inputs` (nomes dos sinais que lê): só é calculado numa linha em que todos são números válidos e só é listado em `model.signals` quando todos estão listados — é como um derivado depende de colunas `optional` (sem `inputs`, como `VE Lambda`, é sempre calculado).

**Sinais de runtime:** sinal que depende de valor editável em runtime (hoje: `VE Lambda Corrigido`, `Potência`, `Torque`, calculados por `applyRuntimeSignals` em `runtimeSignals.ts` com as constantes) **nunca** vai no `compute` do parse nem no `model` persistido. Entra só na leitura: `getDisplayRows` (cache de 1 entrada) via `useDisplayRows()`/`useDisplaySignals()` — use-os em tudo que EXIBE dados (Dashboard, Gráficos, Dados, TimeRail, Dinamômetro). `generateCorrectionSnapshot`/`useCorrectionMask` seguem em `flattenActiveRows`/`log.model.rows`, sem essas chaves — é isso que impede o fator `k` de reescalar o mapa. `SIGNAL_MAP` cobre os dois tipos; o parser só lê `SIGNAL_DEFS`.

**Dinamômetro (`datalog-dyno`):** pipeline em funções puras memoizadas por etapa — `selectDynoRows` (seleção de tempo + filtros próprios, independente do filtro único) → `buildRawCurve`/`buildSmoothedCurve` (faixas de RPM: mediana + mediana móvel com regra de ponta de Tukey + média móvel) → `applyLoss` (modo Roda). Filtros e Perda ficam num modal (`DynoFilterModal`, botão "Filtros" na barra da aba; sem rascunho/Aplicar — edição já vale); Roda/Motor e Bruto/Suavizado ficam na barra. Os botões "Filtro" e "Gerar Correção" do `DatalogPage` ficam ocultos na rota `/datalog/dyno`. A aba traz uma nota discreta (com link) dizendo que potência/torque vêm das constantes de Configurações. Potência em cv e torque em kgf·m (`Torque = Potência × 716,2 / RPM`).

**XY (`datalog-xy`):** `buildXYSeries` (`utils/xySeries.ts`, pura) tira de `useDisplayRows()` + `useFilterMask()` + seleção de tempo, por sinal Y, os pontos `pass`/`fail` (uma linha só entra numa série se X e aquele Y são números; `fail` vazio quando "Mostrar pontos filtrados" está desligado). `XYChart` desenha cada Y como 1–2 séries `scatter` (`large`, cor cheia e esmaecida) com **um eixo por sinal** na faixa configurada do sinal (`resolveRange`: padrão do `SignalDef` ou a sobrescrita de Configurações; mesma dos Gráficos), lados alternados. O cursor NÃO entra no `option`: são séries `cursor-<i>` atualizadas por `setOption` de merge (`cursorUpdate`) num efeito, para mover o cursor não refazer a nuvem — como o `option` é aplicado com `notMerge`, o efeito reaplica o cursor a cada novo `option`. Com `showMean` ("Linha média"), cada Y ganha uma série `line` `mean-<i>` com a média de Y por faixa de X (`bandCurve(..., 'mean')`: 70 faixas sobre a faixa configurada do X — RPM = 100 rpm —, mínimo de 3 pontos por faixa, ponto = média de X e de Y da faixa; a linha é **prolongada na horizontal**, no nível do primeiro/último ponto, até o menor e o maior X dos pontos que passam, para cobrir as pontas ralas sem criar picos) — só dos pontos que passam no filtro e estão na seleção; os esmaecidos não entram. A nuvem tem a cor da série, então a linha é **vermelha e tracejada** (`meanLineColor` em `utils/signalColor.ts`: `#ef4444`, ou `#b91c1c` se a série já for a vermelha da paleta), com halo escuro (`shadowBlur`) e `z` acima dos pontos; os marcadores da curva levam a cor do sinal (é o que distingue as curvas quando há vários Y). `showMax`/`showMin` somam séries `max-<i>`/`min-<i>` (mesmo `bandCurve`, estatística `max`/`min`) **pontilhadas em cinza-claro** (`ENVELOPE_LINE_COLOR`), com `z` abaixo da média. O `echarts-for-react` aplica o `option` de forma assíncrona na montagem: o primeiro cursor vai em `onChartReady` (um `setOption` de merge antes disso cria séries sem tipo, `Unknown series undefined`). Paleta/`dimColor` vêm de `utils/signalColor.ts` (compartilhada com `SyncedChart`). "Filtro" e "Gerar Correção" continuam visíveis nesta aba (só somem em `/dyno`).

**Conversões raw→real** (definidas em `signalRegistry.ts`):

| Sinal | Conversão |
|-------|-----------|
| Lambda 1, Lambda Target | `raw / 1000` |
| Lambda Corr | `(raw - 1000) / 10` (%) |
| CLT, IAT | `raw - 273` |
| Pedal | `min(100, raw / 990 * 100)` |
| Lambda Loop | `raw` (0=OL, 1=CL) |
| Marcha | `parseInt` da **última** coluna chamada `0` (o CSV tem duas; 0 a 5 — 0 = sem marcha engatada). Sinal `optional`: CSV sem a coluna importa normalmente, sem o sinal |
| Inj. Pulse | `raw / 100` (ms; 1337 = 13,37 ms — já inclui o dead time) |
| Inj. DT | `raw / 1000` (ms; 1100 = 1,1 ms) |
| ACP | `raw` (kPa — a coluna se chama `ACP %`, mas é a pressão do compressor do A/C) |
| dACC | `(raw - 5000) / DACC_DIVISOR` (`signalRegistry.ts`, hoje 100; 5000 = zero; escala **não verificada**, só exibição) |
| Batt Volt. | `raw / 10` (V) |
| Pressão Óleo | `raw / 100` (bar) — vem da coluna `Lambda 2` |

**Correção VE (`correction-runs`, `datalog-filter`, `mapa-ve-correction`):** o filtro único é avaliado por `evaluateFilter` (`utils/filter.ts`) — a MESMA função para destacar pontos em Dashboard/Gráficos/Dados e para escolher os pontos de um run, para nunca haver duas implementações da mesma regra. "Gerar Correção" (cabeçalho do Datalog, qualquer aba menos Dinamômetro; só o rótulo no botão) abre `GenerateCorrectionDialog` — descritivo, resumo e um switch para considerar o intervalo da TimeRail — e, ao confirmar, roda `generateCorrectionRun` (atribuição bilinear em até 4 células + agregação por célula) sobre os pontos que passam no filtro aplicado e no intervalo selecionado, e guarda um run: células (`n`/média/mediana/moda), os breakpoints do mapa usado e a receita (logs, recorte **por log** — `toPerLogRanges` —, filtro) só para exibição. O run não depende mais dos logs; os toggles Direto/Ponderado, Média/Mediana/Moda e Cor são derivações baratas em cima do run selecionado, contra o mapa carregado. Um run só vale para um mapa com os MESMOS breakpoints (`breakpointsEqual`); com outros, aparece como incompatível — nunca é reprojetado.

**Lambda Loop tem 3 estados** (não 2): `0`=aberto, `1`=fechado, `2`=fechado + auto-correção. `isClosedLoop()` em `utils/filter.ts` trata 1 e 2 como "fechado" pra fins de transição dos filtros de skip (um por sentido de transição × "depois"/"antes"). "Depois": `computeClosedLoopSkipMask`/`computeOpenLoopSkipMask`, contador que exclui os N pontos a partir da transição (`computeLoopTransitionSkipMask`). "Antes": `computeClosedLoopSkipBeforeMask`/`computeOpenLoopSkipBeforeMask` excluem os N pontos que antecedem a transição, sem o ponto da transição (`computeLoopTransitionSkipBeforeMask`). Os predicados de transição (`entersClosedLoop`/`entersOpenLoop`) são compartilhados; alternar entre 1↔2 sem passar por 0 não cria nem reinicia nenhuma janela.

**Delta TPS/MAP** compartilham `computeDeltaAmplitude(rows, signal)` (amplitude max−min numa janela retroativa de 200ms) — mesma mecânica, sinal diferente (`Pedal` vs `MAP`).

**Gráficos e zoom da seleção:** `selection` (timeStore) é a fonte da verdade do zoom. Como o `option` usa `notMerge` (reinicia o `dataZoom` a 100%) e painéis novos/remontados também nascem a 100%, `PanelView` chama `applySelectionZoom` (contexto de `SyncedChart`) em `onChartReady` e num efeito `[option]` — sob a flag `updatingFromExternal`, para o handler de `datazoom` não devolver o zoom ao store. Não coloque o zoom no `option`: reconstruiria todas as séries a cada gesto. **O zoom é despachado uma vez por gráfico, com `inst.group = ''` durante a chamada:** um `dispatchAction` num gráfico de um grupo `echarts.connect` se propaga aos outros, e despachar em todos repetia o mesmo zoom 6x (~1,3 s contra ~0,2 s medido). Os despachos da seleção vão pela fila serial depois do "Carregando…" (`zooming` no contexto); uma seleção que veio do próprio gráfico (`fromChartRef`) não é reaplicada, o `connect` já propagou. **Janelamento:** cada painel recebe só o trecho do log perto do `selection` (`utils/chartWindow.ts`, funções puras): `windowRows` fatia `rows` **e** `mask` juntas (a máscara é indexada por linha), com ±1 largura visível de folga. A janela carregada (`nextWindow`) só é refeita quando o intervalo visível sai dela ou o zoom fecha muito (`MAX_OVERSIZE`) — refazer a cada gesto reconstruiria o gráfico (`notMerge`) sem parar. O eixo X é fixado no log inteiro (`ChartView.xDomain`, `min/max` explícitos): com `dataMin/dataMax` o 100% do `dataZoom` passaria a ser o da janela e a conversão percentual→tempo do handler de `datazoom` (que usa o log inteiro) erraria. O eixo Y não precisa de compensação: todo sinal tem `min`/`max` fixos (o padrão do `SignalDef` ou a sobrescrita de `useSignalRangesStore`, que entra em `buildOption(..., ranges)` pelo `ChartSyncContext` junto das demais entradas congeladas — editar a faixa em Configurações não reconstrói os gráficos escondidos). **Seleção na TimeRail:** criar/redimensionar/mover a seleção arrastando só atualiza um rascunho local (`draft`, via `dragSelection` em `utils/railDrag.ts`); o store (`setSelection`) recebe o valor uma vez, ao soltar o mouse ou sair da régua — gravar a cada movimento recalculava Gráficos/Dados/Dinamômetro/XY o tempo todo. **"Carregando…":** o `setOption` do ECharts é síncrono e custa centenas de ms num log grande; `useAfterPaint(option)` (`hooks/useAfterPaint.ts`) só entrega o `option` ao gráfico depois de dois quadros pintados, com `pending` mostrando o overlay no painel (a montagem também espera). Os efeitos que reaplicam cursor e zoom da seleção rodam sobre o `option` efetivamente aplicado (`shownOption`). Todos os gráficos aplicam por uma **fila serial** compartilhada (`utils/serialQueue.ts`: um por quadro, `flushSync`) — aplicar os seis painéis numa tarefa só segurava a tela por segundos e os cliques dados nesse meio-tempo rodavam depois. O mesmo `useAfterPaint` + `LoadingOverlay` cobre `XYChart` e `DynoChart`. **Bloqueio enquanto carrega:** `BusyHost` (em `RootLayout`) é um modal sem fechar sobre a tela toda, com `inert` no `#root`, enquanto `busyStore` tiver alguma operação — cada gráfico (`useAfterPaint` → `useBusy`), o zoom da seleção e `runWithBusy`; só com ≥ 5.000 linhas ativas (senão só piscaria) e com watchdog de 60 s. Sem isso, os cliques dados durante o travamento ficavam na fila e rodavam depois. **Operações pesadas disparadas por dialog** (aplicar filtro, "Mostrar pontos filtrados", gerar correção): feche a dialog **antes** e rode o trabalho com `runWithBusy(mensagem, fn)` (`utils/runWithBusy.ts`: registra no `busyStore`, espera dois quadros pintados, roda `fn`) — no mesmo clique a dialog ficava na tela, travada, até o fim.

**Sparkline da TimeRail:** `SparklineSVG` usa `viewBox` fixo (nada de medir o contêiner — o `ResizeObserver` antigo nunca era montado e a linha nunca desenhava); os dados vêm de `buildSparkline` (`utils/sparkline.ts`: min/max por bucket, lacunas viram trechos separados).

**Séries sem símbolos:** as séries de `buildOption` levam `showSymbol: false` (+ `silent`, `emphasis.disabled`). `symbol: 'none'` sozinho não basta — o `LineView` ainda diffava e percorria todos os pontos (`SymbolDraw`/`DataDiffer`, a maior fatia do perfil) a cada atualização.

**Gráficos e pontos filtrados:** ECharts não colore segmento de linha por valor de forma confiável com `visualMap` nos nossos testes — `SyncedChart.tsx`'s `buildOption` em vez disso quebra cada sinal em uma série por trecho contíguo (`computeRuns`), uma cor cheia por trecho que passa no filtro e uma versão `rgba(...,0.25)` pro que não passa, com 1 ponto de sobreposição em cada fronteira pra nunca ter buraco na linha. Painéis com filtro pesado geram bastante série pequena — é o tradeoff aceito por confiabilidade visual.

**Persistência:**
- IndexedDB (`miot-db` v4): mapa (blob + model), logs (blob + model), runs de correção (store `correction-runs`). A store `correction-snapshot` (v3) é só legado: o snapshot "last" vira o "Run 1" na primeira abertura (`legacyMigration.ts`, depois de restaurar o mapa) e é apagado; sem mapa restaurado é descartado
- localStorage: `miot:log-order` · `miot:correction-filter` · `miot:correction-show-filtered` · `miot:correction-selected-run` · `miot:correction-settings` · `miot:ui` · `miot:time` · `miot:constants` · `miot:signal-ranges` · `miot:dyno` · `miot:xy`
- `sessionRestorer.ts` restaura tudo na inicialização sem nenhuma chamada de rede
- **Versão do leitor de CSV:** `parseDatalogText` grava `model.parserVersion = PARSER_VERSION` (em `datalogParser.ts`). Ao ler um sinal novo do CSV (ou mudar uma conversão), **incremente `PARSER_VERSION`** (hoje 3): `restoreLogs` chama `upgradeLogEntry` (`persistence/logMigration.ts`), que reparseia do `csvBlob` os logs salvos com versão menor (ausente = 1) e regrava no IndexedDB, sem reimportar; falha de leitura mantém o log como estava

**Ordem de exibição dos sinais:** `SIGNAL_GROUPS` (`signalRegistry.ts`) define grupos de sinais parecidos (VE → VE Lambda → VE Lambda Corrigido; Inj. Pulse → DT → Efetivo → Utiliz.; ...). `sortSignals` aplica essa ordem em `DISPLAY_SIGNAL_DEFS` (colunas e menu de Dados) e em `withRuntimeSignals` (`useDisplaySignals`: Dashboard, Gráficos, Dinamômetro) — na leitura, nunca gravada no `model`. Sinal novo: nomeie-o em um grupo (um teste falha se algum sinal conhecido ficar fora). A ordem do parser (`SIGNAL_DEFS`) é independente.

**Hash:** `computeHash(file)` → `"sha1:<hex>"` (só para detectar log duplicado, não usado em upload)

**Ordem das linhas do mapa:** convenção interna do frontend é **descendente** por MAP — `cells[0]`/`mapBreakpoints[0]` = **maior** MAP, batendo 1:1 com a exibição (`HeatmapTable` renderiza literal, sem inversão). O arquivo CSV exige ascendente (`cells[0]` = menor MAP); a conversão acontece só na fronteira `mapParser.ts`/`mapExporter.ts` (parse/export do CSV), via `utils/mapRowOrder.ts`. Não introduzir mais nenhum ponto de inversão — se precisar mexer em ordem de linha, é nesses arquivos.

**HeatmapTable:** valores inteiros 100–9999 (VE% × 10) no mapa editável. Também reusado, somente leitura, 3x em `CorrectionSection.tsx` (Direta/Ponderado/Amostras, lado a lado — sem toggle de modo) — nesse caso os valores são a **variação percentual** do fator (1.05 → +5.0%, 0.95 → -5.0%; `factorToPercent`/`formatPercentDelta` em `correctionDisplay.ts`), não VE raw; usa `colorScale="correction"` (`utils/correctionColor.ts`: intensidade não linear pela correção absoluta — 5% amarelo, 10% vermelho, 15% vinho/limite —, os dois sentidos esquentam igual) pros dois de correção, `"coverage"` pro de amostras. "Aplicar" continua usando o fator, não o percentual. O switch "Cores" (Valor | Amostras — padrão **Amostras**; estado local da `CorrectionSection`) só muda a pintura das tabelas Direta/Ponderado: "Amostras" mantém a cor do valor (`colorScale="correction"`) e passa `opacityValues` (`confidenceOpacity(n/(n+k))`, de `MIN_CONFIDENCE_OPACITY` = 0,08 a 1, via `confidenceWeightGrid`); no `HeatmapTable` a cor **desbota para o tom neutro de célula vazia** (`fadeToNeutral`), não fica transparente sobre o fundo — assim cores escuras como o vinho não viram pontos escuros que chamam atenção; sem cor de alerta; os números não mudam. `onCellChange` = 1 undo; `onBulkChange` = 1 undo para o batch. O toolbar de ícones (Ajuste/Interpolar/Undo/Redo) é interno ao componente, acima da tabela; `onReset`/`resetDisabled` (opcionais) colocam "Resetar" na mesma barra — é assim que `EditableMapSection` funciona hoje, em vez de um botão separado no header da seção. **Hover das tabelas editáveis (VE/Ignição/Lambda):** `EditableMapSection` passa `cellTitle` (via `MapWithChart`) com `formatCellDiffTitle` (`utils/mapDiff.ts`): "Original / Atual / Diferença" em % (`—` quando o original é 0 e a célula mudou); o Lambda usa 3 casas (`formatTitleValue`). **Seleção compartilhada (aba VE):** `VETab` guarda `{anchor, selEnd}` (`Selection`, em `utils/mapEditOps.ts`) e a passa a Original, Editável, aos gráficos (via `MapWithChart`) e às 3 tabelas de correção; `HeatmapTable` aceita `selection`/`onSelectionChange` (controlado; sem eles, mantém seleção própria — Ignition/Lambda). Não há limpeza no blur: só Escape ou `mousedown` fora de `[data-map-grid-item]`/`[role="dialog"]` (listener no `VETab`). Tabelas `readOnly` tratam navegação sozinhas e repassam o resto via `onKeyDelegate` → `keyHandlerRef` da tabela editável (F2, H, V, Ctrl+I/U/C/V, Delete em intervalo); Enter/dígito/Delete em 1 célula nunca são delegados. As operações puras dos atalhos vivem em `utils/mapEditOps.ts`. Com `cellWidth` definido (uso em `MapWithChart`), o wrapper usa `overflow-x-auto` (não `overflow-hidden`) de propósito — um pequeno erro na estimativa de largura vira scroll em vez de cortar a última coluna.

## Invariantes

- Stores são a fonte de verdade — componentes não mantêm cópias locais.
- `sessionRestorer` não faz chamadas de rede (não existe rede a chamar).
- Um run de correção nunca guarda um "fator" — só `n`/média/mediana/moda por célula (`mode` é opcional: runs antigos não o têm — `snapshotHasMode()` desabilita a opção Moda); o fator é sempre derivado no read, contra o mapa atual.
- **`editableMap`/`originalMap.cells` são raw (VE%×10); VE Lambda/`VE`/média/mediana do run são % real.** Qualquer comparação entre os dois precisa passar por `rawVeToReal()` (`utils/correctionDisplay.ts`) — já rolou bug de fator saindo ~10x errado por esquecer essa conversão. Use `computeFactor`/`computeFactorGrid` em vez de dividir na mão.
