# Aba Gráficos

**Arquivo:** `src/features/datalog/ChartsTab.tsx` → `src/components/SyncedChart.tsx`

## Painéis

Cada painel tem barra de chips: `[Sinal ×]` remove, `[+ Sinal ▾]` abre dropdown. Múltiplos sinais no mesmo painel compartilham eixo X; cada sinal tem eixo Y independente.

- `[↔]` divide painel focado lado a lado
- `[+ ↓]` adiciona painel abaixo
- Divisão recursiva; o último painel não pode ser removido

## Sincronização entre painéis

- **Eixo X:** sempre sincronizado — zoom/pan em qualquer painel aplica a todos
- **Zoom → TimeRail:** exibe ViewportBand (overlay escuro fora do zoom)
- **Cursor do TimeRail:** linha vertical vermelha em todos os painéis
- **Tooltip:** mover o mouse sobre qualquer painel exibe tooltip em todos no mesmo instante t. Via `onPointerMove` no container pai (persiste entre gaps). Mostra o último ponto antes do cursor quando não há ponto exato.

## Altura

Alça de redimensionamento no rodapé. Min 200px · Max 1200px · Default 400px.

## Persistência

Layout (árvore de divisões + sinais por painel) e altura em `miot:ui` (localStorage).
