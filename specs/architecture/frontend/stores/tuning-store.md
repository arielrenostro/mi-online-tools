# Store: `useTuningStore`

Gerencia a configuração do auto-tuning, o engine selecionado, a execução e o resultado (`TuningOutput`).

**Arquivo:** `src/store/tuningStore.ts`

## Estado

```typescript
interface TuningState {
  config:           TuningConfig         // DEFAULT_TUNING_CONFIG; restaurado do localStorage
  selectedEngineId: string               // default "ve_lambda" (único na v1); persistido
  lastOutput:       TuningOutput | null   // null = nunca rodou ou foi limpo; persistido no IndexedDB
  isRunning:        boolean               // POST /api/tuning/run em andamento
  lastError:        string | null
  configDirty:      boolean               // config alterada após o último output (output desatualizado)
}

interface TuningActions {
  updateConfig(partial: Partial<TuningConfig>): void
  resetConfig(): void
  setEngine(engineId: string): void
  runTuning(): Promise<void>
  clearOutput(): void
  hydrateConfig(config: TuningConfig): void   // sessionRestorer
  hydrateEngineId(engineId: string): void     // sessionRestorer
  hydrateOutput(output: TuningOutput): void   // sessionRestorer
}
```

Valores iniciais: `config: DEFAULT_TUNING_CONFIG`, `selectedEngineId: 've_lambda'`, demais `null`/`false`.

## Comportamento das actions

- **`updateConfig` / `resetConfig`** — atualizam `config`, marcam `configDirty = true`, persistem em `miot:config`. **Não** limpam `lastOutput` (o usuário decide se re-roda).
- **`setEngine`** — atualiza `selectedEngineId`, persiste, `configDirty = true`, e chama `clearOutput()` (engine novo pode gerar output incompatível).
- **`clearOutput`** — `lastOutput = null`, `configDirty = false`, limpa o IndexedDB.
- **`hydrateOutput`** — restaura `lastOutput` **sem** chamar `applyTuningOutput` (o `mapStore` já foi hidratado com os `editableCells` salvos).

## Fluxo de `runTuning()`

```
Validação 1: originalMap e editableMap != null?  → não: set lastError, return
Validação 2: activeLogs.length > 0?              → não: set lastError, return
Monta TuningRunRequest:
  engineId, rpmBreakpoints/mapBreakpoints (de originalMap), cells = editableMap,
  logHashes (dos logs ativos), timeRange = useTimeStore.selection (null = tudo), config
set isRunning = true
ensureLogsOnBackend(logHashes)        → erro: set isRunning=false, lastError, return
apiRunTuning(request) [timeout 120s]
  sucesso → set lastOutput, isRunning=false, configDirty=false
          → saveTuningOutput(output) no IndexedDB (~200KB; falha é não-fatal)
          → useMapStore.applyTuningOutput(output.suggestedMap)
  erro    → set isRunning=false, lastError = formatTuningError(err)
```

`runTuning` lê `useMapStore`, `useLogStore` e `useTimeStore` via `.getState()` — não via hooks — para evitar ciclos, funcionar em função async e não causar re-renders.

### `formatTuningError`

`ApiError 404` → "Um ou mais logs não foram encontrados no servidor. Tente rodar novamente."; `ApiError 422` → "Configuração inválida: …"; outros `ApiError` → "Erro do servidor: …"; `NetworkError` → "Sem conexão com o servidor…"; `TimeoutError` → "O auto-tuning demorou muito. Tente com um intervalo menor."

## `configDirty`

`true` quando a config muda após o último output (`updateConfig`, `resetConfig`, `setEngine`); `false` ao concluir `runTuning`, em `clearOutput` e `hydrateOutput`. A UI exibe um aviso (ícone amarelo) no botão "Rodar Auto-tuning" quando `configDirty && lastOutput !== null`.

## `isRunning` na UI

Enquanto `true`: botão "Rodar Auto-tuning" com spinner e desabilitado; botões "Resetar" e "Exportar" desabilitados. Se o browser fechar durante a execução, ao reabrir `isRunning` volta a `false` e o `lastOutput` do IndexedDB é restaurado normalmente.

## Persistência

| Dado | Onde | Quando |
|------|------|--------|
| `config` | localStorage (`miot:config`) | Após `updateConfig`/`resetConfig` |
| `selectedEngineId` | localStorage (`miot:engine-id`) | Após `setEngine` |
| `lastOutput` | IndexedDB (`tuning-output`) | Após `runTuning` bem-sucedido |
| Limpeza de output | IndexedDB (`tuning-output`) | Após `clearOutput` |
