import { create } from 'zustand'
import { DEFAULT_CONFIDENCE_K } from '@/types/correction'
import { lsSet } from '@/persistence/localStorage'

export const CORRECTION_SETTINGS_KEY = 'miot:correction-settings'

export interface CorrectionSettings {
  /** Constante de confiança do Ponderado: `w = n / (n + k)`. Número ≥ 0. */
  confidenceK: number
}

export const DEFAULT_CORRECTION_SETTINGS: CorrectionSettings = { confidenceK: DEFAULT_CONFIDENCE_K }

interface State {
  /** Sempre válido — o texto cru em edição vive em `DraftNumberField`. */
  values: CorrectionSettings
}
interface Actions {
  set(partial: Partial<CorrectionSettings>): void
  reset(): void
  hydrate(saved: unknown): void
}

export const isValidConfidenceK = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0

/** Aceita qualquer valor salvo: ausente/inválido cai no padrão. */
export function sanitizeCorrectionSettings(saved: unknown): CorrectionSettings {
  const obj = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>
  return { confidenceK: isValidConfidenceK(obj.confidenceK) ? obj.confidenceK : DEFAULT_CONFIDENCE_K }
}

/**
 * Configurações da correção (hoje só a constante k do Ponderado). Separado de `constantsStore` de
 * propósito: as constantes do motor nunca afetam a correção do mapa; esta afeta a exibição do
 * Ponderado e o que "Aplicar" escreve no mapa — mas nunca altera os runs, que só guardam `n`.
 */
export const useCorrectionSettingsStore = create<State & Actions>()((set, get) => ({
  values: DEFAULT_CORRECTION_SETTINGS,

  set(partial) {
    const next = { ...get().values }
    if (partial.confidenceK !== undefined && isValidConfidenceK(partial.confidenceK)) next.confidenceK = partial.confidenceK
    set({ values: next })
    lsSet(CORRECTION_SETTINGS_KEY, next)
  },

  reset() {
    set({ values: DEFAULT_CORRECTION_SETTINGS })
    lsSet(CORRECTION_SETTINGS_KEY, DEFAULT_CORRECTION_SETTINGS)
  },

  hydrate(saved) {
    set({ values: sanitizeCorrectionSettings(saved) })
  },
}))
