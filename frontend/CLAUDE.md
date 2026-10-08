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
| `map-import-export` | Parsing/exportação client-side do CSV de mapa; controle na TopBar |
| `datalog-import` | Parsing client-side do CSV de datalog; aba Logs (lista + painel de filtros de correção); controle na TopBar |
| `datalog-timeline` | TimeRail: cursor, seleção de intervalo, sparkline, múltiplos logs |
| `datalog-dashboard` | Aba Dashboard |
| `datalog-charts` | Aba Gráficos: painéis sincronizados, sidebar de sinais |
| `datalog-table` | Aba Dados: tabela, colunas, exportação CSV |
| `datalog-visual-filter` | Filtro visual (botão ao lado do "?"): ranges que substituem o destaque dos filtros de correção, só exibição e só de sessão |
| `datalog-constants` | Seção Constantes (aba Logs): cilindrada/AFR/BSFC, calibração de VE (k) e sinais de runtime VE Lambda Corrigido, Potência, Torque |
| `datalog-dyno` | Aba Dinamômetro: curva potência/torque × RPM (Roda/Motor, Bruto/Suavizado, filtros próprios) |
| `heatmap-editing` | Edição de tabela N×M (seleção, atalhos de teclado, undo/redo) — usada por VE/Ignition/Lambda |
| `tuning-ve` | Aba VE: mapa original, mapa editável, seção de correção |
| `tuning-ve-correction` | Filtros de correção, geração do snapshot (atribuição bilinear + agregação), heatmap de correção, aplicação no mapa |
| `tuning-ignition` | Aba Ignition (bloqueada na v1) |
| `tuning-lambda` | Aba Lambda (bloqueada na v1) |
| `navigation-guards` | Rotas, guards (`RequireMap`/`RequireLog`), padrão de aba bloqueada |
| `session-persistence` | O que sobrevive a um reload, ordem de restauração, invalidação |
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
├── components/   HeatmapTable.tsx · SyncedChart.tsx · TimeRail.tsx · DynoChart.tsx · DraftNumberField.tsx
├── features/     tuning/ (inclui CorrectionSection.tsx) · datalog/ (inclui CorrectionFilterPanel.tsx · ConstantsPanel.tsx · DynoTab.tsx)
├── pages/        TuningPage.tsx · DatalogPage.tsx
├── parsers/      mapParser.ts · datalogParser.ts
├── persistence/  db.ts · *Persistence.ts · localStorage.ts · sessionRestorer.ts
├── signals/      signalRegistry.ts (sinais crus + derivados) · veLambdaFormula.ts · injectionEffective.ts · enginePower.ts · runtimeSignals.ts · displayRows.ts
├── utils/        correctionFilters.ts · visualFilter.ts · correctionGeneration.ts · dynoFilter.ts · dynoCurve.ts · mapRowOrder.ts · mapEditOps.ts · mapGridSelection.ts · chartLayoutSize.ts · chartLayoutMigration.ts · sparkline.ts · findLastRow.ts
├── hooks/        useCorrectionMask.ts · useDisplayRows.ts
├── store/        mapStore · logStore · correctionStore · visualFilterStore · constantsStore · dynoStore · timeStore · uiStore
└── types/        map · datalog · correction · ui
```

## Stores

- **`useMapStore`** — dono do mapa. `updateCell` = 1 undo; `bulkUpdateCells` = 1 undo para o batch inteiro. Histórico session-only, não persiste em IndexedDB.
- **`useLogStore`** — dono dos logs (parsing, ativação, ordem). `flattenActiveRows(logs)` concatena os logs ativos com timestamps deslocados — usada por qualquer código que precise da timeline única.
- **`useCorrectionStore`** — `draftFilters` (edição em andamento) vs. `filters` (aplicado — o que Dashboard/Gráficos/Dados e `generate()` realmente usam); `applyFilters()` copia draft→filters; `isFiltersDirty()` compara os dois. Toggle de visibilidade não passa por draft (aplica na hora). `generate()` roda a pipeline e grava o snapshot; `isStale`.
- **`useVisualFilterStore`** — filtro visual (`filter: { ranges, lambdaLoop }` — ranges de MAP/RPM/Lambda 1/Lambda Corr/Pedal + estados de Lambda Loop, em AND), só em memória (sem persistência, fora do `correctionStore` de propósito). Quando ativo, `useCorrectionMask()` devolve a máscara dele **no lugar** da dos filtros de correção — Gráficos/Dados/Dashboard seguem a máscara ativa. `generate()` nunca passa pelo hook, então o filtro visual não afeta o fator de correção.
- **`useConstantsStore`** — `values`: cilindrada, AFR, BSFC e `veAtFull` ("VE atual onde a VE deveria ser 100%", escala da tabela: 100% = 1000); só guarda valores válidos (> 0) — o texto cru em edição vive em `DraftNumberField`. `selectCalibrationFactor` → `k = 1000 / veAtFull`. Persiste em `miot:constants`. Mudar uma constante **não** marca o snapshot de correção como desatualizado.
- **`useDynoStore`** — filtros do dinamômetro (`null` = sem limite; `gears` = marchas aceitas, subconjunto de 0–5, todas = sem restrição, ao menos uma), `mode` (`engine`/`wheel`), `lossPct`, `smoothing` (`raw`/`smoothed`, padrão suavizado). Persiste em `miot:dyno`; `resetFilters()` devolve filtros e perda aos padrões. A faixa de RPM do suavizado é fixa (`RPM_BAND_WIDTH = 100` em `dynoCurve.ts`), não é configuração.
- **`useTimeStore`** — cursor_ms, selection, sparklineSensor, chartZoom. Persiste em `miot:time`.
- **`useUIStore`** — chartLayout (árvore de painéis), columnVisibility, datalogTab. Persiste em `miot:ui`. O tamanho dos painéis vive no layout: cada `ChartPanel` tem `height` (px) e o split `horizontal` tem `ratio` (fração da largura de `children[0]`); pilha vertical não tem proporção. Altura de uma linha = a maior dos painéis lado a lado; o total é a soma das linhas e a área rola na vertical (nunca estica). Só botões `+`/`−` redimensionam (`utils/chartLayoutSize.ts`, funções puras); não há arrasto. `hydrate` migra layouts antigos (`chartsHeight` + `ratio` vertical) via `utils/chartLayoutMigration.ts`.

## Convenções críticas

**Imports circulares:** `mapStore`, `logStore` e `timeStore` importam `correctionStore` via `import()` dinâmico dentro de métodos async (para invalidar/marcar o snapshot como desatualizado). Não importar na raiz do módulo.

**Roteamento por hash:** `App.tsx` usa `createHashRouter` (URLs `/#/datalog/charts`) para funcionar no CloudFront/S3 sem fallback para `index.html`. Leia a rota sempre via `useLocation`/`useBlocker`, nunca `window.location` (o `pathname` global é sempre `/`). Não use `href="#..."` como âncora.

