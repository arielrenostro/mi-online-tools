# Aba Dados

**Arquivo:** `src/features/datalog/DataTab.tsx`
**TimeRail:** cursor destaca/rola para a linha correspondente; seleção filtra as linhas exibidas

## Colunas padrão (visíveis por padrão)

| Coluna | Sinal | Formato |
|--------|-------|---------|
| Tempo | `timestamp_ms` | `MM:SS.mmm` |
| RPM | `RPM` | inteiro |
| MAP | `MAP` | `{v} kPa` |
| Lambda 1 | `Lambda 1` | `{v:.3f}` |
| Lambda Target | `Lambda Target` | `{v:.3f}` |
| Lambda Corr | `Lambda Corr` | `{v:+.1f}%` |
| CLT | `CLT` | `{v} ºC` |

Colunas opcionais (demais sinais) via `[Colunas ▾]`. Persiste em `miot:ui` (`columnVisibility`).

## Comportamentos

- **Filtro:** com seleção no TimeRail, só linhas no intervalo; sem seleção, todos os logs ativos concatenados
- **Linha do cursor:** fundo azul + ícone `▶`; rola para o centro da viewport
- **Clicar em linha:** move o cursor pontual do TimeRail (sincroniza Dashboard e Gráficos)
- **Tabela virtualizada:** renderiza só as linhas visíveis (dezenas de milhares sem degradação)
- **Exportar CSV:** linhas visíveis, `;`-separated, UTF-8 com BOM, valores já convertidos
