## 1. Cálculo dos deltas

- [x] 1.1 Criar `frontend/src/signals/targetDelta.ts` com `computeDeltaLambdaTarget` (`Lambda 1 − Lambda Target`) e `computeDeltaBoostTarget` (`Boost − Boost Target`), e `targetDelta.test.ts` cobrindo os cenários da spec (mais pobre +0,035, mais rico −0,050, no alvo 0, boost +12 / −20 kPa); `npx vitest run targetDelta` passa

## 2. Registro de sinais e parser

- [x] 2.1 Em `signalRegistry.ts`, renomear o sinal `Turbo Target` para `Boost Target` mantendo `column: 'Turbo Target'`; atualizar `signalRegistry.test.ts` e `datalogParser.test.ts` (o CSV de teste continua com a coluna `Turbo Target`) e verificar que o log importado tem `Boost Target` e nenhum `Turbo Target`
- [x] 2.2 Adicionar `Delta Lambda 1 Target` (λ, −0,3…0,3, formato com sinal `+0.000`) e `Delta Boost Target` (kPa, −50…50, formato `+12 kPa`) em `SIGNAL_DEFS` como derivados (`compute`), e os nomes nos `SIGNAL_GROUPS` (grupos 1 e 3 da spec); testes de parser garantem que ambos existem em `model.signals`/linhas e a ordem agrupada
- [x] 2.3 Subir `PARSER_VERSION` para 4 em `datalogParser.ts`; atualizar `logMigration.test.ts` para verificar que um log salvo na versão 3 (com `Turbo Target`) é reparseado e ganha `Boost Target` e os dois deltas, mantendo enabled/order

## 3. Migração do nome salvo

- [x] 3.1 Adicionar `LEGACY_SIGNAL_NAMES` e `canonicalSignalName` em `signalRegistry.ts` (com teste unitário: nome antigo → novo, outros inalterados)
- [x] 3.2 Aplicar `canonicalSignalName` (com dedupe quando aplicável) em `sanitizeSignalRanges` (`signalRangesStore.ts`), `sanitizeXYSettings` (`xyStore.ts`), no `sparklineSensor` de `restoreTime` (`sessionRestorer.ts`) e na hidratação do `uiStore` (`columnVisibility` e `signals` dos painéis de `chartLayout`); um teste por ponto com estado salvo usando `Turbo Target` confirma que vira `Boost Target` e que não duplica quando os dois nomes aparecem
- [x] 3.3 Varrer `frontend/src` por `Turbo Target` (`grep -rn "Turbo Target" frontend/src`) e confirmar que só restam a coluna do CSV (`column:`), o mapa legado e fixtures de teste do CSV

## 4. Verificação de UI

- [x] 4.1 Verificar que os dois deltas aparecem sem mudança de componente em Dashboard, sidebar/seletor dos Gráficos, colunas e exportação CSV da aba Dados, XY e faixas de Configurações, e que não exibem o hover de "constantes"; se algum componente tiver lista de sinais própria, ajustá-la. Conferir no app (`npm run dev`) com um log real e rodar `npm run test` e `npm run build` sem erros

## 5. Specs e docs

- [x] 5.1 Sincronizar docs: atualizar `specs/master/datalog.md` (coluna `Turbo Target` = sinal "Boost Target"; derivados `Delta Lambda 1 Target`/`Delta Boost Target`), `frontend/CLAUDE.md` (versão do parser 3 → 4, exemplos de derivados) e conferir `openspec validate add-delta-target-signals --strict`
