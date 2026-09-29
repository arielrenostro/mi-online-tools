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
| `heatmap-editing` | Edição de tabela N×M (seleção, atalhos de teclado, undo/redo) — usada por VE/Ignition/Lambda |
| `tuning-ve` | Aba VE: mapa original, mapa editável, seção de correção |
| `tuning-ve-correction` | Filtros de correção, geração do snapshot (atribuição bilinear + agregação), heatmap de correção, aplicação no mapa |
| `tuning-ignition` | Aba Ignition (bloqueada na v1) |
| `tuning-lambda` | Aba Lambda (bloqueada na v1) |
| `navigation-guards` | Rotas, guards (`RequireMap`/`RequireLog`), padrão de aba bloqueada |
| `session-persistence` | O que sobrevive a um reload, ordem de restauração, invalidação |

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
├── components/   HeatmapTable.tsx · SyncedChart.tsx · TimeRail.tsx
├── features/     tuning/ (inclui CorrectionSection.tsx) · datalog/ (inclui CorrectionFilterPanel.tsx)
├── pages/        TuningPage.tsx · DatalogPage.tsx
├── parsers/      mapParser.ts · datalogParser.ts
├── persistence/  db.ts · *Persistence.ts · localStorage.ts · sessionRestorer.ts
├── signals/      signalRegistry.ts (sinais crus + derivados) · veLambdaFormula.ts
├── utils/        correctionFilters.ts · correctionGeneration.ts · mapRowOrder.ts · mapEditOps.ts · mapGridSelection.ts
├── hooks/        useCorrectionMask.ts
├── store/        mapStore · logStore · correctionStore · timeStore · uiStore
└── types/        map · datalog · correction · ui
```

## Stores

- **`useMapStore`** — dono do mapa. `updateCell` = 1 undo; `bulkUpdateCells` = 1 undo para o batch inteiro. Histórico session-only, não persiste em IndexedDB.
- **`useLogStore`** — dono dos logs (parsing, ativação, ordem). `flattenActiveRows(logs)` concatena os logs ativos com timestamps deslocados — usada por qualquer código que precise da timeline única.
- **`useCorrectionStore`** — `draftFilters` (edição em andamento) vs. `filters` (aplicado — o que Dashboard/Gráficos/Dados e `generate()` realmente usam); `applyFilters()` copia draft→filters; `isFiltersDirty()` compara os dois. Toggle de visibilidade não passa por draft (aplica na hora). `generate()` roda a pipeline e grava o snapshot; `isStale`.
- **`useTimeStore`** — cursor_ms, selection, sparklineSensor, chartZoom. Persiste em `miot:time`.
- **`useUIStore`** — chartLayout (árvore de painéis), columnVisibility, chartsHeight, datalogTab. Persiste em `miot:ui`.

## Convenções críticas

**Imports circulares:** `mapStore`, `logStore` e `timeStore` importam `correctionStore` via `import()` dinâmico dentro de métodos async (para invalidar/marcar o snapshot como desatualizado). Não importar na raiz do módulo.

**Parsing client-side:** `parseMapClient` lê `#I20` (RPM), `#I21` (MAP), `#F01–#F16`. `parseDatalogClient` converte raw→real e calcula SHA-1 (só para deduplicar logs, sem upload).

**Sinais derivados:** um `SignalDef` tem `column`+`convert` (lido do CSV) OU `compute` (calculado de outros sinais já convertidos da mesma linha) — nunca os dois. `datalogParser.ts` aplica primeiro todos os `convert`, depois todos os `compute`, por linha. Exemplo: `VE Lambda`.

**Conversões raw→real** (definidas em `signalRegistry.ts`):

| Sinal | Conversão |
|-------|-----------|
| Lambda 1, Lambda Target | `raw / 1000` |
| Lambda Corr | `(raw - 1000) / 10` (%) |
| CLT, IAT | `raw - 273` |
| Pedal | `min(100, raw / 990 * 100)` |
| Lambda Loop | `raw` (0=OL, 1=CL) |

**Correção VE (`tuning-ve-correction`):** filtros (Lambda Loop, CLT, Lambda, delta TPS, delta MAP, delta Lambda×Target, skip-closed-loop, skip-open-loop) são avaliados por `evaluateCorrectionFilters` — a MESMA função usada pela geração do snapshot e pela aplicação em Dashboard/Gráficos/Dados, para nunca haver duas implementações divergentes da mesma regra. Editar um filtro só muda o *draft* (aba Logs); nada em Dashboard/Gráficos/Dados/Gerar muda até clicar "Aplicar filtros" — sair da aba Logs com draft pendente (`useBlocker` do react-router) pede confirmação. "Gerar fator de correção" roda `generateCorrectionSnapshot` (atribuição bilinear em até 4 células + agregação por célula) uma vez sobre os filtros *aplicados*; os toggles Direto/Ponderado, Média/Mediana e Cor são derivações baratas em cima do snapshot já gerado, recalculadas ao vivo — só filtro aplicado/logs/seleção de tempo exigem gerar de novo.

