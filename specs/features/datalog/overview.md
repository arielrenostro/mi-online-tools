# Datalog — Visão Geral

**Rota:** `/datalog`  
**Pré-requisito:** nenhum — a aba Logs é acessível sem logs; as demais abas exigem ao menos 1 log ativo  
**Specs relacionadas:** [master/datalog.md](../../master/datalog.md)

Funcionalidade de visualização e análise dos dados capturados pelo veículo. Permite inspecionar os sinais da ECU ao longo do tempo, selecionar intervalos para análise e explorar os dados brutos.

---

## Layout geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [TopBar]                                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  [TimeRail — sempre visível]                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ Logs ]  [ Dashboard ]  [ Gráficos ]  [ Dados ]                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  conteúdo da aba ativa                                                       │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Abas

| Aba | v1 | Guard | Descrição | Spec |
|-----|----|-------|-----------|------|
| Logs | ✅ | — | Gerenciamento de datalogs: adicionar, remover, reordenar, ativar/desativar | [logs.md](logs.md) |
| Dashboard | ✅ | `RequireLog` | Painel de instrumentos ao estilo gauge/display (layout a definir) | [dashboard.md](dashboard.md) |
| Gráficos | ✅ | `RequireLog` | Painéis de gráficos configuráveis, divididos horizontal/vertical | [charts.md](charts.md) |
| Dados | ✅ | `RequireLog` | Tabela de dados brutos pós-conversão | [data.md](data.md) |

---

## TimeRail — cursor de tempo

Componente fixo posicionado entre a TopBar e as abas. **Sempre visível** dentro da tela de Datalog. Impacta simultaneamente todas as abas.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  00:00 ──[══════════════════|▼|══════════════════════════════]── 20:36      │
│                              ↑ cursor pontual                                │
│           ████████▄▄▄▄████████████▄▄▄████████  ← miniatura de sensor       │
│           [══════|sel_start ═══════════ sel_end|]  ← seleção de intervalo   │
│                                                                               │
│  Cursor: 04:23.512    Seleção: 04:12 – 18:45  (14 min 33 s)  [Limpar]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cursor pontual

- Representado por uma linha vertical `▼` arrastável
- Define o "instante atual" exibido no Dashboard e destacado na aba Dados
- Projeta uma linha vertical sincronizada em **todos** os gráficos da aba Gráficos

### Seleção de intervalo

- Clique e arraste numa área livre do rail para criar uma região selecionada (banda sombreada)
- A seleção é usada por:
  - Aba Dados: filtra as linhas exibidas na tabela
  - Tuning: define o conjunto de pontos passados ao auto-tuning
- `[Limpar]` remove a seleção; todos os logs voltam a ser considerados integralmente

### Miniatura de sensor

- Inicia com a informação de RPM
- Deve permitir alterar através de um "combobox" por outro sensor
- Renderizada no fundo do rail como sparkline
- Serve como referência visual para identificar onde ocorreram acelerações, idle, etc.

### Múltiplos logs

- Os logs são concatenados na ordem definida pelo painel de logs da TopBar
- Uma linha separadora vertical é exibida no rail no ponto de junção entre logs
- O tempo exibido é sempre relativo ao início do primeiro log

### Logs distintos

- Sempre que um log não possuir a coluna "timestamp", ela deve ser criada dinamicamente e o intervalo será de 100ms entre cada linha

---

## Seleção e ordenação de logs

Realizada na aba **Logs** (`/datalog/logs`). Ver [logs.md](logs.md) para a especificação completa.

Em resumo: o usuário pode adicionar CSVs via drop zone ou file picker, reordenar arrastando pelo handle `≡`, ativar/desativar individualmente via toggle, e remover permanentemente via `✕`. A ordem e o estado de ativação persistem em IndexedDB + localStorage e se propagam ao TimeRail e às demais abas.
