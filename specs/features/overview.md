# Features — Visão Geral

Mapa de todas as telas e funcionalidades da aplicação, com seus pré-requisitos e status na v1.

---

## Estrutura de navegação

```
Aplicação
├── TopBar (sempre visível)
├── Home /
├── Tuning /tuning
│   ├── Aba: VE
│   ├── Aba: Ignition  🔒
│   └── Aba: Lambda    🔒
└── Datalog /datalog
    ├── TimeRail (sempre visível dentro do Datalog)
    ├── Aba: Dashboard
    ├── Aba: Gráficos
    └── Aba: Dados
```

---

## Telas e funcionalidades

| Tela / Componente | Rota | Pré-requisito | v1 | Spec |
|-------------------|------|---------------|----|------|
| TopBar | — | — | ✅ | [topbar/topbar.md](topbar/topbar.md) |
| Home | `/` | — | ✅ | [home/home.md](home/home.md) |
| **Tuning** | `/tuning` | Mapa carregado | ✅ | [tuning/overview.md](tuning/overview.md) |
| └ Aba VE | — | — | ✅ | [tuning/ve.md](tuning/ve.md) |
| └ Aba Ignition | — | — | 🔒 | [tuning/ignition.md](tuning/ignition.md) |
| └ Aba Lambda | — | — | 🔒 | [tuning/lambda.md](tuning/lambda.md) |
| **Datalog** | `/datalog` | 1+ logs carregados | ✅ | [datalog/overview.md](datalog/overview.md) |
| └ TimeRail | — | — | ✅ | [datalog/overview.md](datalog/overview.md) |
| └ Aba Dashboard | — | — | ✅ | [datalog/dashboard.md](datalog/dashboard.md) |
| └ Aba Gráficos | — | — | ✅ | [datalog/charts.md](datalog/charts.md) |
| └ Aba Dados | — | — | ✅ | [datalog/data.md](datalog/data.md) |
| Config (modal) | — | — | ✅ | [tuning/config.md](tuning/config.md) |

---

## Componentes compartilhados

| Componente | Usado em | Descrição |
|------------|----------|-----------|
| HeatmapTable | Tuning (VE, Ignition, Lambda) | Tabela 16×16 com gradiente de cores, editável ou somente leitura |
| MapChart | Tuning (todas as abas) | Gráfico MAP×RPM e RPM×MAP em heatmap |
| TimeRail | Datalog (todas as abas) | Cursor de tempo + seleção de intervalo |
| SyncedChart | Datalog › Gráficos | Gráfico de linha com tooltip e eixo X sincronizados |

---

## Fluxo típico de uso

```
1. Usuário importa mapa via TopBar
2. Usuário importa um ou mais logs via TopBar
3. Acessa Datalog → Gráficos para revisar a qualidade dos dados
4. Usa TimeRail para selecionar o trecho relevante
5. Acessa Tuning → VE
6. Clica em "Rodar Auto-tuning" (usa a seleção do TimeRail)
7. Revisa o mapa editável com as correções plotadas
8. Ajusta células manualmente se necessário
9. Clica em "Exportar" na TopBar para baixar o mapa atualizado
```
