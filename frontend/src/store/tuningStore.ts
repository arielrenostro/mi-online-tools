import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { TuningConfig, TuningOutput } from '@/types/tuning'
import { DEFAULT_TUNING_CONFIG } from '@/types/tuning'
import { runTuning as apiRunTuning } from '@/api/tuning'
import { ApiError, NetworkError, TimeoutError } from '@/api/client'
import * as tuningPersistence from '@/persistence/tuningPersistence'
import { lsSet } from '@/persistence/localStorage'
import { useMapStore } from './mapStore'
import { useLogStore, selectActiveLogs } from './logStore'
import { useTimeStore } from './timeStore'

interface TuningState {
  config:           TuningConfig
  selectedEngineId: string
  lastOutput:       TuningOutput | null
  isRunning:        boolean
  lastError:        string | null
  configDirty:      boolean
}
interface TuningActions {
  updateConfig(partial: Partial<TuningConfig>): void
  resetConfig(): void
  setEngine(engineId: string): void
  runTuning(): Promise<void>
  clearOutput(): void
  hydrateConfig(config: TuningConfig): void
  hydrateEngineId(engineId: string): void
  hydrateOutput(output: TuningOutput): void
}

const initial: TuningState = {
  config: DEFAULT_TUNING_CONFIG, selectedEngineId: 've_lambda',
  lastOutput: null, isRunning: false, lastError: null, configDirty: false,
}

export const useTuningStore = create<TuningState & TuningActions>()(
  subscribeWithSelector((set, get) => ({
    ...initial,

    updateConfig(partial) {
      const newConfig = { ...get().config, ...partial }
      set({ config: newConfig, configDirty: true })
      lsSet('mft:config', newConfig)
    },

    resetConfig() {
      set({ config: DEFAULT_TUNING_CONFIG, configDirty: true })
      lsSet('mft:config', DEFAULT_TUNING_CONFIG)
    },

    setEngine(engineId) {
      set({ selectedEngineId: engineId, configDirty: true })
      lsSet('mft:engine-id', engineId)
      get().clearOutput()
    },

    async runTuning() {
      const { originalMap, editableMap } = useMapStore.getState()
      if (!originalMap || !editableMap) {
        set({ lastError: 'Nenhum mapa carregado. Importe um mapa antes de rodar o auto-tuning.' })
        return
      }
      const activeLogs = selectActiveLogs(useLogStore.getState())
      if (!activeLogs.length) {
        set({ lastError: 'Nenhum log ativo. Importe ao menos um log antes de rodar o auto-tuning.' })
        return
      }

      const { config, selectedEngineId } = get()
      const timeRange = useTimeStore.getState().selection

      set({ isRunning: true, lastError: null })

      try {
        await useLogStore.getState().ensureLogsOnBackend(activeLogs.map(l => l.hash))
      } catch (err) {
        set({ isRunning: false, lastError: fmtError(err) })
        return
      }

      let output: TuningOutput
      try {
        output = await apiRunTuning({
          engineId:       selectedEngineId,
          rpmBreakpoints: originalMap.rpmBreakpoints,
          mapBreakpoints: originalMap.mapBreakpoints,
          cells:          editableMap,
          logHashes:      activeLogs.map(l => l.hash),
          timeRange,
          config,
        })
      } catch (err) {
        set({ isRunning: false, lastError: fmtError(err) })
        return
      }

      set({ lastOutput: output, isRunning: false, lastError: null, configDirty: false })
      tuningPersistence.saveTuningOutput(output).catch(() => { /* non-fatal */ })
      useMapStore.getState().applyTuningOutput(output.suggestedMap)
    },

    clearOutput() {
      set({ lastOutput: null, configDirty: false })
      tuningPersistence.clearTuningOutput().catch(() => { /* non-fatal */ })
    },

    hydrateConfig(config)    { set({ config }) },
    hydrateEngineId(engineId){ set({ selectedEngineId: engineId }) },
    hydrateOutput(output)    { set({ lastOutput: output, configDirty: false }) },
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
