# Master Injection Online Tools — Visão Geral

App web para tuning assistido de mapas da ECU MasterInjection. O usuário sobe o mapa atual + datalogs de estrada; o app analisa desvios de lambda, sugere (ou aplica) correções no mapa de combustível e exporta o mapa atualizado.

## Escopo da v1

| # | Feature | Descrição |
|---|---------|-----------|
| F01 | Upload de mapa | Parsing do CSV MasterInjection |
| F02 | Visualização do mapa | Tabela RPM × MAP com heatmap |
| F03 | Upload de datalog | Um ou mais CSVs de log |
| F04 | Visualização de datalog | Gráficos de sinais no tempo |
| F05 | Seleção de intervalo | Zoom/seleção de trecho do log |
| F06 | Análise de tuning | Agrupamento por célula RPM×MAP, cálculo de desvios |
| F07 | Sugestão automática | Correções sugeridas com overlay visual |
| F08 | Tuning manual | Edição direta de células VE |
| F09 | Configuração de premissas | Parâmetros do motor de tuning |
| F10 | Exportação | Download do CSV original atualizado (VE + Ignição + Lambda) |
| F11 | Edição de ignição | Edição manual da tabela de avanço (`#I01`–`#I16`) |
| F12 | Edição de lambda alvo | Edição manual da tabela de alvo (`#A01`–`#A16`) |

## Roadmap (fases futuras)

- Auto-tuning dos mapas de ignição e lambda (hoje só edição manual)
- Insights automáticos (célula com poucos dados, região nunca visitada)
- Recomendações textuais por análise
- Histórico de sessões (comparação antes/depois)
- Overlay de múltiplos datalogs simultâneos
- Scatter RPM×MAP com pontos do log sobre o mapa

## Usuários-alvo

Mecânicos e preparadores que usam a ECU MasterInjection e precisam afinar o mapa de combustível com dados reais de estrada, sem dinamômetro.
