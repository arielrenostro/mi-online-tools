# Tuning — Visão Geral

**Rota:** `/tuning`  
**Pré-requisito:** mapa carregado  
**Specs relacionadas:** [tuning-engine.md](../../features/tuning-engine.md), [master/map.md](../../master/map.md)

Funcionalidade central da aplicação. Permite visualizar, editar manualmente e aplicar correções automáticas aos mapas da ECU com base nos dados dos logs.

---

## Layout geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [TopBar]                                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ← Home    [  VE  ]  [ Ignition 🔒 ]  [ Lambda 🔒 ]                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  conteúdo da aba ativa                                                       │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Abas

| Aba | Mapa da ECU | Instruções | v1 | Spec |
|-----|-------------|------------|----|------|
| VE | Eficiência volumétrica | `#F01`–`#F16` | ✅ | [ve.md](ve.md) |
| Ignition | Avanço de ignição | `#I01`–`#I16` | 🔒 | [ignition.md](ignition.md) |
| Lambda | Alvo de lambda | `#A01`–`#A16` | 🔒 | [lambda.md](lambda.md) |

Abas bloqueadas (`🔒`) são visíveis mas não clicáveis. Exibem tooltip "Disponível em breve" ao hover.

---

## Comportamentos comuns a todas as abas

### Acesso sem logs

A aba de tuning pode ser acessada mesmo sem logs carregados. Nesse caso:
- O mapa original e o mapa editável são exibidos normalmente
- O botão "Rodar Auto-tuning" exibe mensagem "Importe logs para usar o auto-tuning" e permanece desabilitado
- Edição manual de células continua disponível

### Acesso com logs e seleção de tempo

Quando há logs carregados e uma seleção de intervalo definida no TimeRail do Datalog:
- O intervalo selecionado é exibido como contexto no cabeçalho da aba (ex.: `Fonte: 2 logs · 14 min 33 s selecionados`)
- "Rodar Auto-tuning" usa apenas os pontos dentro desse intervalo

### Acesso com logs sem seleção

Usa todos os pontos dos logs ativos.

---

## Componentes compartilhados entre abas

### HeatmapTable

Tabela N×M com gradiente de cores. Usado no mapa original (somente leitura) e no mapa editável.

- Gradiente: **azul** (mínimo) → **verde** → **amarelo** → **vermelho** (máximo)
- Calculado dinamicamente sobre os valores do mapa exibido
- Hover: tooltip com RPM, MAP e valor da célula
- Células modificadas exibem marcador visual no canto (ponto ou borda colorida)

### MapChart

Dois heatmaps de suporte exibidos abaixo do mapa editável:

| Gráfico | Eixo X | Eixo Y |
|---------|--------|--------|
| MAP × RPM | RPM | MAP (kPa) |
| RPM × MAP | MAP (kPa) | RPM |

Ambos refletem o mapa editável em tempo real. Hover e clique sincronizam com a célula selecionada na tabela.

---

## Configurações do motor de tuning

Acessíveis via ícone `⚙` na TopBar. Ver spec completa em [config.md](config.md).
