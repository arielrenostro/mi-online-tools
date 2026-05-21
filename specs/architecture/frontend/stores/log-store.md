# Store: `useLogStore`

Gerencia os datalogs: upload, remoção, reordenação, ativação/desativação e persistência.

**Arquivo:** `src/store/logStore.ts`

## Estado

```typescript
interface LogState {
  logs: LogEntry[]          // ordem de concatenação temporal; logs disabled continuam na lista
  isUploading: boolean
  lastError: string | null
}

interface LogActions {
  addLog(file: File): Promise<void>
  removeLog(hash: string): Promise<void>
  toggleLog(hash: string): void
  reorder(orderedHashes: string[]): void
  /** Garante que os logs estão no backend (cache por hash; no-op se já estiverem).
   *  Chamado por tuningStore.runTuning() antes de cada execução. */
  ensureLogsOnBackend(hashes: string[]): Promise<void>
  hydrate(entries: LogEntry[]): void   // sessionRestorer
}
```

Valores iniciais: `logs: []`, `isUploading: false`, `lastError: null`.

## Seletores

- **`selectActiveLogs`** — logs `enabled`, na ordem atual.
- **`selectTotalDuration`** — soma de `duration_ms` dos logs ativos.
- **`selectAllSignals`** — **interseção** dos sinais de todos os logs ativos (sinais presentes em TODOS), não união. O TimeRail e os gráficos exibem séries contínuas ao longo de toda a timeline concatenada; um sinal presente só em alguns logs criaria um "buraco" confuso. Ex.: Log A `[RPM,MAP,Lambda 1,CLT,Pedal]` + Log B `[RPM,MAP,Lambda 1,CLT]` → `[RPM,MAP,Lambda 1,CLT]`.

## Comportamento das actions

- **`addLog`** — calcula o SHA-1 **antes** do upload (detecta duplicatas e habilita o cache server-side). Duplicata → `lastError = "Log já carregado: …"`, no-op. Senão: parseia client-side (`parseDatalogClient`), adiciona ao `logs`, persiste o blob CSV + model no IndexedDB e a ordem no localStorage.
- **`removeLog`** — remove da lista e do IndexedDB. Se o log era ativo, dispara os side effects abaixo.
- **`toggleLog`** — inverte `enabled`. Dispara os side effects. Se desativou o último log ativo, também chama `clearSelection()`.
- **`reorder`** — reordena `logs` conforme `orderedHashes` (entradas não listadas vão para o final). Persiste só a ordem no localStorage — **não** invalida o tuning nem mexe no IndexedDB.
- **`ensureLogsOnBackend`** — para cada hash, lê o blob do IndexedDB e faz `uploadDatalog` (o cache por hash torna isso rápido — `cached: true`). Lança erro se o blob não existe (pede reimportação).

### Side effects ao alterar `activeLogs`

Toggle ou remoção que afete o conjunto de logs ativos dispara, via `getState()`:
1. `useTuningStore.clearOutput()` — o output foi calculado com outro conjunto de logs.
2. `useTimeStore.onTotalDurationChanged(newTotal)` — clampa o cursor e ajusta/remove a seleção.

## Tratamento de erro no upload

`addLog` traduz exceções em `lastError` legível: `ApiError 422` → "CSV inválido: …"; outros `ApiError` → "Erro do servidor: …"; `NetworkError` → "Sem conexão com o servidor."; `TimeoutError` → "Upload demorou muito. Tente com um arquivo menor."

## Persistência

| Dado | Onde | Quando |
|------|------|--------|
| `model` + `csvBlob` | IndexedDB (`logs`) | Após `addLog()` |
| Ordem (`orderedHashes`) + `enabled` (`enabledHashes`) | localStorage (`miot:log-order`) | Após `addLog`/`removeLog`/`reorder`/`toggleLog` |
| Remoção de log | IndexedDB (`logs`) | Dentro de `removeLog()` |

O model completo fica no IndexedDB; o localStorage guarda só hashes e `enabled` (pequenos, lidos sincronamente no restore). O blob CSV é necessário para `ensureLogsOnBackend()`.
