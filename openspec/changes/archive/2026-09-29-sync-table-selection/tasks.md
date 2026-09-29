## 1. Seleção compartilhada

- [x] 1.1 Adicionar props `selection`/`onSelectionChange` (controlado, com fallback interno) ao `HeatmapTable`, removendo `externalSelection` e o efeito de emissão; verificar com `npm run build` e que o VE ainda seleciona célula por clique/setas
- [x] 1.2 Elevar `{ anchor, selEnd }` ao `VETab` e passá-lo a Original, Editável e às 3 tabelas de `CorrectionSection`; verificar manualmente que clicar em qualquer tabela move o cursor em todas
- [x] 1.3 Fazer `MapWithChart` derivar `selectedCells` da seleção recebida e reportar seleção do gráfico via `onSelectionChange` (remover `externalSelection`); verificar que ambos os gráficos destacam a seleção feita em qualquer tabela e que clique/box no gráfico seleciona nas tabelas

## 2. Foco e limpeza

- [x] 2.1 Remover a limpeza no `onBlur` do wrapper; limpar apenas por Escape e por `mousedown` fora do container `data-map-grid`; verificar que trocar de tabela mantém o cursor e que clicar fora / Escape limpa
- [x] 2.2 Garantir que toolbar, `BulkEditModal` e `ConfirmDialog` não limpam a seleção; verificar manualmente cada controle

## 3. Delegação de teclas

- [x] 3.1 Extrair a lógica de atalhos que age sobre valores (F2, H, V, Ctrl+I/U, Delete, Ctrl+C/V, Enter, dígito) de `handleContainerKey` para um hook/funções reutilizáveis, com testes unitários das partes puras; `npm run test` verde
- [x] 3.2 Adicionar `onKeyDelegate` às tabelas `readOnly`: navegação/Escape locais, demais teclas repassadas ao mapa editável; verificar que F2, H, V, Ctrl+I/U, Delete, Ctrl+C/V funcionam a partir de Direta, Ponderado e Amostras e agem só no mapa editável
- [x] 3.3 Verificar que F2 a partir de uma tabela de correção abre o mesmo diálogo, sem usar fator, e que duplo clique/dígito nas tabelas de correção não abrem edição inline

## 4. Specs e documentação

- [x] 4.1 Atualizar `frontend/CLAUDE.md` (seção HeatmapTable: seleção controlada e delegação de teclas) e conferir que as specs de `heatmap-editing`, `tuning-ve` e `tuning-ve-correction` descrevem o comportamento final
- [x] 4.2 Rodar `openspec validate sync-table-selection` e `npm run build && npm run test`, e testar manualmente o fluxo completo (clicar na correção → ver no mapa → F2 → aplicar → undo)
