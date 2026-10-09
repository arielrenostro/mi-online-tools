import { create } from 'zustand'
import { SIGNAL_MAP } from '@/signals/signalRegistry'
import { lsSet } from '@/persistence/localStorage'

export const SIGNAL_RANGES_KEY = 'miot:signal-ranges'

export interface SignalRange { min: number; max: number }
/** Só o que o usuário mudou: um sinal ausente usa a faixa padrão do registro. */
export type SignalRangeOverrides = Record<string, SignalRange>

interface State {
  /** Sempre válidas (finitas, min < max) — o texto cru em edição vive no componente. */
  overrides: SignalRangeOverrides
}
interface Actions {
  /** Ignora par inválido; um par igual ao padrão remove a sobrescrita. */
  setRange(name: string, min: number, max: number): void
  resetOne(name: string): void
  resetAll(): void
  hydrate(saved: unknown): void
}

export function isValidRange(min: unknown, max: unknown): boolean {
  return typeof min === 'number' && typeof max === 'number'
    && Number.isFinite(min) && Number.isFinite(max) && min < max
}

/** Faixa padrão do registro (`SIGNAL_MAP`), ou `undefined` para sinal desconhecido. */
export function defaultRange(name: string): SignalRange | undefined {
  const def = SIGNAL_MAP.get(name)
  return def ? { min: def.min, max: def.max } : undefined
}

/** Faixa efetiva do eixo: a sobrescrita do usuário ou, sem ela, o padrão do sinal. */
export function resolveRange(name: string, overrides: SignalRangeOverrides = {}): SignalRange | undefined {
  return overrides[name] ?? defaultRange(name)
}

/** Aceita qualquer valor salvo: descarta, entrada a entrada, sinal desconhecido e faixa inválida. */
export function sanitizeSignalRanges(saved: unknown): SignalRangeOverrides {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
  const result: SignalRangeOverrides = {}
  for (const [name, value] of Object.entries(saved as Record<string, unknown>)) {
    if (!SIGNAL_MAP.has(name) || !value || typeof value !== 'object') continue
    const { min, max } = value as Record<string, unknown>
    if (isValidRange(min, max)) result[name] = { min: min as number, max: max as number }
  }
  return result
}

export const useSignalRangesStore = create<State & Actions>()((set, get) => ({
  overrides: {},

  setRange(name, min, max) {
    const def = defaultRange(name)
    if (!def || !isValidRange(min, max)) return
    const next = { ...get().overrides }
    if (min === def.min && max === def.max) delete next[name]
    else next[name] = { min, max }
    set({ overrides: next })
    lsSet(SIGNAL_RANGES_KEY, next)
  },

  resetOne(name) {
    if (!(name in get().overrides)) return
    const next = { ...get().overrides }
    delete next[name]
    set({ overrides: next })
    lsSet(SIGNAL_RANGES_KEY, next)
  },

  resetAll() {
    set({ overrides: {} })
    lsSet(SIGNAL_RANGES_KEY, {})
  },

  hydrate(saved) {
    set({ overrides: sanitizeSignalRanges(saved) })
  },
}))