**Favicon e preview de link:** ícones e `og-image.png` (1200×630) ficam em `public/` e são servidos na raiz; as tags `<link rel="icon">`/`og:*` estão em `index.html`. `og:url`/`og:image` precisam ser URL **absoluta** (o WhatsApp ignora caminho relativo) — hoje com o placeholder `https://SEU-DOMINIO`, trocar pelo domínio de produção. O `Makefile` sobe `public/*` com cache `immutable` de 1 ano (sem hash no nome): ao trocar uma imagem, renomeie o arquivo.

**PWA:** `vite-plugin-pwa` (config em `vite.config.ts`; manifest + `sw.js` gerados no `npm run build`, nada a registrar no código). Ícones `pwa-*.png` em `public/`. `sw.js`/`registerSW.js`/`manifest.webmanifest`/`index.html` não podem ter cache longo (ver `Makefile` e `nginx.conf`). Spec: `pwa`.

**Parsing client-side:** `parseMapClient` lê `#I20` (RPM), `#I21` (MAP), `#F01–#F16`. `parseDatalogClient` converte raw→real e calcula SHA-1 (só para deduplicar logs, sem upload).

**Sinais derivados:** um `SignalDef` tem `column`+`convert` (lido do CSV) OU `compute` (calculado de outros sinais já convertidos da mesma linha) — nunca os dois. `datalogParser.ts` aplica primeiro todos os `convert`, depois todos os `compute`, por linha. Exemplos: `VE Lambda`, `Inj. Efetivo` (`Inj. Pulse − Inj. DT`). Um derivado pode declarar `inputs` (nomes dos sinais que lê): só é calculado numa linha em que todos são números válidos e só é listado em `model.signals` quando todos estão listados — é como um derivado depende de colunas `optional` (sem `inputs`, como `VE Lambda`, é sempre calculado).

**Sinais de runtime:** sinal que depende de valor editável em runtime (hoje: `VE Lambda Corrigido`, `Potência`, `Torque`, calculados por `applyRuntimeSignals` em `runtimeSignals.ts` com as constantes) **nunca** vai no `compute` do parse nem no `model` persistido. Entra só na leitura: `getDisplayRows` (cache de 1 entrada) via `useDisplayRows()`/`useDisplaySignals()` — use-os em tudo que EXIBE dados (Dashboard, Gráficos, Dados, TimeRail, Dinamômetro). `generateCorrectionSnapshot`/`useCorrectionMask` seguem em `flattenActiveRows`/`log.model.rows`, sem essas chaves — é isso que impede o fator `k` de reescalar o mapa. `SIGNAL_MAP` cobre os dois tipos; o parser só lê `SIGNAL_DEFS`.

