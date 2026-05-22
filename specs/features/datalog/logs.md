# Aba Logs

**Rota:** `/datalog/logs` (acessível sem logs) · **Arquivo:** `src/features/datalog/LogsTab.tsx`

## Layout

Drop zone (arrastar ou clicar, pulsante "Carregando…" durante upload) → mensagem de `lastError` → lista de logs → "Total ativo".

Cada linha: `≡` drag handle · `◉/○` toggle ativo/inativo (opacidade 60% quando inativo) · nome · duração · `[✕]` remover.

## Drop zone

Aceita múltiplos `.csv`; chama `addLog(file)` em sequência. Hash SHA-1 detecta duplicatas (`lastError = "Log já carregado: …"`).

## Drag-to-reorder (HTML5 nativo)

1. `onDragStart` — salva índice origem em ref
2. `onDragOver` — `preventDefault()` + salva índice destino
3. `onDrop` — `reorder(newOrderedHashes)`
4. Visual: item arrastando `opacity-40`; item alvo borda 2px azul

## Persistência

| Dado | Onde | Quando |
|------|------|--------|
| Blob CSV + model | IndexedDB `logs` | `addLog()` |
| Ordem + enabled | `miot:log-order` (localStorage) | `addLog/remove/reorder/toggle` |
| Seleção do TimeRail | Limpa automaticamente | Ao carregar novo log |

Reordenação não invalida tuning nem modifica IndexedDB — só atualiza localStorage.
