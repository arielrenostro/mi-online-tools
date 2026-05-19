# TopBar

Barra superior global da aplicação. Sempre visível, independente da tela ativa.

---

## Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Master Injection Online Tools  │  [📄 4bar - 1.csv  ▼]   [📋 Logs (2) ▼]   [⬇ Exportar]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

Três seções além do logotipo/nome: **Mapa**, **Logs** e **Exportar**.

---

## Seção: Mapa

### Estado: sem mapa carregado

```
[ + Importar Mapa ]
```

- Clique abre o seletor nativo de arquivo (aceita `.csv`)

### Estado: mapa carregado

```
[ 📄 4bar - 1.csv  ▼ ]
```

- Exibe ícone de arquivo e o nome do arquivo carregado
- Clique abre seletor de arquivo para **substituir** o mapa atual
- A substituição limpa o mapa editável e recarrega o original; logs permanecem

---

## Seção: Logs

### Estado: sem logs carregados

```
[ + Importar Log ]
```

- Clique abre seletor nativo de arquivo (aceita `.csv`; múltipla seleção permitida)

### Estado: logs carregados

```
[ 📋 Logs (2)  ▼ ]
```

- Clique abre o **painel dropdown de logs** (ver abaixo)

### Painel dropdown de logs

```
┌─ Logs ─────────────────────────────────────────────────────── [✕ Fechar] ──┐
│  Arraste para reordenar. A ordem define a concatenação temporal.             │
│                                                                               │
│  ☑  ≡  log_stream_20260516_155239.csv    12 min 34 s     [✕]               │
│  ☑  ≡  log_stream_20260517_091020.csv     8 min 02 s     [✕]               │
│  ☐  ≡  log_stream_20260517_093512.csv     3 min 11 s     [✕]               │
│         └─ desmarcado: carregado mas excluído da sessão ativa               │
│                                                                               │
│  Total selecionado: 20 min 36 s                                               │
│                                                          [ + Adicionar ]    │
└───────────────────────────────────────────────────────────────────────────────┘
```

- **Checkbox**: inclui/exclui o log da sessão ativa sem removê-lo da lista
- **≡ (handle)**: arraste para reordenar; a ordem define como os logs são concatenados temporalmente
- **✕ por linha**: remove o log permanentemente da sessão
- **+ Adicionar**: abre seletor de arquivo para adicionar mais logs
- Ao alterar qualquer configuração, os componentes que consomem os dados (TimeRail, gráficos, análise) são atualizados automaticamente

---

## Seção: Exportar

### Estado: sem mapa carregado

```
[ ⬇ Exportar ]  ← desabilitado, cinza
```

### Estado: mapa carregado

```
[ ⬇ Exportar ]  ← habilitado
```

- Clique faz download imediato do CSV no formato original da ECU
- O arquivo exportado contém o mapa **editável atual** (incluindo edições manuais e correções do auto-tuning)
- Nome sugerido para o arquivo baixado: `<nome_original>_tuned.csv`
- Não exibe diálogo de confirmação — o download inicia diretamente

---

## Comportamento de estado global

| Ação | Efeito |
|------|--------|
| Importar novo mapa | Substitui mapa original e editável; logs e seleção de tempo preservados |
| Remover log ativo | TimeRail e gráficos atualizam duração total; seleção de intervalo é ajustada ou limpa se ficou fora do range |
| Reordenar logs | TimeRail reconstrói linha do tempo com nova ordem de concatenação |
| Desmarcar log | Equivalente a remover da sessão ativa; log permanece na lista para reativar |
