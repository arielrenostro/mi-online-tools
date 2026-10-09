import { create } from 'zustand'
import { lsSet } from '@/persistence/localStorage'

export interface XYSettings {
  /** Sinal do eixo X — sempre exatamente um. */
  xSignal:  string
  /** Sinais do eixo Y, em ordem (define cor e posição do eixo); sem repetição. Pode ficar vazia. */
  ySignals: string[]
  /** Curva da média de cada Y por faixa de X (só pontos que passam no filtro). */
  showMean: boolean
  /** Curva do máximo de cada Y por faixa de X. */
  showMax: boolean
  /** Curva do mínimo de cada Y por faixa de X. */
  showMin: boolean
}

export const DEFAULT_XY_SETTINGS: XYSettings = { xSignal: 'RPM', ySignals: ['MAP'], showMean: false, showMax: false, showMin: false }

/** Aceita qualquer valor salvo: campo ausente/inválido cai no padrão. Não filtra por sinais disponíveis. */
export function sanitizeXYSettings(saved: unknown): XYSettings {
  const o = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>
  const isName = (v: unknown): v is string => typeof v === 'string' && v.length > 0
  // Lista vazia salva é uma escolha (o usuário removeu todos os Y) e volta vazia; só dado ausente, que
  // não seja lista ou lista não vazia sem nenhum nome válido (corrompida) cai no padrão.
  const raw = Array.isArray(o.ySignals) ? o.ySignals : null
  const ys  = raw ? [...new Set(raw.filter(isName))] : []
  const ySignals = raw && (raw.length === 0 || ys.length > 0) ? ys : [...DEFAULT_XY_SETTINGS.ySignals]
  return {
    xSignal:  isName(o.xSignal) ? o.xSignal : DEFAULT_XY_SETTINGS.xSignal,
    ySignals,
    showMean: o.showMean === true,
    showMax:  o.showMax === true,
    showMin:  o.showMin === true,
  }
}

interface XYActions {
  setX(signal: string): void
  /** Ignora um sinal já presente. */
  addY(signal: string): void
  /** Remove o sinal, inclusive o único (a lista pode ficar vazia). */
  removeY(signal: string): void
  setShowMean(value: boolean): void
  setShowMax(value: boolean): void
  setShowMin(value: boolean): void
  hydrate(saved: unknown): void
}

export const useXYStore = create<XYSettings & XYActions>()((set, get) => {
  function commit(partial: Partial<XYSettings>) {
    set(partial)
    const { xSignal, ySignals, showMean, showMax, showMin } = get()
    lsSet('miot:xy', { xSignal, ySignals, showMean, showMax, showMin })
  }

  return {
    xSignal:  DEFAULT_XY_SETTINGS.xSignal,
    ySignals: [...DEFAULT_XY_SETTINGS.ySignals],
    showMean: DEFAULT_XY_SETTINGS.showMean,
    showMax:  DEFAULT_XY_SETTINGS.showMax,
    showMin:  DEFAULT_XY_SETTINGS.showMin,

    setX(signal) {
      if (signal && signal !== get().xSignal) commit({ xSignal: signal })
    },
    addY(signal) {
      const { ySignals } = get()
      if (signal && !ySignals.includes(signal)) commit({ ySignals: [...ySignals, signal] })
    },
    removeY(signal) {
      const { ySignals } = get()
      if (ySignals.includes(signal)) commit({ ySignals: ySignals.filter(s => s !== signal) })
    },
    setShowMean(value) {
      if (value !== get().showMean) commit({ showMean: value })
    },
    setShowMax(value) {
      if (value !== get().showMax) commit({ showMax: value })
    },
    setShowMin(value) {
      if (value !== get().showMin) commit({ showMin: value })
    },
    hydrate(saved) {
      set(sanitizeXYSettings(saved))
    },
  }
})
