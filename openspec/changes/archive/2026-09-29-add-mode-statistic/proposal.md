## Why

A média é puxada por outliers e a mediana esconde a concentração dos dados. Ao ajustar o mapa VE, o
que o usuário quer saber é o valor de VE Lambda em torno do qual a célula realmente opera (o valor
aproximado que mais aparece), e hoje a seção de correção só oferece Média e Mediana.

## What Changes

- Nova estatística **Moda** no toggle Média/Mediana da seção de correção da aba VE, virando
  Média/Mediana/Moda.
- Moda por célula = valor aproximado mais frequente dos pontos que tocam a célula, calculado por
  janela deslizante de tolerância fixa (±0,5 ponto de VE): vence a janela com mais pontos, e a moda é
  a média dos pontos dentro dela; empate resolvido pela janela mais próxima da mediana.
- O snapshot passa a guardar `mode` por célula (junto de `mean` e `median`), então alternar para Moda
  não exige regenerar.
- Os fatores Direto e Ponderado passam a poder ser derivados da Moda; o tooltip das três tabelas
  lista a moda junto dos outros campos.
- Snapshots persistidos antes desta mudança (sem `mode`) continuam exibíveis com Média/Mediana; a
  opção Moda fica desabilitada com a dica de regenerar.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `tuning-ve-correction`: o snapshot por célula passa a incluir a moda; o toggle de estatística ganha
  a opção Moda; o tooltip lista a moda.
- `session-persistence`: comportamento de um snapshot restaurado que não tem moda.

## Impact

- `frontend/src/types/correction.ts` (`CorrectionCell.mode`)
- `frontend/src/utils/correctionGeneration.ts` (cálculo da moda) e testes
- `frontend/src/utils/correctionDisplay.ts` (`StatMode`, fatores) e testes
- `frontend/src/features/tuning/CorrectionSection.tsx` (toggle, tooltip, opção desabilitada)
- Restauração do snapshot em `frontend/src/persistence/` (snapshot antigo sem `mode`)
- Sem novas dependências, sem backend.
