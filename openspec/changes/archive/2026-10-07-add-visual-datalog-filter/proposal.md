## Why

O esmaecimento de pontos nos gráficos (e a linha esmaecida em Dados, o card "excluído" no Dashboard)
só reflete os filtros de correção do VE. Para inspecionar uma condição pontual — por exemplo "onde
o MAP estava entre 80 e 120 kPa e o RPM entre 3000 e 4000" — o usuário hoje precisa editar os
filtros de correção, o que também mexe no que alimenta "Gerar fator de correção". Falta uma forma
de destacar condições arbitrárias só para olhar, sem tocar nos filtros reais.

## What Changes

- Novo botão "Filtro visual" no topo da tela Datalog, ao lado do "?" de ajuda, que abre um modal.
- O modal lista ranges (min/max, ambos opcionais) para MAP, RPM, Lambda 1, Lambda Corr e Pedal; cada
  range tem um checkbox "usar", e o usuário não é obrigado a ativar todos.
- O modal também tem uma linha de Lambda Loop com checkbox "usar" e checkboxes para Aberto, Fechado
  e Fechado + auto-correção, combinada em AND com os ranges.
- "Aplicar" ativa o filtro visual; "Limpar" desativa tudo e restaura o comportamento anterior.
- Enquanto ativo, a máscara de pontos usada por Gráficos, Dados e Dashboard **é substituída** pela do
  filtro visual (AND entre os ranges ativos). Os filtros de correção continuam intactos e voltam a
  valer ao limpar.
- O toggle "visível/oculto" dos pontos excluídos continua valendo sobre a máscara ativa, seja ela a
  dos filtros de correção ou a do filtro visual.
- O filtro visual é só de sessão (memória) — não persiste em reload — e **nunca** afeta
  "Gerar fator de correção".
- O botão fica destacado enquanto o filtro visual está ativo, para indicar que o esmaecimento já não
  representa os filtros de correção.

## Capabilities

### New Capabilities
- `datalog-visual-filter`: botão e modal do filtro visual, semântica dos ranges (AND, opcionais),
  substituição da máscara de destaque, limpeza, efemeridade e isolamento do fator de correção.

### Modified Capabilities
- `datalog-charts`: o requisito "Correction-filtered points honor the visibility toggle" passa a
  descrever a máscara ativa (correção ou filtro visual), não só os filtros de correção.
- `datalog-table`: "Rows follow the timeline selection" e "Exporting visible rows" passam a seguir a
  máscara ativa.
- `datalog-dashboard`: "Cards flag correction-filter exclusion" passa a seguir a máscara ativa.

## Impact

- `frontend/src/hooks/useCorrectionMask.ts` — escolhe entre a máscara dos filtros de correção e a do
  filtro visual (ponto único de troca; consumidores não mudam).
- Novo store de sessão para o filtro visual (sem persistência) e função pura de avaliação dos ranges
  (ex.: `utils/visualFilter.ts`), com testes Vitest.
- `frontend/src/pages/DatalogPage.tsx` — botão ao lado do "?"; novo componente de modal em
  `features/datalog/`.
- Sem mudança em `generateCorrectionSnapshot`, `evaluateCorrectionFilters`, persistência ou
  `session-persistence`.
- Coexiste com a mudança em andamento `improve-datalog-charts-performance` (requisitos distintos em
  `datalog-charts`, sem sobreposição); um range estreito gera muitos trechos curtos, o que agrava a
  Open Question de `markArea` daquela mudança.
