# Datalog — Visão Geral

**Rota:** `/datalog`

Layout: `TopBar` → `TimeRail` (sempre visível) → abas `[Logs][Dashboard][Gráficos][Dados]` → conteúdo da aba ativa.

| Aba | Guard | Spec |
|-----|-------|------|
| Logs | — | [logs.md](logs.md) |
| Dashboard | `RequireLog` | [dashboard.md](dashboard.md) |
| Gráficos | `RequireLog` | [charts.md](charts.md) |
| Dados | `RequireLog` | [data.md](data.md) |

## TimeRail

Componente fixo abaixo da TopBar, sempre visível. Impacta todas as abas.

- **Cursor pontual** — linha vertical arrastável (`▼`). Define o "instante atual" no Dashboard e destaca a linha na aba Dados; projeta linha vertical em todos os gráficos. `←/→` movem 100 ms (+Shift: 1 s).
- **Seleção de intervalo** — clique-e-arraste. Filtra a aba Dados e define o conjunto para auto-tuning. `[Limpar]` ou `Escape` remove. Threshold mínimo: 200 ms de drag.
- **Miniatura de sensor** — sparkline no fundo do rail. Inicia com RPM; selecionável via combobox. Amostrada em até 500 pontos.
- **Múltiplos logs** — concatenados na ordem da aba Logs. Linha tracejada vertical no ponto de junção. Tempo sempre relativo ao início do primeiro log.
- **Logs sem coluna timestamp** — coluna criada com intervalo de 100 ms entre linhas.
- **Viewport band** — ao dar zoom nos gráficos, o rail escurece as regiões fora do zoom.

Persistência: `miot:time` (cursor_ms, selection, sparklineSensor).
