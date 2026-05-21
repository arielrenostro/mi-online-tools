# Tuning — Visão Geral

**Rota:** `/tuning` · **Pré-requisito:** mapa carregado · **Specs:** [tuning-engine.md](../../features/tuning-engine.md), [master/map.md](../../master/map.md)

Funcionalidade central da aplicação: visualizar, editar manualmente e aplicar correções automáticas aos mapas da ECU com base nos dados dos logs.

## Layout

`TopBar` → barra de abas (`← Home` · `VE` · `Ignition 🔒` · `Lambda 🔒`) → conteúdo da aba ativa.

## Abas

| Aba | Mapa da ECU | Instruções | v1 | Spec |
|-----|-------------|------------|----|------|
| VE | Eficiência volumétrica | `#F01`–`#F16` | ✅ | [ve.md](ve.md) |
| Ignition | Avanço de ignição | `#I01`–`#I16` | 🔒 | [ignition.md](ignition.md) |
| Lambda | Alvo de lambda | `#A01`–`#A16` | 🔒 | [lambda.md](lambda.md) |

Abas bloqueadas (`🔒`) são visíveis mas não clicáveis (tooltip "Disponível em breve").

## Comportamentos comuns

### Acesso conforme os logs

- **Sem logs** — mapa original e editável exibidos normalmente; edição manual disponível; o botão "Rodar Auto-tuning" fica desabilitado com a mensagem "Importe logs para usar o auto-tuning".
- **Com logs + seleção de tempo no TimeRail** — o intervalo é exibido como contexto no cabeçalho; o auto-tuning usa apenas os pontos do intervalo.
- **Com logs sem seleção** — usa todos os pontos dos logs ativos.

## Componentes compartilhados

- **`HeatmapTable`** — tabela N×M com gradiente de cores (azul → verde → amarelo → vermelho, calculado sobre os valores exibidos); usada no mapa original (read-only) e editável. Ver [components/heatmap-table.md](../../architecture/frontend/components/heatmap-table.md).
- **`MapChart`** — gráfico de suporte ao lado da tabela, em modo `MAP×RPM` ou `RPM×MAP`, 2D ou 3D; reflete o mapa editável em tempo real e sincroniza seleção/hover com a tabela. Ver [components/map-chart.md](../../architecture/frontend/components/map-chart.md).

## Configurações do motor de tuning

Acessíveis via ícone `⚙` na TopBar (ou `⚙ Config` na aba). Globais a todas as abas. Ver [config.md](config.md).
