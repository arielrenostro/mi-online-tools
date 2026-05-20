# Aba Logs — Datalog

**Rota:** `/datalog/logs`  
**Pré-requisito:** nenhum — acessível mesmo sem logs carregados  
**Specs relacionadas:** [datalog/overview.md](overview.md) · [stores/log-store.md](../../architecture/frontend/stores/log-store.md) · [architecture/routes.md](../../architecture/frontend/routes.md)

Primeira aba da seção Datalog. Ponto central de gerenciamento dos datalogs da sessão: adicionar, remover, reordenar e ativar/desativar logs. A ordem e o estado de ativação definidos aqui se propagam para todas as demais abas (TimeRail, Dashboard, Gráficos, Dados) e para o auto-tuning.

---

## Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [ Logs ]  [ Dashboard ]  [ Gráficos ]  [ Dados ]                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Arraste arquivos CSV de datalog aqui                                │ │
│  │  ou clique para selecionar                                           │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  [erro]  Log já carregado: log_abc.csv                                    │
│                                                                            │
│  ≡  ◉  log_stream_20260516_155239.csv   12 min 34 s              [✕]    │
│  ≡  ◉  log_stream_20260517_091020.csv    8 min 02 s              [✕]    │
│  ≡  ○  log_stream_20260517_093512.csv    3 min 11 s              [✕]    │
│                                                                            │
│  Total ativo: 20 min 36 s                                                │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

### Legenda do item de log

```
≡   ◉   log_stream_20260516_155239.csv   12 min 34 s   [✕]
│   │   │                                │              │
│   │   └── nome do arquivo              │              └── botão remover
│   │                                    └── duração do log
│   └── toggle on/off (◉ = ativo, ○ = inativo)
└── drag handle (arrastar para reordenar)
```

---

## Componentes

### Drop zone

- Ocupa a largura total, altura fixa (~120 px)
- Borda pontilhada; ao hover: borda azul
- Aceita múltiplos arquivos `.csv` simultaneamente
- Ao soltar: chama `addLog(file)` para cada CSV na ordem em que foram selecionados
- Durante o upload (`isUploading === true`): texto "Carregando…" + indicador de progresso pulsante; drop zone permanece visível mas não interativa

### Item de log

Cada `LogEntry` na lista `logs` é renderizado como uma linha com quatro regiões:

| Região | Elemento | Interação |
|--------|----------|-----------|
| Drag handle `≡` | `cursor: grab`; `draggable` | Iniciar drag-to-reorder |
| Toggle | Botão switch animado | `toggleLog(hash)` |
| Info | Nome truncado + duração | — |
| Remover `✕` | Botão ícone, vermelho ao hover | `removeLog(hash)` |

A linha inteira tem opacidade reduzida (`opacity-60`) quando o log está inativo.

### Rodapé de totais

Exibido abaixo da lista quando há ao menos 1 log:

```
Total ativo: 20 min 36 s
```

- Usa `selectTotalDuration` do `useLogStore`
- Formato: `Xh Ym Zs` se ≥ 1 hora; `Ym Zs` se ≥ 1 min; `Zs` se < 1 min

### Estado vazio

Quando `logs.length === 0` e não está carregando:

```
Nenhum log carregado.
Arraste ou selecione arquivos CSV acima para começar.
```

---

## Drag-to-reorder

Implementado com a **API HTML5 drag-and-drop nativa** (sem bibliotecas extras).

### Sequência de eventos

1. `onDragStart` no handle `≡`: salva o índice de origem em ref local (`dragIndex.current = index`)
2. `onDragOver` no item destino: `e.preventDefault()` (habilita o drop); salva índice destino em ref (`overIndex.current = index`)
3. `onDrop` no item destino: chama `reorder(newOrderedHashes)`, onde `newOrderedHashes` é a lista de hashes reordenada movendo `dragIndex` para `overIndex`
4. `onDragEnd` no item arrastado: limpa os refs e remove qualquer estilo de indicador visual

### Indicador visual durante o drag

- O item sendo arrastado recebe `opacity-40`
- O item sobre o qual o cursor passa recebe uma borda superior ou inferior de 2 px azul indicando onde o item será inserido

### Persistência

Ao chamar `reorder(orderedHashes)`, o store atualiza a lista em memória e persiste a nova ordem em `miot:log-order` via `lsSet` (localStorage). Nenhuma chamada ao backend é feita — reordenação não invalida tuning nem modifica IndexedDB.

---

## Erros

O campo `lastError` do store é exibido quando não-nulo, imediatamente abaixo da drop zone:

```
┌─ erro ─────────────────────────────────────────────────────────────────┐
│  Log já carregado: log_stream_20260516_155239.csv                       │
└─────────────────────────────────────────────────────────────────────────┘
```

- Fundo `red-950`, texto `red-400`, borda sutil
- O erro some quando uma nova operação `addLog` é iniciada (`lastError` volta a `null`)

---

## Persistência

A aba Logs não implementa persistência própria — usa integralmente o mecanismo do `useLogStore`:

| Dado | Onde | Quando |
|------|------|--------|
| Blob CSV + model parseado | IndexedDB (`logs`) | `addLog()` |
| Ordem e estado `enabled` | localStorage (`miot:log-order`) | `addLog()`, `removeLog()`, `reorder()`, `toggleLog()` |

Ver [stores/log-store.md](../../architecture/frontend/stores/log-store.md) para a especificação completa.

---

## Localização do arquivo

`src/features/datalog/LogsTab.tsx`
