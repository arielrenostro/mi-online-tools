# Store: `useTuningStore`

Gerencia a configuração do auto-tuning, o engine selecionado, a execução e o resultado (`TuningOutput`).

**Arquivo:** `src/store/tuningStore.ts`

## Estado

```typescript
interface TuningState {
  config:            TuningConfig    // inicializado com DEFAULT_TUNING_CONFIG; restaurado do localStorage
  selectedEngineId:  string          // default "ve_lambda" (único na v1); persistido
  lastOutput:        TuningOutput | null  // null = nunca rodou ou foi limpo; persistido no IndexedDB
  isRunning:         boolean         // POST /api/tuning/run em andamento
  lastError:         string | null
  configDirty:       boolean         // config alterada após o último output (lastOutput desatualizado)
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

## Implementação

```typescript
export const useTuningStore = create<TuningStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    updateConfig(partial): void {
      const newConfig = { ...get().config, ...partial }
      set({ config: newConfig, configDirty: true })
      lsSet('miot:config', newConfig)
      // não limpa lastOutput — só marca configDirty; o usuário decide se re-roda
    },

    resetConfig(): void {
      set({ config: DEFAULT_TUNING_CONFIG, configDirty: true })
      lsSet('miot:config', DEFAULT_TUNING_CONFIG)
    },

    setEngine(engineId): void {
      set({ selectedEngineId: engineId, configDirty: true })
      lsSet('miot:engine-id', engineId)
      get().clearOutput()  // novo engine pode gerar output incompatível
    },

    async runTuning(): Promise<void> {
      // Pré-validação
      const { originalMap, editableMap } = useMapStore.getState()
      if (!originalMap || !editableMap) {
        set({ lastError: 'Nenhum mapa carregado. Importe um mapa antes de rodar o auto-tuning.' })
        return
      }
      const activeLogs = selectActiveLogs(useLogStore.getState())
      if (activeLogs.length === 0) {
        set({ lastError: 'Nenhum log ativo. Importe ao menos um log antes de rodar o auto-tuning.' })
        return
      }
      const { config, selectedEngineId } = get()
      const timeRange = useTimeStore.getState().selection  // null = usar tudo

      const request = {
        engineId: selectedEngineId,
        rpmBreakpoints: originalMap.rpmBreakpoints,
        mapBreakpoints: originalMap.mapBreakpoints,
        cells: editableMap,
        logHashes: activeLogs.map((l) => l.hash),
        timeRange, config,
      }

      set({ isRunning: true, lastError: null })
      try {
        await useLogStore.getState().ensureLogsOnBackend(request.logHashes)
      } catch (uploadErr) {
        set({ isRunning: false, lastError: formatTuningError(uploadErr) }); return
      }
      let output: TuningOutput
      try {
        output = await apiRunTuning(request)
      } catch (err) {
        set({ isRunning: false, lastError: formatTuningError(err) }); return
      }
      set({ lastOutput: output, isRunning: false, lastError: null, configDirty: false })
      try { await tuningPersistence.saveTuningOutput(output) }  // ~200KB JSON
      catch (err) { console.warn('[mft] Falha ao persistir TuningOutput:', err) }  // não-fatal
      useMapStore.getState().applyTuningOutput(output.suggestedMap)  // aplica ao mapa editável
    },

    clearOutput(): void {
      set({ lastOutput: null, configDirty: false })
      tuningPersistence.clearTuningOutput().catch((err) =>
        console.warn('[mft] Falha ao limpar TuningOutput do IndexedDB:', err))
    },

    hydrateConfig(config): void { set({ config }) },
    hydrateEngineId(engineId): void { set({ selectedEngineId: engineId }) },
    hydrateOutput(output): void {
      set({ lastOutput: output, configDirty: false })
      // não chama applyTuningOutput — o mapStore já foi hidratado com os editableCells salvos
    },
  }))
)

function formatTuningError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404)
      return 'Um ou mais logs não foram encontrados no servidor. Tente rodar novamente.'
    if (err.status === 422) return `Configuração inválida: ${err.detail}`
    return `Erro do servidor: ${err.detail}`
  }
  if (err instanceof NetworkError)
    return 'Sem conexão com o servidor. Verifique se o backend está rodando.'
  if (err instanceof TimeoutError)
    return 'O auto-tuning demorou muito. Tente com um intervalo de tempo menor.'
  return 'Erro desconhecido ao executar o auto-tuning.'
}
```

## Fluxo de `runTuning()`

```
runTuning()
  Validação 1: originalMap !== null?      → não: set lastError, return
  Validação 2: activeLogs.length > 0?     → não: set lastError, return
  Monta TuningRunRequest (engineId, breakpoints, cells=editableMap, logHashes,
                          timeRange=selection|null, config)
  set isRunning=true
  ensureLogsOnBackend(logHashes)          → erro: set lastError, return
  apiRunTuning(request) [timeout 120s]
    sucesso → set lastOutput, isRunning=false, configDirty=false
            → saveTuningOutput(output)
            → mapStore.applyTuningOutput(output.suggestedMap)
    erro    → set isRunning=false, lastError=formatTuningError(err)
```

## Acesso a outros stores via `getState()`

`runTuning()` lê `useMapStore`, `useLogStore`, `useTimeStore` via `.getState()` — não via hooks — para evitar ciclos de dependência, funcionar em funções async (Rules of Hooks) e não causar re-renders.

## `configDirty` — indicador de desatualização

`true` quando a config muda após o último output. A UI exibe um aviso (ícone amarelo) no botão "Rodar Auto-tuning" quando `configDirty && lastOutput !== null`.

- `true` em: `updateConfig()`, `resetConfig()`, `setEngine()`
- `false` em: `runTuning()` ao concluir, `clearOutput()`, `hydrateOutput()`

## Persistência

| Dado | Onde | Quando |
|------|------|--------|
| `config` | localStorage (`miot:config`) | Após `updateConfig`/`resetConfig` |
| `selectedEngineId` | localStorage (`miot:engine-id`) | Após `setEngine` |
| `lastOutput` | IndexedDB (`tuning-output`) | Após `runTuning` bem-sucedido |
| Limpeza de output | IndexedDB (`tuning-output`) | Após `clearOutput` |

## `isRunning` — comportamento da UI

Enquanto `isRunning === true`: botão "Rodar Auto-tuning" com spinner e desabilitado; botão "Resetar" desabilitado; botão "Exportar" da TopBar desabilitado. Se o browser fechar durante `isRunning`, ao reabrir `isRunning` será `false` (estado inicial) e o `lastOutput` do IndexedDB é restaurado normalmente.

## Seletores recomendados

```typescript
const isRunning        = useTuningStore((s) => s.isRunning)
const configDirty      = useTuningStore((s) => s.configDirty)
const lastError        = useTuningStore((s) => s.lastError)
const lastOutput       = useTuningStore((s) => s.lastOutput)
const hasOutput        = useTuningStore((s) => s.lastOutput !== null)
const config           = useTuningStore((s) => s.config)
const updateConfig     = useTuningStore((s) => s.updateConfig)
const resetConfig      = useTuningStore((s) => s.resetConfig)
const selectedEngineId = useTuningStore((s) => s.selectedEngineId)
const setEngine        = useTuningStore((s) => s.setEngine)
const runTuning        = useTuningStore((s) => s.runTuning)
const clearOutput      = useTuningStore((s) => s.clearOutput)
```
