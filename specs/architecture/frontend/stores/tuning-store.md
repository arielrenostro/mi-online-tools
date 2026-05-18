# Store: `useTuningStore`

Store Zustand responsável por gerenciar a configuração do auto-tuning, o engine selecionado, a execução do tuning e o resultado (`TuningOutput`).

---

## Estado completo

```typescript
// src/store/tuningStore.ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { TuningConfig, TuningOutput } from '@/types/tuning'
import { DEFAULT_TUNING_CONFIG }            from '@/types/tuning'

interface TuningState {
  /** Parâmetros configuráveis do engine de tuning.
   *  Inicializado com DEFAULT_TUNING_CONFIG; restaurado do localStorage no reload. */
  config:            TuningConfig

  /** ID do engine selecionado. Default: "ve_lambda" (único engine disponível na v1).
   *  Persistido no localStorage. */
  selectedEngineId:  string

  /** Resultado da última execução do auto-tuning.
   *  null = nunca rodou ou foi limpo após mudança de mapa/log/config.
   *  Persistido no IndexedDB. */
  lastOutput:        TuningOutput | null

  /** true enquanto a chamada a POST /api/tuning/run está em andamento.
   *  Controla o spinner e o estado desabilitado do botão "Rodar Auto-tuning". */
  isRunning:         boolean

  /** Mensagem de erro da última execução falha. null = sem erro ou nunca rodou. */
  lastError:         string | null

  /** true se a config foi alterada após o último output.
   *  Indica para a UI que o lastOutput pode estar desatualizado.
   *  Exibido como aviso visual no botão "Rodar Auto-tuning". */
  configDirty:       boolean
}

interface TuningActions {
  updateConfig(partial: Partial<TuningConfig>): void
  resetConfig(): void
  setEngine(engineId: string): void
  runTuning(): Promise<void>
  clearOutput(): void

  /** Usado pelo sessionRestorer para restaurar config sem side effects. */
  hydrateConfig(config: TuningConfig): void

  /** Usado pelo sessionRestorer para restaurar engineId sem side effects. */
  hydrateEngineId(engineId: string): void

  /** Usado pelo sessionRestorer para restaurar o último output. */
  hydrateOutput(output: TuningOutput): void
}

type TuningStore = TuningState & TuningActions
```

### Valores iniciais

```typescript
const initialState: TuningState = {
  config:           DEFAULT_TUNING_CONFIG,
  selectedEngineId: 've_lambda',
  lastOutput:       null,
  isRunning:        false,
  lastError:        null,
  configDirty:      false,
}
```

---

## Implementação do store

