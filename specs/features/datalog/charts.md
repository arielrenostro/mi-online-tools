# Aba Gráficos

**Arquivo:** `src/features/datalog/ChartsTab.tsx` → `src/components/SyncedChart.tsx`

## Painéis

Cada painel tem barra de chips: `[Sinal ×]` remove, `[+ Sinal ▾]` abre dropdown. Múltiplos sinais no mesmo painel compartilham o eixo X; cada sinal pode ter eixo Y independente.

- `[↔]` divide o painel lado a lado
- `[+ ↓]` adiciona painel abaixo com a mesma altura do atual; a área total de gráficos cresce para acomodá-lo (mede a altura do painel e soma a `chartsHeight`; novo painel inserido com razão 0.5)
- Divisão recursiva; o último painel não pode ser removido

## Sincronização entre painéis

- **Eixo X:** sempre sincronizado — zoom/pan em qualquer painel aplica a todos
- **Zoom ↔ TimeRail (bidirecional):** `selection` é o conceito unificado de zoom e intervalo de análise
  - Scroll/pan no gráfico → ECharts `datazoom` → `setSelection` → TimeRail mostra ViewportBand + SelectionBand
  - CTRL+drag no gráfico → retângulo azul semitransparente → `setSelection` ao soltar
  - Drag no TimeRail → `setSelection` → `SyncedChart` faz `dispatchAction({ type: 'dataZoom' })`
  - Arrastar borda da SelectionBand no TimeRail → ajusta a borda correspondente do zoom
  - "Limpar" / Escape → `clearSelection` → gráficos voltam a 0–100%
- **Cursor:** linha vertical vermelha em todos os painéis
  - Clique em qualquer gráfico move o `cursor_ms` para a posição clicada
  - CTRL + mousemove sobre um gráfico atualiza o `cursor_ms` continuamente
- **Tooltip:** mover o mouse sobre qualquer painel exibe tooltip em todos no mesmo instante. Mostra o último ponto antes do cursor quando não há ponto exato.

## Sidebar de sinais

Painel lateral colapsável à direita da área de gráficos, com a tabela "Nome | Valor" de todos os sinais do log; o valor reflete a posição do cursor do TimeRail.

- **Aberto:** painel fixo (220px): header "Sinais" + botão fechar (`‹`); tabela com scroll de duas colunas; valores via `SIGNAL_MAP.get(signal).format(value)`; exibe "—" quando `cursor_ms` é null ou o sinal está ausente
- **Colapsado:** tira estreita (24px) com botão `›` para reabrir

Estado (`chartSidebarOpen`) persiste em `miot:ui`.

## Altura e persistência

Alça de redimensionamento no rodapé: min 200px, max 1200px, default 400px. Layout (árvore de divisões + sinais por painel), altura e estado da sidebar persistem em `miot:ui` (localStorage).

## Layout e scroll

O `ChartsTab` preenche toda a altura disponível (`h-full`) abaixo do `TimeRail`. Internamente:

- **Coluna de gráficos** (esquerda): `overflow-y-auto`; o conteúdo tem altura `chartsHeight` — permite scroll independente da sidebar.
- **Sidebar de Sinais** (direita): permanece sempre visível ao lado dos gráficos; sua tabela tem `overflow-y-auto` próprio para listas longas de sinais.
- **ResizeHandle**: fixo no rodapé do tab (sempre visível); redimensionar aumenta/diminui a altura do conteúdo rolável dos gráficos.
