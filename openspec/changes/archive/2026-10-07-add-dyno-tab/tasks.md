## 1. Fórmula de potência/torque e sinais de runtime

- [x] 1.1 Criar `signals/enginePower.ts` (`computeEnginePower`) e `enginePower.test.ts`; verificar `npm run test` passando com o vetor da planilha (MAP 35, RPM 2567, IAT 50 ºC, λ 0,998, VE 59,225 × k 1,18985849 → ≈ 9,9765 cv e ≈ 2,7835 kgf·m), RPM 0 → torque 0, λ ≤ 0 → NaN
- [x] 1.2 Criar `store/constantsStore.ts` (`values`, `set`, `reset`, `hydrate`, `selectCalibrationFactor`) com persistência em `miot:constants` e `constantsStore.test.ts` (padrões 1587/9/0,8/1000, k = 1000/veAtFull, `set` não chama `correctionStore.markStale`); `npm run test` verde
- [x] 1.3 Criar `signals/runtimeSignals.ts` (`RUNTIME_SIGNAL_DEFS`: VE Lambda Corrigido, Potência, Torque, com `format`/`unit`/faixa 0–150, 0–300, 0–40) e expor em `signalRegistry.ts` (`SIGNAL_MAP` inclui os novos; `DISPLAY_SIGNAL_DEFS`); verificar que `datalogParser.ts` continua usando só `SIGNAL_DEFS` (teste: `parseDatalogText` não devolve as chaves novas nem as lista em `signals`)
- [x] 1.4 Criar `signals/displayRows.ts` (`getDisplayRows(logs, constants)` com cache de 1 entrada por referência) e `displayRows.test.ts`: três chaves calculadas na ordem VE Lambda Corrigido → Potência → Torque, mesmas referências com mesmas entradas, nova com constantes diferentes, `flattenActiveRows` intacto (sem as chaves)
- [x] 1.5 Criar `hooks/useDisplayRows.ts` (`useDisplayRows`, `useDisplaySignals`) e trocar `selectAllRows`/`selectAllSignals` por eles em `SyncedChart.tsx`, `ChartsTab.tsx`, `TimeRail.tsx`, `DashboardTab.tsx` e `DataTab.tsx`; `DataTab` passa a montar colunas de `DISPLAY_SIGNAL_DEFS`; verificar `npm run build` sem erro de tipos e, no app, as três colunas/cards/séries aparecendo e mudando ao editar uma constante
- [x] 1.6 Teste de isolamento em `correctionStore.test.ts`: `generate()` produz snapshot idêntico com `veAtFull` 1000 e 873, e alterar uma constante não marca o snapshot como desatualizado; `npm run test` verde

## 2. Seção Constantes na aba Logs

- [x] 2.1 Criar `features/datalog/ConstantsPanel.tsx` com os quatro campos (rótulos e unidades, pergunta "Qual o valor de VE atual onde a VE deveria ser 100%?" e "100% = 1000"), estado de texto local por campo, marca de campo inválido, fator `k` exibido e botão "Restaurar padrões"; verificar no app: valor inválido (vazio/0/negativo) marca o campo e mantém o último valor, 873 mostra k ≈ 1,146
- [x] 2.2 Renderizar `ConstantsPanel` em `LogsTab.tsx` abaixo do `CorrectionFilterPanel`, visível sem logs nem mapa; verificar abrindo `/datalog/logs` sem nada importado
- [x] 2.3 Restaurar em `persistence/sessionRestorer.ts` (`restoreConstants`, validando campo a campo, padrão em caso de ausente/ilegível) e verificar recarregando a página com valores alterados e com `miot:constants` corrompido (cai no padrão, sem erro)

## 3. Núcleo do dinamômetro (funções puras)

- [x] 3.1 Criar `store/dynoStore.ts` (`filters`, `mode`, `lossPct`, `smoothing`, `bandWidth`, ações de `set`/`hydrate`) com persistência em `miot:dyno` e restauração em `sessionRestorer.ts`; `DatalogTab` em `types/ui.ts` ganha `'dyno'`; verificar com `dynoStore.test.ts` (padrões: Pedal 90, CLT 80, Loop 0/1/2, Motor, 15%, Suavizado, 100 rpm) e recarga manual
- [x] 3.2 Criar `utils/dynoFilter.ts` (`selectDynoRows`: seleção de tempo + AND dos campos preenchidos, `null` sem limite, NaN falha, Lambda Loop por pertencimento, min RPM > max RPM inválido) e `dynoFilter.test.ts` cobrindo cada cenário do spec; `npm run test` verde
- [x] 3.3 Criar `utils/dynoCurve.ts` (`buildRawCurve`, `buildSmoothedCurve`, `applyLoss`) e `dynoCurve.test.ts`: raw ordenado por RPM, faixa vazia sem ponto, spike isolado (inclusive em faixa de 1–2 amostras) não vira pico, largura de faixa alterada reconstrói só o suavizado, perda 15% → 85% em ambos os eixos, motor não muda com a perda; `npm run test` verde

## 4. Aba Dinamômetro

