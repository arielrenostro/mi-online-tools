## Why

Na aba VE, o mapa editável e as tabelas de correção (Direta, Ponderado, Amostras) compartilham a
mesma grade MAP×RPM, mas cada uma tem seu próprio cursor. Para ajustar o mapa a partir da correção,
o usuário precisa localizar mentalmente a mesma célula em outra tabela, e não consegue aplicar
atalhos de edição (F2, H, V, Ctrl+I/U…) enquanto o foco está numa tabela de correção.

## What Changes

- A seleção (âncora + retângulo) passa a ser **única e compartilhada** entre o mapa original, o mapa
  editável e as três tabelas de correção: clicar, arrastar ou navegar por teclado em qualquer uma
  move o cursor em todas.
- Os gráficos dos mapas (original e editável) refletem a seleção compartilhada, e uma seleção feita
  em um gráfico também vira a seleção compartilhada.
- Os atalhos de edição do mapa editável (F2, H, V, Ctrl+I/U, Delete, Ctrl+C/V, Enter, undo/redo)
  funcionam mesmo com o foco numa tabela de correção e **sempre agem sobre o mapa editável**, com o
  comportamento de hoje. O F2 abre o mesmo diálogo de ajuste em massa, sem usar o fator da correção.
- As tabelas de correção continuam somente leitura (nenhuma edição inline, nenhum fator aplicado
  por atalho); o botão "Aplicar correções no mapa" permanece como está.
- A seleção deixa de ser limpa quando o foco sai de uma tabela; passa a ser limpa apenas por Escape
  ou por clique fora de todas as tabelas.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `heatmap-editing`: seleção compartilhada entre tabelas da mesma grade; seleção sobrevive à troca
  de foco entre tabelas.
- `tuning-ve`: gráficos refletem (e alimentam) a seleção compartilhada, não só a da própria tabela.
- `tuning-ve-correction`: tabelas de correção participam da seleção compartilhada e delegam os
  atalhos de edição ao mapa editável, mantendo-se somente leitura.

## Impact

- `frontend/src/components/HeatmapTable.tsx` (seleção controlada, delegação de teclas, blur)
- `frontend/src/components/MapWithChart/MapWithChart.tsx` (deixa de guardar seleção própria)
- `frontend/src/features/tuning/ve/VETab.tsx`, `EditableMapSection.tsx`, `OriginalMapSection.tsx`,
  `CorrectionSection.tsx` (recebem a seleção compartilhada e o handler de teclas)
- Sem mudança em stores persistidas, parsers ou formato de arquivos. A seleção continua sendo
  estado de sessão, não persistido.
