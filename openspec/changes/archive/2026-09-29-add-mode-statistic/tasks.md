## 1. Modelo e cálculo da moda

- [x] 1.1 Adicionar `mode` opcional/nulável a `CorrectionCell` em `types/correction.ts` e uma constante nomeada para a tolerância (±0,5); verificar com `npm run build` sem erros de tipo
- [x] 1.2 Implementar o cálculo da moda (janela deslizante, desempate pela proximidade da mediana, depois o menor valor) em `utils/correctionGeneration.ts` e preencher `mode` em `generateCorrectionSnapshot`; verificar com testes unitários: cluster denso, empate, ponto único e célula sem dados (`npm run test`)

## 2. Exibição e fatores

- [x] 2.1 Estender `StatMode` com `'mode'` em `utils/correctionDisplay.ts` e fazer `computeDirectFactor`/`computeWeightedFactor` tratarem moda ausente como indisponível (não como "sem dados"); verificar com testes em `correctionDisplay.test.ts` para moda, e para snapshot antigo sem moda
- [ ] 2.2 Adicionar a opção Moda ao toggle e a linha `moda=` ao tooltip em `features/tuning/CorrectionSection.tsx`; verificar manualmente na aba VE que o toggle alterna os dois mapas de fator sem regenerar

## 3. Snapshots antigos

- [ ] 3.1 Detectar snapshot sem moda (alguma célula com `n > 0` sem `mode` numérico), desabilitar a opção Moda com a dica de regenerar e cair para Mediana se Moda estava selecionada; verificar restaurando um snapshot antigo (recarregar com snapshot salvo sem `mode`) e conferindo que Média/Mediana funcionam e que Moda fica desabilitada
- [ ] 3.2 Confirmar que gerar novamente habilita Moda e que "Aplicar correções no mapa" usa o fator ponderado da estatística selecionada; verificar manualmente com Moda selecionada

## 4. Specs

- [x] 4.1 Após implementar, conferir que `openspec/specs/tuning-ve-correction/spec.md` e `session-persistence/spec.md` descrevem a realidade (via `openspec validate add-mode-statistic --strict` e arquivamento da change), e atualizar a nota de `StatMode`/`CorrectionCell` em `frontend/CLAUDE.md`
