# Master Injection Online Tools — Visão Geral do Projeto

## Objetivo

Aplicação web para tuning assistido de mapas da ECU MasterInjection. O usuário faz upload do mapa atual e de um ou mais datalogs de estrada, a aplicação analisa os dados, identifica desvios de lambda e sugere (ou aplica automaticamente) correções no mapa de combustível — com visualização clara, regras configuráveis e exportação do mapa atualizado.

---

## Escopo da v1

| # | Feature | Descrição |
|---|---------|-----------|
| F01 | Upload de mapa | Leitura e parsing do CSV da MasterInjection |
| F02 | Visualização do mapa | Tabela RPM × MAP com heatmap de cores |
| F03 | Upload de datalog | Leitura de um ou mais CSVs de log |
| F04 | Visualização de datalog | Gráficos de sinais ao longo do tempo |
| F05 | Seleção de intervalo | Zoom/seleção de trecho do datalog para análise |
| F06 | Análise de tuning | Agrupamento de dados por célula RPM×MAP, cálculo de desvios |
| F07 | Sugestão automática | Mapa de correções sugeridas com overlay visual |
| F08 | Tuning manual | Edição direta de células do mapa VE |
| F09 | Configuração de premissas | Parâmetros do motor de tuning ajustáveis |
| F10 | Exportação | Download do mapa atualizado no formato CSV original (VE + Ignição + Lambda) |
| F11 | Edição de ignição | Edição manual da tabela de avanço de ignição (`#I01`–`#I16`) |
| F12 | Edição de lambda alvo | Edição manual da tabela de alvo de lambda (`#A01`–`#A16`) |

## Roadmap (fases futuras)

- Auto-tuning dos mapas de ignição e lambda (atualmente apenas edição manual)
- Insights automáticos (célula com poucos dados, região nunca visitada, etc.)
- Recomendações textuais geradas por análise
- Histórico de sessões (comparação de mapas antes/depois)
- Overlay de múltiplos datalogs simultâneos
- Plot de scatter RPM×MAP com pontos do log sobre o mapa

---

## Usuários-alvo

Mecânicos e preparadores que usam a ECU MasterInjection e precisam de uma ferramenta rápida para afinar o mapa de combustível com base em dados reais de estrada, sem depender de sessão em dinamômetro.
