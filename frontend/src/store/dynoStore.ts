import { create } from 'zustand'
import type { LambdaLoopState } from '@/types/correction'
import { lsSet } from '@/persistence/localStorage'

/** Marchas selecionáveis (0 = sem marcha engatada, 1–5 = marchas dos logs atuais). */
export const GEAR_OPTIONS: readonly number[] = [0, 1, 2, 3, 4, 5]

/** `null` = sem limite. Valores no domínio do sinal já convertido (%, RPM, kPa, ºC). */
export interface DynoFilters {
  minPedal:   number | null
  minRpm:     number | null
  maxRpm:     number | null
  minMap:     number | null
  minClt:     number | null
  lambdaLoop: LambdaLoopState[]
  /** Marchas aceitas (subconjunto de GEAR_OPTIONS, ao menos uma). Todas marcadas = sem restrição. */
  gears:      number[]
}

export type DynoMode      = 'engine' | 'wheel'
export type DynoSmoothing = 'raw' | 'smoothed'

export interface DynoSettings {
  filters:   DynoFilters
  mode:      DynoMode
  /** Perda de transmissão (%), 0–100 — só vale no modo Roda. */
  lossPct:   number
  smoothing: DynoSmoothing
}

export const DEFAULT_DYNO_SETTINGS: DynoSettings = {
  filters: {
    minPedal: 90, minRpm: null, maxRpm: null, minMap: null, minClt: 80,
    lambdaLoop: [0, 1, 2],
    gears: [...GEAR_OPTIONS],
  },
  mode:      'engine',
  lossPct:   15,
  smoothing: 'smoothed',
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const isBound = (n: unknown): n is number | null => n === null || isNum(n)
const isLoss  = (n: unknown): n is number => isNum(n) && n >= 0 && n <= 100

function sanitizeLoop(v: unknown): LambdaLoopState[] {
  if (!Array.isArray(v)) return DEFAULT_DYNO_SETTINGS.filters.lambdaLoop
  const states = [...new Set(v.filter(x => x === 0 || x === 1 || x === 2))] as LambdaLoopState[]
  return states.length > 0 ? states : DEFAULT_DYNO_SETTINGS.filters.lambdaLoop
}

function sanitizeGears(v: unknown): number[] {
  if (!Array.isArray(v)) return [...GEAR_OPTIONS]
  const gears = GEAR_OPTIONS.filter(g => v.includes(g))
  return gears.length > 0 ? gears : [...GEAR_OPTIONS]
}

/** Aceita qualquer valor salvo: campo ausente/inválido cai no padrão, campo a campo. */
export function sanitizeDynoSettings(saved: unknown): DynoSettings {
  const o = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>
  const f = (o.filters && typeof o.filters === 'object' ? o.filters : {}) as Record<string, unknown>
  const d = DEFAULT_DYNO_SETTINGS
  const bound = (key: Exclude<keyof DynoFilters, 'lambdaLoop' | 'gears'>) => (f[key] !== undefined && isBound(f[key]) ? f[key] as number | null : d.filters[key])
  return {
    filters: {
      minPedal: bound('minPedal'), minRpm: bound('minRpm'), maxRpm: bound('maxRpm'),
      minMap: bound('minMap'), minClt: bound('minClt'),
      lambdaLoop: sanitizeLoop(f.lambdaLoop),
      gears: sanitizeGears(f.gears),
    },
    mode:      o.mode === 'engine' || o.mode === 'wheel' ? o.mode : d.mode,
    lossPct:   isLoss(o.lossPct) ? o.lossPct : d.lossPct,
    smoothing: o.smoothing === 'raw' || o.smoothing === 'smoothed' ? o.smoothing : d.smoothing,
  }
}

interface DynoActions {
  setFilters(partial: Partial<DynoFilters>): void
  setMode(mode: DynoMode): void
  /** Ignora valores fora de 0–100. */
  setLossPct(value: number): void
  setSmoothing(smoothing: DynoSmoothing): void
  /** Filtros e perda de volta aos padrões (modo e suavização não mudam). */
  resetFilters(): void
  hydrate(saved: unknown): void
}

export const useDynoStore = create<DynoSettings & DynoActions>()((set, get) => {
  function commit(partial: Partial<DynoSettings>) {
    set(partial)
    const { filters, mode, lossPct, smoothing } = get()
    lsSet('miot:dyno', { filters, mode, lossPct, smoothing })
  }

  return {
    ...DEFAULT_DYNO_SETTINGS,

    setFilters(partial) {
      const next = { ...get().filters }
      for (const key of Object.keys(partial) as (keyof DynoFilters)[]) {
        const v = partial[key]
        if (key === 'lambdaLoop') {
          if (Array.isArray(v) && v.length > 0) next.lambdaLoop = v as LambdaLoopState[]
        } else if (key === 'gears') {
          if (Array.isArray(v) && v.length > 0) {
            const gears = GEAR_OPTIONS.filter(g => (v as number[]).includes(g))
            if (gears.length > 0) next.gears = gears
          }
        } else if (v !== undefined && isBound(v)) {
          next[key] = v as number | null
        }
      }
      commit({ filters: next })
    },
    setMode(mode)           { commit({ mode }) },
    setLossPct(value)       { if (isLoss(value)) commit({ lossPct: value }) },
    setSmoothing(smoothing) { commit({ smoothing }) },
    resetFilters() {
      commit({ filters: DEFAULT_DYNO_SETTINGS.filters, lossPct: DEFAULT_DYNO_SETTINGS.lossPct })
    },
    hydrate(saved)          { set(sanitizeDynoSettings(saved)) },
  }
})