- [x] 4.1 Criar `components/DynoChart.tsx` (ECharts, X = RPM `value`, duas yAxis cv/kgf·m, duas séries, tooltip por X, mensagem "nenhum dado nos filtros atuais" quando vazio, `large` acima de ~10k pontos); verificar no app com um log real (curvas visíveis, eixos legíveis, tooltip com RPM/cv/kgf·m)
- [x] 4.2 Criar `features/datalog/DynoTab.tsx`: campos de filtro (Pedal mín, RPM mín/máx, MAP mín, CLT mín, Lambda Loop), switches Roda/Motor (perda % só efetiva em Roda) e Bruto/Suavizado, campo de faixa de RPM, marcas de campo inválido, pipeline memoizado por etapa (decisão 6 do design); verificar no app cada cenário do spec `datalog-dyno` (inclusive filtros inconsistentes → mensagem sem dados, e correção/filtro visual sem efeito no gráfico)
- [x] 4.3 Adicionar a rota `dyno` em `App.tsx` (com `RequireLog`) e o `TabLink` "Dinamômetro" depois de "Dados" em `DatalogPage.tsx`; verificar que `/datalog/dyno` sem logs ativos redireciona para `/datalog/logs` e que, recarregando na aba, as configurações voltam
- [x] 4.4 Verificar desempenho com um log longo (dezenas de milhares de linhas): abrir a aba e editar filtro/switch/constante sem travar a página

## 5. Marcha e filtro de marcha do dinamômetro

- [x] 5.1 Parser: `SignalDef.optional`, sinal `Marcha` (`column: '0'`, último índice vence), `model.signals` só com sinais presentes, `parserVersion` no `DatalogModel`; verificar com `datalogParser.test.ts` (Marcha = 3 em `...;0;3`; sem a coluna importa normalmente e sem a chave; valor vazio mantém a linha sem Marcha) e `npm run test` verde
- [x] 5.2 Reconstrução na restauração: `restoreLogs` reparseia de `csvBlob` quando `parserVersion < PARSER_VERSION`, regrava o log e preserva ativo/ordem; falha mantém o `model` antigo; verificar com teste de unidade da função de migração e, no app, recarregando uma sessão salva antes (log ganha Marcha sem reimportar)
- [x] 5.3 `dynoStore` + `dynoFilter`: `gears` (padrão 0–5, ao menos uma, sanitize), restrição só com marchas desmarcadas, `Marcha` ausente/NaN falha só sob restrição; verificar com `dynoStore.test.ts` e `dynoFilter.test.ts` (uma marcha, várias, todas marcadas passa linha sem Marcha, sem Marcha sob restrição, última não desmarca)
- [x] 5.4 UI do filtro em `DynoTab.tsx`: checkboxes de marcha 0–5 e aviso quando há restrição e nenhum log ativo tem Marcha; verificar no app com logs reais (marcha 4 reduz as linhas; Marcha aparece em Dados/Dashboard/Gráficos) e que o filtro persiste no reload

## 6. Filtros do dinamômetro em modal

- [x] 6.1 Remover a faixa de RPM configurável: `bandWidth` sai do `dynoStore` (estado, ações, persistência, sanitize ignora o campo salvo) e vira `RPM_BAND_WIDTH = 100` em `dynoCurve.ts`; ajustar `dynoStore.test.ts` e `dynoCurve.test.ts`; `npm run test` verde
- [x] 6.2 `dynoStore.resetFilters()` (filtros + perda aos padrões, persistindo) com teste; verificar `npm run test` verde
- [x] 6.3 Criar `features/datalog/DynoFilterModal.tsx` (campos de filtro, marchas, Lambda Loop, Perda, "N de M linhas usadas", "Restaurar padrões" e "Fechar"; Escape e clique fora fecham) e trocar a barra de filtros do `DynoTab` por um botão "Filtros" (Roda/Motor e Bruto/Suavizado ficam na barra); verificar no app: filtros só aparecem no modal, edição vale ao fechar, fechar por ×/Escape/fora, restaurar padrões, sem campo de faixa de RPM

## 7. Ocultar o Filtro visual no Dinamômetro

- [x] 7.1 `DatalogPage.tsx` não renderiza o botão "Filtro visual" (nem abre o modal) na rota `/datalog/dyno`, mantendo o "?"; o filtro continua aplicado ao voltar às outras abas; verificar no app (botão ausente no dinamômetro, presente e ainda destacado ao voltar com um filtro ativo)

## 8. Specs e documentação

- [x] 8.1 Rodar `openspec validate add-dyno-tab --strict` sem erros
- [x] 8.2 Atualizar os índices de capabilities em `CLAUDE.md` (raiz) e `frontend/CLAUDE.md`: incluir `datalog-constants` e `datalog-dyno`; atualizar `Estrutura` (`signals/`, `hooks/`, `store/`, `utils/`), a lista de stores (`constantsStore`, `dynoStore`), os itens de persistência (`miot:constants`, `miot:dyno`) e registrar a convenção "sinal que depende de constantes é de runtime (`RUNTIME_SIGNAL_DEFS`), nunca vai no `model`; `generate()` usa `flattenActiveRows`"
- [x] 8.3 Ao arquivar/sincronizar, ajustar o `Purpose` de `openspec/specs/datalog-import/spec.md` para mencionar a seção Constantes, e confirmar que `datalog-charts`/`datalog-dashboard` ("every available signal") continuam corretos com os sinais novos
