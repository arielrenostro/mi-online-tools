import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { TuningConfig, TuningOutput } from '@/types/tuning'
import { DEFAULT_TUNING_CONFIG } from '@/types/tuning'
import { runTuning as apiRunTuning } from '@/api/tuning'
import { ApiError, NetworkError, TimeoutError } from '@/api/client'
import * as tuningPersistence from '@/persistence/tuningPersistence'
import { lsSet } from '@/persistence/localStorage'
import { useMapStore } from './mapStore'
import { useLogStore } from './logStore'
import { useTimeStore } from './timeStore'

interface TuningState {
  config:           TuningConfig
  selectedEngineId: string
  lastOutput:       TuningOutput | null
  isRunning:        boolean
  lastError:        string | null
}
interface TuningActions {
  updateConfig(partial: Partial<TuningConfig>): void
  resetConfig(): void
  setEngine(engineId: string): void
  runTuning(params: { logHashes: string[]; config: TuningConfig; engineId?: string }): Promise<TuningOutput>
  clearOutput(): void
  hydrateConfig(config: TuningConfig): void
  hydrateEngineId(engineId: string): void
  hydrateOutput(output: TuningOutput): void
}

const initial: TuningState = {
  config: DEFAULT_TUNING_CONFIG, selectedEngineId: 've_lambda',
  lastOutput: null, isRunning: false, lastError: null,
}

export const useTuningStore = create<TuningState & TuningActions>()(
  subscribeWithSelector((set, get) => ({
    ...initial,

    updateConfig(partial) {
      const newConfig = { ...get().config, ...partial }
      set({ config: newConfig })
      lsSet('miot:config', newConfig)
    },

    resetConfig() {
      set({ config: DEFAULT_TUNING_CONFIG })
      lsSet('miot:config', DEFAULT_TUNING_CONFIG)
    },

    setEngine(engineId) {
      set({ selectedEngineId: engineId })
      lsSet('miot:engine-id', engineId)
      get().clearOutput()
    },

    async runTuning({ logHashes, config, engineId }) {
      const { originalMap, editableMap } = useMapStore.getState()
      if (!originalMap || !editableMap) {
        const msg = 'Nenhum mapa carregado.'
        set({ lastError: msg })
        throw new Error(msg)
      }

      const resolvedEngineId = engineId ?? get().selectedEngineId
      const timeRange        = useTimeStore.getState().selection

      set({ isRunning: true, lastError: null })

      try {
        await useLogStore.getState().ensureLogsOnBackend(logHashes)
      } catch (err) {
        const msg = fmtError(err)
        set({ isRunning: false, lastError: msg })
        throw new Error(msg)
      }

      let output: TuningOutput
      try {
        output = await apiRunTuning({
          engineId:       resolvedEngineId,
          rpmBreakpoints: originalMap.rpmBreakpoints,
          mapBreakpoints: originalMap.mapBreakpoints,
          cells:          editableMap,
          logHashes,
          timeRange,
          config,
        })
      } catch (err) {
        const msg = fmtError(err)
        set({ isRunning: false, lastError: msg })
        throw new Error(msg)
      }

      set({ lastOutput: output, isRunning: false, lastError: null })
      tuningPersistence.saveTuningOutput(output).catch(() => { /* non-fatal */ })
      return output
    },

    clearOutput() {
      set({ lastOutput: null })
      tuningPersistence.clearTuningOutput().catch(() => { /* non-fatal */ })
    },

    hydrateConfig(config)    { set({ config }) },
    hydrateEngineId(engineId){ set({ selectedEngineId: engineId }) },
    hydrateOutput(output)    { set({ lastOutput: output }) },
  }))
)

function fmtError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return 'Um ou mais logs não foram encontrados no servidor. Tente rodar novamente.'
    if (err.status === 422) return `Configuração inválida: ${err.detail}`
    return `Erro do servidor: ${err.detail}`
  }
  if (err instanceof NetworkError) return 'Sem conexão com o servidor. Verifique se o backend está rodando.'
  if (err instanceof TimeoutError) return 'O auto-tuning demorou muito. Tente com um intervalo de tempo menor.'
  return 'Erro desconhecido ao executar o auto-tuning.'
}
