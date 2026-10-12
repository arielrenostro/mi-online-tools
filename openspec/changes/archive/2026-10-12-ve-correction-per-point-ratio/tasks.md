## 1. Tipos e núcleo de cálculo (testes primeiro)

- [x] 1.1 Em `types/correction.ts`: adicionar `samples: Float64Array | null` ao `CorrectionRun` (intercalado MAP, RPM, VE Lambda), tornar `cells` opcional e obsoleto, ajustar os comentários de `CorrectionCell` (mean/median/mode são razões) e `MODE_TOLERANCE` para 0,005
- [x] 1.2 Em `utils/correctionGeneration.ts`: escrever primeiro testes para a razão por ponto — incluir o caso dos dois pontos (MAP 50 e MAP 40, ambos −2%) que hoje dá +10% e deve dar 0,98, o ponto com mapa interpolado ≤ 0 descartado e a contagem `n` sem ele
- [x] 1.3 Implementar o plano por run (células e pesos por amostra, `n` por célula) reutilizando `bilinearWeights`, em cache por `WeakMap`
- [x] 1.4 Implementar a derivação de `CorrectionCell[][]` a partir de `(samples, breakpoints, mapa editável)`: `M_ponto = Σ w × mapa`, razão, média ponderada, mediana e moda (`densestClusterMode` com a nova tolerância)
- [x] 1.5 Trocar `computeCorrectionCells` por `collectSamples` (pontos qualificados dentro da faixa do mapa) e fazer `generateCorrectionRun` gravar `samples`
- [x] 1.6 Teste de regressão com os números reais (célula 40/800: método antigo +5,4%, novo ≈ −1,1% contra o `_tuned`) usando um conjunto sintético pequeno que reproduza o viés de gradiente

## 2. Fatores e exibição

- [x] 2.1 Em `utils/correctionDisplay.ts`: `computeDirectFactor` devolve a estatística escolhida (sem dividir pelo mapa); manter `computeWeightedFactor`, `computeApplyChanges` e as funções de percentual; remover `rawVeToReal` e `snapshotHasMode`; atualizar `correctionDisplay.test.ts`
- [x] 2.2 Em `features/mapa/CorrectionSection.tsx`: derivar as células com `useMemo` sobre `(run, editableMap)`, alimentar fatores/amostras/opacidade a partir delas, mostrar mean/median/mode da tooltip como percentual com sinal, e a opção Moda sempre disponível
- [x] 2.3 Estado "run sem amostras" na seção de correção: mensagem, sem fatores, sem aplicar; manter renomear/apagar
- [x] 2.4 Em `features/mapa/RunSelector.tsx`: distinguir "sem amostras" de "incompatível com o mapa"

## 3. Store e persistência

- [x] 3.1 Em `store/correctionStore.ts`: `generate` retorna null quando não há amostras; a seleção após apagar escolhe o run mais novo compatível **com** amostras; `isRunCompatible` inalterado
- [x] 3.2 Em `persistence/legacyMigration.ts` e `sessionRestorer.ts`: o run migrado do snapshot único e os runs lidos sem `samples` entram com `samples: null`; garantir que não são descartados
- [x] 3.3 Teste de ida e volta no IndexedDB/`sessionRestorer.test.ts`: run novo com `Float64Array` volta idêntico; run antigo carrega como "sem amostras"

## 4. Especificações e verificação

- [x] 4.1 Aplicar os deltas nos specs principais (`openspec` sync/archive) e ajustar à mão o *Purpose* de `correction-runs` ("map-independent")
- [x] 4.2 Conferir `specs/` e `frontend/CLAUDE.md` por menções à estatística antiga (VE Lambda absoluto por célula)
- [x] 4.3 `npm test` e `npm run build` em `frontend/`
- [x] 4.4 Verificação com os dados reais (feita com o código do app via `vite-node`, não pela interface) com os 5 logs de 10/10 e o mapa `30 - download_tuned`: célula MAP 40 / RPM 800 mostra ≈ −1,1% no Direto (média) e as células 30/2000 e 40/1200 deixam de mostrar +5% / +3%
- [x] 4.5 Medir o tempo de derivação com ~200 mil amostras e decidir se mediana/moda passam a sob demanda (decidido: não; ~64 ms no pior caso com `sort` numérico por célula)
