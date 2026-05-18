# Datalog — Visão Geral

**Rota:** `/datalog`  
**Pré-requisito:** ao menos um log carregado  
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
│  ← Home    [ Dashboard ]  [ Gráficos ]  [ Dados ]    [ ⚙ Configurar logs ] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  conteúdo da aba ativa                                                       │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Abas

| Aba | v1 | Descrição | Spec |
|-----|----|-----------|------|
| Dashboard | ✅ | Painel de instrumentos ao estilo gauge/display (layout a definir) | [dashboard.md](dashboard.md) |
| Gráficos | ✅ | Painéis de gráficos configuráveis, divididos horizontal/vertical | [charts.md](charts.md) |
| Dados | ✅ | Tabela de dados brutos pós-conversão | [data.md](data.md) |

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

Acessível via botão `⚙ Configurar logs` na barra de abas ou via dropdown da TopBar.

```
┌─ Logs para visualização ──────────────────────────────────── [Confirmar] ──┐
│  Arraste para reordenar. A ordem define a concatenação temporal.             │
│                                                                               │
│  ☑  ≡  log_stream_20260516_155239.csv    12 min 34 s     [✕]               │
│  ☑  ≡  log_stream_20260517_091020.csv     8 min 02 s     [✕]               │
│  ☐  ≡  log_stream_20260517_093512.csv     3 min 11 s     [✕]               │
│                                                                               │
│  Total selecionado: 20 min 36 s                        [ + Adicionar ]     │
└────────────────────────────────────────────────────────────────────────────-┘
```

- **Checkbox**: inclui/exclui o log da visualização ativa sem removê-lo da lista
- **≡ (handle)**: drag-and-drop para reordenar
- **✕ por linha**: remove o log permanentemente
- **+ Adicionar**: abre seletor de arquivo para carregar mais logs
- Ao confirmar, o TimeRail e todas as abas são atualizados
