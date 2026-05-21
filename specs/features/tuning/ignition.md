# Tuning › Aba Ignition

**Pré-requisito:** mapa carregado · **Mapa da ECU:** avanço de ignição (`#I01`–`#I16`) · **Eixos:** linhas = MAP (kPa), colunas = RPM · **Valores:** inteiros 0–100

> Bloqueada na UI da v1 (visível mas não clicável). Esta spec descreve o comportamento previsto.

## Layout

Mesmo padrão da aba VE, com **duas** seções (sem a seção de Análise):
1. **Mapa Original** (colapsável) — `HeatmapTable` read-only + gráfico
2. **Mapa Editável** — `HeatmapTable` editável + gráfico + `[Resetar]`

**Diferenças em relação à aba VE:**
- Sem botão "Auto Tuning" (edição apenas manual)
- Valores exibidos e editados diretamente como inteiros (sem conversão de escala)
- Clamping: 0–100

## Comportamento

Idêntico à aba VE para a tabela editável: seleção, edição inline, atalhos de teclado, F2 (edição em massa), `Ctrl+I`/`Ctrl+U` (±1%), `Ctrl+Z`/`Ctrl+Y` (undo/redo), botão "Resetar", células modificadas com borda laranja, persistência automática no IndexedDB.

**Undo/redo** — histórico **independente** dos de VE e lambda. O roteamento é feito em `TuningPage` pelo pathname: `/tuning/ignition` → `undoIgnition`/`redoIgnition`; `/tuning/ve` → `undo`/`redo`; `/tuning/lambda` → `undoLambda`/`redoLambda`.

## Exportação

Os valores editados de ignição entram automaticamente na exportação do CSV, substituindo as linhas `#I01`–`#I16` originais.