**Lambda Loop tem 3 estados** (não 2): `0`=aberto, `1`=fechado, `2`=fechado + auto-correção. `isClosedLoop()` em `correctionFilters.ts` trata 1 e 2 como "fechado" pra fins de transição dos filtros skip-closed-loop e skip-open-loop (dois contadores independentes, um por sentido de transição — `computeClosedLoopSkipMask`/`computeOpenLoopSkipMask`, compartilhando `computeLoopTransitionSkipMask`; alternar entre 1↔2 sem passar por 0 não reinicia nenhum dos dois).

**Delta TPS/MAP** compartilham `computeDeltaAmplitude(rows, signal)` (amplitude max−min numa janela retroativa de 200ms) — mesma mecânica, sinal diferente (`Pedal` vs `MAP`).

**Gráficos e pontos filtrados:** ECharts não colore segmento de linha por valor de forma confiável com `visualMap` nos nossos testes — `SyncedChart.tsx`'s `buildOption` em vez disso quebra cada sinal em uma série por trecho contíguo (`computeRuns`), uma cor cheia por trecho que passa no filtro e uma versão `rgba(...,0.25)` pro que não passa, com 1 ponto de sobreposição em cada fronteira pra nunca ter buraco na linha. Painéis com filtro pesado geram bastante série pequena — é o tradeoff aceito por confiabilidade visual.

**Persistência:**
- IndexedDB: mapa (blob + model), logs (blob + model), último snapshot de correção
- localStorage: `miot:log-order` · `miot:correction-filters` · `miot:correction-show-filtered` · `miot:ui` · `miot:time`
- `sessionRestorer.ts` restaura tudo na inicialização sem nenhuma chamada de rede

**Hash:** `computeHash(file)` → `"sha1:<hex>"` (só para detectar log duplicado, não usado em upload)

**Ordem das linhas do mapa:** convenção interna do frontend é **descendente** por MAP — `cells[0]`/`mapBreakpoints[0]` = **maior** MAP, batendo 1:1 com a exibição (`HeatmapTable` renderiza literal, sem inversão). O arquivo CSV exige ascendente (`cells[0]` = menor MAP); a conversão acontece só na fronteira `mapParser.ts`/`mapExporter.ts` (parse/export do CSV), via `utils/mapRowOrder.ts`. Não introduzir mais nenhum ponto de inversão — se precisar mexer em ordem de linha, é nesses arquivos.

**HeatmapTable:** valores inteiros 100–9999 (VE% × 10) no mapa editável. Também reusado, somente leitura, 3x em `CorrectionSection.tsx` (Direta/Ponderado/Amostras, lado a lado — sem toggle de modo) — nesse caso os valores são fatores (~1.00), não VE raw; usa `colorScale="symmetric"` (quente nos dois extremos, neutro no centro) pros dois de fator, `"coverage"` pro de amostras. `onCellChange` = 1 undo; `onBulkChange` = 1 undo para o batch. O toolbar de ícones (Ajuste/Interpolar/Undo/Redo) é interno ao componente, acima da tabela; `onReset`/`resetDisabled` (opcionais) colocam "Resetar" na mesma barra — é assim que `EditableMapSection` funciona hoje, em vez de um botão separado no header da seção. **Seleção compartilhada (aba VE):** `VETab` guarda `{anchor, selEnd}` (`Selection`, em `utils/mapEditOps.ts`) e a passa a Original, Editável, aos gráficos (via `MapWithChart`) e às 3 tabelas de correção; `HeatmapTable` aceita `selection`/`onSelectionChange` (controlado; sem eles, mantém seleção própria — Ignition/Lambda). Não há limpeza no blur: só Escape ou `mousedown` fora de `[data-map-grid-item]`/`[role="dialog"]` (listener no `VETab`). Tabelas `readOnly` tratam navegação sozinhas e repassam o resto via `onKeyDelegate` → `keyHandlerRef` da tabela editável (F2, H, V, Ctrl+I/U/C/V, Delete em intervalo); Enter/dígito/Delete em 1 célula nunca são delegados. As operações puras dos atalhos vivem em `utils/mapEditOps.ts`. Com `cellWidth` definido (uso em `MapWithChart`), o wrapper usa `overflow-x-auto` (não `overflow-hidden`) de propósito — um pequeno erro na estimativa de largura vira scroll em vez de cortar a última coluna.

## Invariantes

- Stores são a fonte de verdade — componentes não mantêm cópias locais.
- `sessionRestorer` não faz chamadas de rede (não existe rede a chamar).
- O snapshot de correção nunca guarda um "fator" — só `n`/média/mediana por célula; o fator é sempre derivado no read, contra o mapa atual.
- **`editableMap`/`originalMap.cells` são raw (VE%×10); VE Lambda/`VE`/média/mediana do snapshot são % real.** Qualquer comparação entre os dois precisa passar por `rawVeToReal()` (`utils/correctionDisplay.ts`) — já rolou bug de fator saindo ~10x errado por esquecer essa conversão. Use `computeFactor`/`computeFactorGrid` em vez de dividir na mão.
