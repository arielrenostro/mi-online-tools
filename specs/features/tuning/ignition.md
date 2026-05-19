# Tuning › Aba Ignition

**Pré-requisito:** mapa carregado  
**Mapa da ECU:** Avanço de ignição — instruções `#I01`–`#I16`  
**Eixos:** linhas = MAP (kPa), colunas = RPM  
**Valores:** inteiros 0–100

---

## Layout

Mesmo padrão da aba VE, com duas seções:

```
┌─ [Mapa Original — colapsável] ─────────────────────────────────────────────┐
│  HeatmapTable (somente leitura) + Gráfico                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ Mapa Editável ─────────────────────────────────────── [Resetar] ──────────┐
│  HeatmapTable (editável) + Gráfico                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Diferenças em relação à aba VE:**
- Sem botão "Auto Tuning" (edição apenas manual)
- Valores exibidos e editados diretamente como inteiros (sem conversão de escala)
- Clamping: 0–100

---

## Comportamento

Idêntico à aba VE para tudo que se refere à tabela editável:
- Seleção, edição inline, atalhos de teclado, F2 (modal de edição em massa)
- Ctrl+I / Ctrl+U (+1% / -1%)
- Ctrl+Z / Ctrl+Y (undo/redo) — histórico independente do VE e do Lambda
- Botão "Resetar" — sempre visível, desabilitado quando não há edições
- Células modificadas: borda laranja
- Persistência automática no IndexedDB

---

## Undo/redo

O histórico de ignição é **independente** dos históricos de VE e lambda. `Ctrl+Z` na aba Ignition desfaz apenas edições de ignição.

O roteamento do undo/redo é feito em `TuningPage` com base no pathname:
- `/tuning/ignition` → `undoIgnition` / `redoIgnition`
- `/tuning/ve` → `undo` / `redo`
- `/tuning/lambda` → `undoLambda` / `redoLambda`

---

## Exportação

Os valores editados de ignição são incluídos automaticamente na exportação do CSV (menu "Exportar Mapa"), substituindo as linhas `#I01`–`#I16` originais.