**Dinamômetro (`datalog-dyno`):** pipeline em funções puras memoizadas por etapa — `selectDynoRows` (seleção de tempo + filtros próprios, independente da máscara de correção/visual) → `buildRawCurve`/`buildSmoothedCurve` (faixas de RPM: mediana + mediana móvel com regra de ponta de Tukey + média móvel) → `applyLoss` (modo Roda). Filtros e Perda ficam num modal (`DynoFilterModal`, botão "Filtros" na barra da aba; sem rascunho/Aplicar — edição já vale); Roda/Motor e Bruto/Suavizado ficam na barra. O botão "Filtro visual" do `DatalogPage` fica oculto na rota `/datalog/dyno`. Potência em cv e torque em kgf·m (`Torque = Potência × 716,2 / RPM`).

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

**Correção VE (`tuning-ve-correction`):** filtros (Lambda Loop, CLT, Lambda, delta TPS, delta MAP, delta Lambda×Target, skip-closed-loop, skip-open-loop) são avaliados por `evaluateCorrectionFilters` — a MESMA função usada pela geração do snapshot e pela aplicação em Dashboard/Gráficos/Dados, para nunca haver duas implementações divergentes da mesma regra. Editar um filtro só muda o *draft* (aba Logs); nada em Dashboard/Gráficos/Dados/Gerar muda até clicar "Aplicar filtros" — sair da aba Logs com draft pendente (`useBlocker` do react-router) pede confirmação. "Gerar fator de correção" roda `generateCorrectionSnapshot` (atribuição bilinear em até 4 células + agregação por célula) uma vez sobre os filtros *aplicados*; os toggles Direto/Ponderado, Média/Mediana/Moda e Cor são derivações baratas em cima do snapshot já gerado, recalculadas ao vivo — só filtro aplicado/logs/seleção de tempo exigem gerar de novo.

**Lambda Loop tem 3 estados** (não 2): `0`=aberto, `1`=fechado, `2`=fechado + auto-correção. `isClosedLoop()` em `correctionFilters.ts` trata 1 e 2 como "fechado" pra fins de transição dos filtros skip-closed-loop e skip-open-loop (dois contadores independentes, um por sentido de transição — `computeClosedLoopSkipMask`/`computeOpenLoopSkipMask`, compartilhando `computeLoopTransitionSkipMask`; alternar entre 1↔2 sem passar por 0 não reinicia nenhum dos dois).

**Delta TPS/MAP** compartilham `computeDeltaAmplitude(rows, signal)` (amplitude max−min numa janela retroativa de 200ms) — mesma mecânica, sinal diferente (`Pedal` vs `MAP`).

**Gráficos e zoom da seleção:** `selection` (timeStore) é a fonte da verdade do zoom. Como o `option` usa `notMerge` (reinicia o `dataZoom` a 100%) e painéis novos/remontados também nascem a 100%, `PanelView` chama `applySelectionZoom` (contexto de `SyncedChart`) em `onChartReady` e num efeito `[option]` — sob a flag `updatingFromExternal`, para o handler de `datazoom` não devolver o zoom ao store. Não coloque o zoom no `option`: reconstruiria todas as séries a cada gesto.

**Sparkline da TimeRail:** `SparklineSVG` usa `viewBox` fixo (nada de medir o contêiner — o `ResizeObserver` antigo nunca era montado e a linha nunca desenhava); os dados vêm de `buildSparkline` (`utils/sparkline.ts`: min/max por bucket, lacunas viram trechos separados).

**Gráficos e pontos filtrados:** ECharts não colore segmento de linha por valor de forma confiável com `visualMap` nos nossos testes — `SyncedChart.tsx`'s `buildOption` em vez disso quebra cada sinal em uma série por trecho contíguo (`computeRuns`), uma cor cheia por trecho que passa no filtro e uma versão `rgba(...,0.25)` pro que não passa, com 1 ponto de sobreposição em cada fronteira pra nunca ter buraco na linha. Painéis com filtro pesado geram bastante série pequena — é o tradeoff aceito por confiabilidade visual.

