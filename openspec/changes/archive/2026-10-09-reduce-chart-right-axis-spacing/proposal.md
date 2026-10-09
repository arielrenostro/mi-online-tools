## Why

Na aba Gráficos, quando um painel tem 3 ou mais sinais, os eixos Y da direita ficam muito
afastados entre si: cada eixo reserva 52 px, bem mais do que os rótulos (fonte 9 px) ocupam. O
espaço em branco entre os eixos come largura da área de plotagem e deixa a leitura dispersa.

## What Changes

- Reduzir a distância entre eixos Y adjacentes do lado direito dos painéis do Gráficos, mantendo
  rótulos legíveis e sem sobreposição.
- Reduzir de forma correspondente a margem direita reservada pela grade, para a área de plotagem
  ganhar a largura liberada.
- Tirar a margem fixa da esquerda: ela passa a caber só nos rótulos do eixo do 1º sinal.
- Usar a mesma margem esquerda/direita em todos os painéis (a maior de cada lado), para as áreas de
  plotagem ficarem alinhadas — um painel com 1 sinal reserva à direita o mesmo que o de 3 sinais.
- Faixas, zoom, cursor e filtro não mudam.

## Capabilities

### New Capabilities

### Modified Capabilities
- `datalog-charts`: novos requisitos sobre o espaçamento compacto dos eixos Y e o alinhamento das áreas de plotagem entre painéis.

## Impact

- Código: `frontend/src/components/SyncedChart.tsx` (`buildOption` — `offset` dos eixos Y e `grid.right`)
  e seu teste `SyncedChart.test.ts`.
- Spec: `openspec/specs/datalog-charts/spec.md` (via delta desta change).
- Fora do escopo: aba XY (`XYChart`) e Dinamômetro, que têm layout de eixos próprio.
