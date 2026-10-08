import { create } from 'zustand'
import { DEFAULT_ENGINE_CONSTANTS } from '@/signals/enginePower'
import type { EngineConstants } from '@/signals/enginePower'
import { lsSet } from '@/persistence/localStorage'

/** VE mostrado na tabela do mapa que equivale a 100% (VE% × 10). */
export const VE_FULL_SCALE = 1000

export interface ConstantsValues extends EngineConstants {
  /** "VE atual onde a VE deveria ser 100%", na escala da tabela do mapa (100% = 1000). */
  veAtFull: number
}

export const DEFAULT_CONSTANTS: ConstantsValues = {
  ...DEFAULT_ENGINE_CONSTANTS,
  veAtFull: VE_FULL_SCALE,
}

interface ConstantsState {
  /** Sempre válidos (números > 0) — o texto cru em edição vive no componente. */
  values: ConstantsValues
}
interface ConstantsActions {
  set(partial: Partial<ConstantsValues>): void
  reset(): void
  hydrate(saved: unknown): void
}

const KEYS = Object.keys(DEFAULT_CONSTANTS) as (keyof ConstantsValues)[]

function isValid(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

/** Aceita qualquer valor salvo: campo ausente/inválido cai no padrão, campo a campo. */
export function sanitizeConstants(saved: unknown): ConstantsValues {
  const obj = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>
  const result = { ...DEFAULT_CONSTANTS }
  for (const key of KEYS) {
    if (isValid(obj[key])) result[key] = obj[key] as number
  }
  return result
}

/** Fator de calibração k = 100% / VE informado. Derivado, nunca guardado. */
export const selectCalibrationFactor = (s: ConstantsState): number => VE_FULL_SCALE / s.values.veAtFull

export const useConstantsStore = create<ConstantsState & ConstantsActions>()((set, get) => ({
  values: DEFAULT_CONSTANTS,

  set(partial) {
    const next = { ...get().values }
    for (const key of KEYS) {
      const v = partial[key]
      if (v !== undefined && isValid(v)) next[key] = v
    }
    set({ values: next })
    lsSet('miot:constants', next)
  },

  reset() {
    set({ values: DEFAULT_CONSTANTS })
    lsSet('miot:constants', DEFAULT_CONSTANTS)
  },

  hydrate(saved) {
    set({ values: sanitizeConstants(saved) })
  },
}))
