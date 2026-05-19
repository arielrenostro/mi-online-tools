# Tuning › Aba Lambda

**Pré-requisito:** mapa carregado  
**Mapa da ECU:** Alvo de lambda — instruções `#A01`–`#A16`  
**Eixos:** linhas = MAP (kPa), colunas = RPM  
**Valores no CSV:** inteiros 0–2000 (ex.: `1000` = lambda 1.000)  
**Valores na UI:** decimais 0.00–2.00 (divididos por 1000)

---

## Layout

Mesmo padrão da aba VE, com duas seções:

```
┌─ [Mapa Original — colapsável] ─────────────────────────────────────────────┐
│  HeatmapTable (somente leitura) + Gráfico                                   │
│  Valores exibidos: 1.00, 0.85, etc.                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ Mapa Editável ─────────────────────────────────────── [Resetar] ──────────┐
│  HeatmapTable (editável) + Gráfico                                           │
│  Valores exibidos e editados: 1.00, 0.85, etc.                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Diferenças em relação à aba VE:**
- Sem botão "Auto Tuning" (edição apenas manual)
- Conversão de escala: valores armazenados como inteiros 0–2000; UI exibe decimais (÷1000)

---

## Conversão de escala

| Contexto | Valor |
|----------|-------|
| CSV / store / IndexedDB | Inteiro 0–2000 (ex.: `1000`, `850`) |
| Exibição na tabela | Decimal com 2 casas (`1.00`, `0.85`) |
| Edição inline (o usuário digita) | Decimal (`0.85`) |
| Ctrl+I (+1%) em célula `1.00` | `1.00 × 1.01 = 1.01` → armazena `1010` |
| Exportação CSV | Multiplicado por 1000 e arredondado (`850`) |

A conversão ÷1000 para exibição ocorre exclusivamente no componente `LambdaTab`, que passa uma versão escalonada dos cells para o `HeatmapTable`. Os callbacks de edição multiplicam por 1000 antes de persistir na store.

---

## Comportamento

Idêntico à aba VE para tudo que se refere à tabela editável:
- Seleção, edição inline, atalhos de teclado, F2 (modal de edição em massa)
- Ctrl+I / Ctrl+U (+1% / -1%) — opera sobre os valores decimais (ex.: `1.00 × 1.01 = 1.01`)
- Ctrl+Z / Ctrl+Y (undo/redo) — histórico independente do VE e da Ignição
- Botão "Resetar" — sempre visível, desabilitado quando não há edições
- Células modificadas: borda laranja
- Persistência automática no IndexedDB

---

## Escala do gráfico

O gráfico 2D usa os limites reais dos dados com 5% de padding (ex.: dados 0.78–1.00 → eixo Y ≈ 0.77–1.01), sem arredondar para inteiros. Isso garante boa visualização mesmo quando a variação é pequena.

---

## Undo/redo

O histórico de lambda é **independente** dos históricos de VE e ignição. Ver [ignition.md](ignition.md) para detalhes do roteamento de undo/redo.

---

## Exportação

Os valores editados de lambda são multiplicados por 1000 e arredondados antes de serem escritos no CSV, substituindo as linhas `#A01`–`#A16` originais.