```typescript
// src/store/tuningStore.ts (continuação)
import { runTuning as apiRunTuning } from '@/api/tuning'
import { ApiError, NetworkError, TimeoutError } from '@/api/client'
import * as tuningPersistence          from '@/persistence/tuningPersistence'
import { lsSet }                       from '@/persistence/localStorage'
import { useMapStore }                 from './mapStore'
import { useLogStore, selectActiveLogs } from './logStore'
import { useTimeStore }                from './timeStore'

export const useTuningStore = create<TuningStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ── updateConfig ──────────────────────────────────────────────────────────
    updateConfig(partial: Partial<TuningConfig>): void {
      const newConfig = { ...get().config, ...partial }
      set({ config: newConfig, configDirty: true })
      lsSet('mft:config', newConfig)
      // Não limpa lastOutput — apenas marca como possivelmente desatualizado via configDirty.
      // O usuário verá o aviso visual no botão e decidirá se quer re-rodar.
    },

    // ── resetConfig ───────────────────────────────────────────────────────────
    resetConfig(): void {
      set({ config: DEFAULT_TUNING_CONFIG, configDirty: true })
      lsSet('mft:config', DEFAULT_TUNING_CONFIG)
    },

    // ── setEngine ─────────────────────────────────────────────────────────────
    setEngine(engineId: string): void {
      set({ selectedEngineId: engineId, configDirty: true })
      lsSet('mft:engine-id', engineId)
      // Limpa o output pois o novo engine pode gerar resultados incompatíveis
      // com o format do output anterior
      get().clearOutput()
    },

    // ── runTuning ─────────────────────────────────────────────────────────────
    async runTuning(): Promise<void> {
      // ── Pré-validação de pré-requisitos ─────────────────────────────────────
      const mapId = useMapStore.getState().mapId
      if (!mapId) {
        set({ lastError: 'Nenhum mapa carregado. Importe um mapa antes de rodar o auto-tuning.' })
        return
      }

      const activeLogs = selectActiveLogs(useLogStore.getState())
      if (activeLogs.length === 0) {
        set({ lastError: 'Nenhum log ativo. Importe ao menos um log antes de rodar o auto-tuning.' })
        return
      }

      // Verifica se algum log tem logId inválido (backend offline durante restore)
      const invalidLogs = activeLogs.filter((l) => !l.logId)
      if (invalidLogs.length > 0) {
        set({ lastError: 'Alguns logs não foram enviados ao servidor. O backend pode estar indisponível.' })
        return
      }

      const { config, selectedEngineId } = get()
      const timeRange = useTimeStore.getState().selection   // null = usar tudo

      // ── Monta a requisição ──────────────────────────────────────────────────
      const request = {
        engineId:  selectedEngineId,
        mapId,
        logIds:    activeLogs.map((l) => l.logId),
        timeRange,
        config,
      }

      // ── Executa ──────────────────────────────────────────────────────────────
      set({ isRunning: true, lastError: null })

      let output: TuningOutput
      try {
        output = await apiRunTuning(request)
      } catch (err) {
        set({
          isRunning: false,
          lastError: formatTuningError(err),
        })
        return
      }

      // ── Sucesso: atualiza estado ──────────────────────────────────────────────
      set({
        lastOutput:  output,
        isRunning:   false,
        lastError:   null,
        configDirty: false,
      })

      // Persiste o output no IndexedDB (pode ser grande — ~200KB JSON)
      try {
        await tuningPersistence.saveTuningOutput(output)
      } catch (err) {
        console.warn('[mft] Falha ao persistir TuningOutput:', err)
        // Não é fatal — o output está em memória e pode ser re-executado
      }

      // Aplica o mapa sugerido ao mapa editável
      // O mapa editável é atualizado e o usuário verá as correções imediatamente
      useMapStore.getState().applyTuningOutput(output.suggestedMap)
    },

    // ── clearOutput ───────────────────────────────────────────────────────────
    clearOutput(): void {
      set({ lastOutput: null, configDirty: false })
      // Remove do IndexedDB de forma assíncrona (não bloquear)
      tuningPersistence.clearTuningOutput().catch((err) => {
        console.warn('[mft] Falha ao limpar TuningOutput do IndexedDB:', err)
      })
    },

    // ── hydrate methods (sessionRestorer) ────────────────────────────────────
    hydrateConfig(config: TuningConfig): void {
      set({ config })
    },

    hydrateEngineId(engineId: string): void {
      set({ selectedEngineId: engineId })
    },

    hydrateOutput(output: TuningOutput): void {
      set({ lastOutput: output, configDirty: false })
      // Não chama applyTuningOutput aqui — o mapStore já foi hidratado com
      // os editableCells salvos (que já incluíam o output aplicado anteriormente)
    },
  }))
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTuningError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) {
      return 'Mapa ou log não encontrado no servidor. Pode ser necessário recarregar a página.'
    }
    if (err.status === 422) {
      return `Configuração inválida: ${err.detail}`
    }
    return `Erro do servidor: ${err.detail}`
  }
  if (err instanceof NetworkError) {
    return 'Sem conexão com o servidor. Verifique se o backend está rodando.'
  }
  if (err instanceof TimeoutError) {
    return 'O auto-tuning demorou muito para responder. Tente com um intervalo de tempo menor.'
  }
  return 'Erro desconhecido ao executar o auto-tuning.'
}
```

---

## Fluxo detalhado de `runTuning()`

```
runTuning() chamado (ex.: clique no botão)
       │
       ├── Validação 1: mapId !== null?
       │       └── não → set lastError, return
       │
       ├── Validação 2: activeLogs.length > 0?
       │       └── não → set lastError, return
       │
       ├── Validação 3: todos os logs têm logId válido?
       │       └── não → set lastError, return (backend estava offline no restore)
       │
       ├── Monta TuningRunRequest:
       │       engineId:  selectedEngineId
       │       mapId:     mapStore.mapId
       │       logIds:    activeLogs.map(l => l.logId)
       │       timeRange: timeStore.selection (null = usar tudo)
       │       config:    config atual
       │
       ├── set({ isRunning: true, lastError: null })
       │
       ├── await apiRunTuning(request)   [timeout 120s]
       │       │
       │       ├── sucesso: output = TuningOutput
       │       │       ├── set({ lastOutput: output, isRunning: false, configDirty: false })
       │       │       ├── await tuningPersistence.saveTuningOutput(output)
       │       │       └── mapStore.applyTuningOutput(output.suggestedMap)
       │       │
       │       └── erro (ApiError | NetworkError | TimeoutError)
       │               └── set({ isRunning: false, lastError: formatTuningError(err) })
       │
       └── fim
```

---

## Acesso a outros stores via `getState()`

