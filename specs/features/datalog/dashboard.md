# Aba Dashboard

**Arquivo:** `src/features/datalog/DashboardTab.tsx`
**TimeRail:** cursor pontual define o instante exibido em todos os instrumentos

Grid de cards com o valor de cada sinal no instante do cursor. Mover o cursor atualiza todos simultaneamente. Sem cursor: exibe o primeiro instante do log.

Sinais em alarme (fora da faixa de `signalRegistry.ts`) recebem destaque visual (cor/borda a definir).

## Itens documentados na Ajuda

- Exibe valor de **todos os sinais** no instante do cursor em grid de cards
- Mova o cursor no TimeRail para atualizar os valores em tempo real
- Requer um log ativo e o cursor posicionado para exibir dados
