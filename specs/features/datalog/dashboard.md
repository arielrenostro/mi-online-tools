# Datalog › Aba Dashboard

**Status:** ✅ v1 — layout a definir  
**Impacto do TimeRail:** o cursor pontual define o instante exibido em cada instrumento

---

## Objetivo

Painel de instrumentos ao estilo display de corrida. Exibe os valores dos sinais da ECU no instante apontado pelo cursor do TimeRail, de forma visual e de fácil leitura — análogo a um painel de dashboard em tempo real, mas navegável no histórico do log.

---

## Status

Layout e componentes visuais a serem definidos com base em print a ser fornecido pelo usuário.

---

## Comportamento esperado (independente do layout)

- Cada instrumento exibe o valor do sinal **no instante do cursor** do TimeRail
- Ao mover o cursor, todos os instrumentos atualizam simultaneamente
- Quando não há seleção de cursor (estado inicial), exibe o primeiro instante do log
- Sinais em estado de alarme (fora da faixa definida em [master/datalog.md](../../master/datalog.md)) devem ter algum destaque visual (cor, borda, animação — a definir)
