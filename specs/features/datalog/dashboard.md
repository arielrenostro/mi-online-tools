# Aba Dashboard

**Arquivo:** `src/features/datalog/DashboardTab.tsx`
**TimeRail:** cursor pontual define o instante exibido em todos os instrumentos

Grid de cards com o valor de cada sinal no instante do cursor. Mover o cursor atualiza todos simultaneamente. Sem cursor: exibe o primeiro instante do log.

Sinais em alarme (fora da faixa de `signalRegistry.ts`) recebem destaque visual (cor/borda a definir).