O `useTuningStore` precisa ler dados de `useMapStore`, `useLogStore` e `useTimeStore` para montar o `TuningRunRequest`. Isso é feito via `.getState()` do Zustand — não via hooks — para:

1. Evitar ciclos de dependência entre stores.
2. Funcionar dentro de funções assíncronas sem restrições de Rules of Hooks.
3. Não causar re-renders no `useTuningStore` quando os outros stores mudam.

```typescript
// Correto: acesso direto ao estado
const mapId = useMapStore.getState().mapId
const activeLogs = selectActiveLogs(useLogStore.getState())
const timeRange = useTimeStore.getState().selection

// Incorreto: nunca usar hooks dentro de stores
const mapId = useMapStore((s) => s.mapId)  // ← ERRO: hook fora de componente
```

---

## `configDirty` — Indicador visual de desatualização

O campo `configDirty` indica que a configuração foi alterada após o último output calculado. A UI usa isso para exibir um aviso visual no botão "Rodar Auto-tuning":

```tsx
// Em VETab.tsx ou no componente que exibe o botão:
const configDirty = useTuningStore((s) => s.configDirty)
const lastOutput  = useTuningStore((s) => s.lastOutput)

const showStaleWarning = configDirty && lastOutput !== null

return (
  <Button onClick={() => runTuning()}>
    Rodar Auto-tuning
    {showStaleWarning && (
      <Tooltip>
        <TooltipTrigger>
          <AlertTriangleIcon className="ml-2 h-4 w-4 text-yellow-500" />
        </TooltipTrigger>
        <TooltipContent>
          A configuração foi alterada desde o último auto-tuning.
          Os resultados exibidos podem estar desatualizados.
        </TooltipContent>
      </Tooltip>
    )}
  </Button>
)
```

`configDirty` é definido como `true` em:
- `updateConfig()` — qualquer mudança de parâmetro
- `resetConfig()` — reset para defaults
- `setEngine()` — troca de engine

`configDirty` é definido como `false` em:
- `runTuning()` ao concluir com sucesso — o output agora reflete a config atual
- `clearOutput()` — ao limpar, não há mais output para estar desatualizado
- `hydrateOutput()` — ao restaurar do IndexedDB, o output e a config foram salvos juntos

---

## Persistência

| Dado | Onde | Quando | Como |
|------|------|--------|------|
| `config` | localStorage (`mft:config`) | Imediato após `updateConfig()`, `resetConfig()` | `lsSet('mft:config', config)` |
| `selectedEngineId` | localStorage (`mft:engine-id`) | Imediato após `setEngine()` | `lsSet('mft:engine-id', engineId)` |
| `lastOutput` | IndexedDB (`tuning-output`) | Após `runTuning()` bem-sucedido | `tuningPersistence.saveTuningOutput()` |
| Limpeza de output | IndexedDB (`tuning-output`) | Após `clearOutput()` | `tuningPersistence.clearTuningOutput()` |

---

## Estado `isRunning` — Comportamento da UI

Enquanto `isRunning === true`:
- O botão "Rodar Auto-tuning" exibe um spinner e está desabilitado.
- O botão "Resetar" está desabilitado (para evitar inconsistência durante o processamento).
- A TopBar desabilita o botão "Exportar" temporariamente (o mapa pode mudar ao final do tuning).
- Se o usuário fechar o browser durante `isRunning === true`, ao reabrir, `isRunning` será `false` (estado inicial), e o `lastOutput` do IndexedDB (do run anterior ao fechamento, se houver) será restaurado normalmente.

---

## Seletores recomendados para componentes

```typescript
// Para o botão "Rodar Auto-tuning"
const isRunning    = useTuningStore((s) => s.isRunning)
const configDirty  = useTuningStore((s) => s.configDirty)
const lastError    = useTuningStore((s) => s.lastError)

// Para exibir o resultado do tuning (seção Análise)
const lastOutput   = useTuningStore((s) => s.lastOutput)
const hasOutput    = useTuningStore((s) => s.lastOutput !== null)

// Para o TuningConfigModal
const config       = useTuningStore((s) => s.config)
const updateConfig = useTuningStore((s) => s.updateConfig)
const resetConfig  = useTuningStore((s) => s.resetConfig)

// Para o seletor de engine (quando houver múltiplos engines)
const selectedEngineId = useTuningStore((s) => s.selectedEngineId)
const setEngine        = useTuningStore((s) => s.setEngine)

// Para invocar o tuning
const runTuning   = useTuningStore((s) => s.runTuning)
const clearOutput = useTuningStore((s) => s.clearOutput)
```

---

## Localização do arquivo

`src/store/tuningStore.ts`
