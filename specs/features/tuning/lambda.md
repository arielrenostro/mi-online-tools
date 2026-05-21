# Tuning › Aba Lambda

**Pré-requisito:** mapa carregado · **Mapa da ECU:** alvo de lambda (`#A01`–`#A16`) · **Eixos:** linhas = MAP (kPa), colunas = RPM

> Bloqueada na UI da v1 (visível mas não clicável). Esta spec descreve o comportamento previsto.

## Layout

Mesmo padrão da aba VE, com **duas** seções (sem a seção de Análise): Mapa Original (colapsável, read-only) e Mapa Editável (`[Resetar]`). Sem botão "Auto Tuning" (edição apenas manual).

## Conversão de escala

| Contexto | Valor |
|----------|-------|
| CSV / store / IndexedDB | Inteiro 0–2000 (ex.: `1000`, `850`) |
| Exibição e edição na tabela | Decimal com 2 casas (`1.00`, `0.85`) |
| `Ctrl+I` (+1%) em célula `1.00` | `1.00 × 1.01 = 1.01` → armazena `1010` |
| Exportação CSV | Multiplicado por 1000 e arredondado |

A conversão ÷1000 para exibição ocorre exclusivamente no `LambdaTab`, que passa uma versão escalonada dos cells ao `HeatmapTable`; os callbacks de edição multiplicam por 1000 antes de persistir na store.

## Comportamento

Idêntico à aba VE para a tabela editável: seleção, edição inline, atalhos de teclado, F2, `Ctrl+I`/`Ctrl+U` (±1%, operando sobre os valores decimais), `Ctrl+Z`/`Ctrl+Y` (undo/redo, histórico **independente** dos de VE e ignição — ver roteamento em [ignition.md](ignition.md)), botão "Resetar", células modificadas com borda laranja, persistência automática.

**Escala do gráfico:** o gráfico 2D usa os limites reais dos dados com 5% de padding (ex.: dados 0.78–1.00 → eixo Y ≈ 0.77–1.01), sem arredondar para inteiros — garante boa visualização mesmo com variação pequena.

## Exportação

Os valores editados de lambda são multiplicados por 1000 e arredondados antes de serem escritos no CSV, substituindo as linhas `#A01`–`#A16` originais.