**Persistência:**
- IndexedDB: mapa (blob + model), logs (blob + model), último snapshot de correção
- localStorage: `miot:log-order` · `miot:correction-filters` · `miot:correction-show-filtered` · `miot:ui` · `miot:time` · `miot:constants` · `miot:dyno`
- `sessionRestorer.ts` restaura tudo na inicialização sem nenhuma chamada de rede
- **Versão do leitor de CSV:** `parseDatalogText` grava `model.parserVersion = PARSER_VERSION` (em `datalogParser.ts`). Ao ler um sinal novo do CSV (ou mudar uma conversão), **incremente `PARSER_VERSION`** (hoje 3): `restoreLogs` chama `upgradeLogEntry` (`persistence/logMigration.ts`), que reparseia do `csvBlob` os logs salvos com versão menor (ausente = 1) e regrava no IndexedDB, sem reimportar; falha de leitura mantém o log como estava

**Ordem de exibição dos sinais:** `SIGNAL_GROUPS` (`signalRegistry.ts`) define grupos de sinais parecidos (VE → VE Lambda → VE Lambda Corrigido; Inj. Pulse → DT → Efetivo → Utiliz.; ...). `sortSignals` aplica essa ordem em `DISPLAY_SIGNAL_DEFS` (colunas e menu de Dados) e em `withRuntimeSignals` (`useDisplaySignals`: Dashboard, Gráficos, Dinamômetro) — na leitura, nunca gravada no `model`. Sinal novo: nomeie-o em um grupo (um teste falha se algum sinal conhecido ficar fora). A ordem do parser (`SIGNAL_DEFS`) é independente.

**Hash:** `computeHash(file)` → `"sha1:<hex>"` (só para detectar log duplicado, não usado em upload)

**Ordem das linhas do mapa:** convenção interna do frontend é **descendente** por MAP — `cells[0]`/`mapBreakpoints[0]` = **maior** MAP, batendo 1:1 com a exibição (`HeatmapTable` renderiza literal, sem inversão). O arquivo CSV exige ascendente (`cells[0]` = menor MAP); a conversão acontece só na fronteira `mapParser.ts`/`mapExporter.ts` (parse/export do CSV), via `utils/mapRowOrder.ts`. Não introduzir mais nenhum ponto de inversão — se precisar mexer em ordem de linha, é nesses arquivos.

**HeatmapTable:** valores inteiros 100–9999 (VE% × 10) no mapa editável. Também reusado, somente leitura, 3x em `CorrectionSection.tsx` (Direta/Ponderado/Amostras, lado a lado — sem toggle de modo) — nesse caso os valores são fatores (~1.00), não VE raw; usa `colorScale="symmetric"` (quente nos dois extremos, neutro no centro) pros dois de fator, `"coverage"` pro de amostras. `onCellChange` = 1 undo; `onBulkChange` = 1 undo para o batch. O toolbar de ícones (Ajuste/Interpolar/Undo/Redo) é interno ao componente, acima da tabela; `onReset`/`resetDisabled` (opcionais) colocam "Resetar" na mesma barra — é assim que `EditableMapSection` funciona hoje, em vez de um botão separado no header da seção. **Seleção compartilhada (aba VE):** `VETab` guarda `{anchor, selEnd}` (`Selection`, em `utils/mapEditOps.ts`) e a passa a Original, Editável, aos gráficos (via `MapWithChart`) e às 3 tabelas de correção; `HeatmapTable` aceita `selection`/`onSelectionChange` (controlado; sem eles, mantém seleção própria — Ignition/Lambda). Não há limpeza no blur: só Escape ou `mousedown` fora de `[data-map-grid-item]`/`[role="dialog"]` (listener no `VETab`). Tabelas `readOnly` tratam navegação sozinhas e repassam o resto via `onKeyDelegate` → `keyHandlerRef` da tabela editável (F2, H, V, Ctrl+I/U/C/V, Delete em intervalo); Enter/dígito/Delete em 1 célula nunca são delegados. As operações puras dos atalhos vivem em `utils/mapEditOps.ts`. Com `cellWidth` definido (uso em `MapWithChart`), o wrapper usa `overflow-x-auto` (não `overflow-hidden`) de propósito — um pequeno erro na estimativa de largura vira scroll em vez de cortar a última coluna.

## Invariantes

- Stores são a fonte de verdade — componentes não mantêm cópias locais.
- `sessionRestorer` não faz chamadas de rede (não existe rede a chamar).
- O snapshot de correção nunca guarda um "fator" — só `n`/média/mediana/moda por célula (`mode` é opcional: snapshots antigos não o têm — `snapshotHasMode()` desabilita a opção Moda); o fator é sempre derivado no read, contra o mapa atual.
- **`editableMap`/`originalMap.cells` são raw (VE%×10); VE Lambda/`VE`/média/mediana do snapshot são % real.** Qualquer comparação entre os dois precisa passar por `rawVeToReal()` (`utils/correctionDisplay.ts`) — já rolou bug de fator saindo ~10x errado por esquecer essa conversão. Use `computeFactor`/`computeFactorGrid` em vez de dividir na mão.
