## 1. Store da faixa dos sinais

- [ ] 1.1 Criar `frontend/src/store/signalRangesStore.ts` com `overrides`, `setRange`, `resetOne`,
      `resetAll`, `hydrate`, o helper puro `resolveRange(name, overrides)` (sobrescrita ou padrão de
      `SIGNAL_MAP`) e `sanitizeSignalRanges`; persistir em `miot:signal-ranges` via `lsSet`. Verificar
      com `signalRangesStore.test.ts` (padrão do `constantsStore.test.ts`): sem sobrescrita devolve o
      padrão; `setRange` rejeita `min >= max` e não finitos e aceita negativos/zero; um sinal igual ao
      padrão não fica guardado; `resetOne`/`resetAll`; `sanitize` descarta nome inexistente, não
      numérico e `min >= max` entrada a entrada, mantendo as válidas.
- [ ] 1.2 Restaurar no reload: adicionar `restoreSignalRanges()` em `persistence/sessionRestorer.ts`
      junto à restauração das constantes (ausente/ilegível → padrões, sem erro). Verificar com teste
      (ou o harness já usado para o restorer) de que ranges salvos voltam e de que JSON inválido não
      lança.

## 2. Gráficos usam a faixa efetiva

- [ ] 2.1 `components/SyncedChart.tsx`: `buildOption(..., view?, ranges?)` resolve `min/max` de cada
      eixo Y com `resolveRange`; o componente assina `overrides` do store e o inclui nas dependências
      do `useMemo` do `option`. Aplicar sobre a assinatura final de `buildOption` da change
      `improve-datalog-charts-performance` se ela já tiver sido implementada. Verificar com teste em
      `SyncedChart.test.ts`: sem `ranges` os eixos têm a faixa padrão (suíte atual intacta) e com
      `{ MAP: { min: 0, max: 400 } }` só o eixo do MAP muda.
- [ ] 2.2 `components/XYChart.tsx`: `buildXYOption(series, xSignal, curves, ranges?)` usa
      `resolveRange` no eixo X, nos eixos Y e no `xRange` das curvas por faixa; o componente assina
      `overrides` no `useMemo`. Verificar com testes em `XYChart.test.ts`: eixo X e Y refletem a
      sobrescrita e `bandCurve` recebe `[lo, hi]` da faixa configurada.
- [ ] 2.3 No navegador (`npm run dev`), editar a faixa de Lambda 1 e de RPM e conferir que Gráficos e
      XY redesenham com o novo enquadramento mantendo painéis, sinais, seleção de tempo e cursor,
      e que Dashboard/Dados/Dinamômetro e runs de correção ficam inalterados.

## 3. Tela Configurações

- [ ] 3.1 Criar `features/settings/SignalRangesPanel.tsx`: uma linha por sinal de `DISPLAY_SIGNAL_DEFS`
      na ordem de `sortSignals` (inclui VE Lambda Corrigido, Potência, Torque), com dois
      `DraftNumberField` (mín/máx, aceitando negativo e zero), unidade, "Restaurar" por linha
      (desabilitado quando igual ao padrão) e "Restaurar todas" no cabeçalho (remonta as linhas).
      Verificar abrindo a tela sem mapa nem log: todos os sinais aparecem com o padrão.
- [ ] 3.2 Validação por par: a linha guarda os últimos números válidos digitados (`pending`) e só
      chama `setRange` quando `min < max`; senão marca ambos os campos com `forceInvalid` e mostra
      "mínimo deve ser menor que o máximo", mantendo o último par válido no store. Verificar no
      navegador: texto vazio/não numérico e `min >= max` ficam em vermelho e o gráfico não muda;
      digitar valores válidos limpa o aviso e aplica.
- [ ] 3.3 Incluir `<SignalRangesPanel />` em `pages/SettingsPage.tsx` depois do Ponderado, com texto
      explicando que a faixa só enquadra os eixos (não altera dados, filtro nem correção), e atualizar
      o comentário de cabeçalho da página. Verificar visualmente a seção e a divisória.

## 4. Specs e documentação

- [ ] 4.1 Conferir `frontend/CLAUDE.md`, `DatalogHelpModal.tsx` e o `CLAUDE.md` da raiz por menções a
      "faixa padrão"/eixos fixos ou à lista de stores/chaves de `localStorage`, e ajustar o que
      ficar desatualizado. Verificar com `grep -rn "faixa" frontend/src/features/datalog/DatalogHelpModal.tsx frontend/CLAUDE.md`.
- [ ] 4.2 Rodar `cd frontend && npm test && npx tsc --noEmit && npm run lint` e
      `openspec validate add-signal-axis-ranges --strict`; todos passam. Ao arquivar, os deltas de
      `app-settings`, `datalog-charts`, `datalog-xy` e `session-persistence` sincronizam os specs
      principais (regra do projeto: specs e código andam juntos).
