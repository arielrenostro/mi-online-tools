import type { LambdaLoopState } from './correction'

/**
 * Sinais com faixa (min/max) no filtro. Nomes de `SIGNAL_DEFS`, já em unidade real. A ordem é a de
 * `SIGNAL_GROUPS` (sidebar dos Gráficos) — um teste garante que não divergem.
 */
export const FILTER_RANGE_SIGNALS = [
  'RPM', 'MAP', 'Boost', 'Pedal', 'Lambda 1', 'Lambda Target', 'Lambda Corr',
  'Inj. Pulse', 'Inj. DT', 'Inj. Utiliz.', 'CLT', 'IAT', 'Batt Volt.',
] as const
export type FilterRangeSignal = typeof FILTER_RANGE_SIGNALS[number]

/** `min`/`max` `null` = lado aberto; limites inclusivos. */
export interface FilterRange {
  enabled: boolean
  min:     number | null
  max:     number | null
}

/** Critério de um valor só (ΔTPS, ΔMAP, |Δ λ×alvo|). */
export interface FilterLimit {
  enabled: boolean
  value:   number
}

/** Pular N pontos junto a uma transição de Lambda Loop (os primeiros após, ou os últimos antes). */
export interface FilterSkip {
  enabled: boolean
  n:       number
}

/**
 * Critério de estabilização com limite e contagem de pontos: no hold-off, `value` é o degrau (Pedal %/MAP kPa
 * em 200 ms) e `n` os pontos descartados após o último ponto do degrau; na estabilidade, `value` é a amplitude
 * máxima e `n` o tamanho da janela, em pontos do log.
 */
export interface FilterWindow {
  enabled: boolean
  value:   number
  n:       number
}

/** Hold-off de N pontos após uma troca de marcha (sem limite: qualquer mudança de Marcha é evento). */
export interface FilterHold {
  enabled: boolean
  n:       number
}

/**
 * Filtro único do Datalog: cada critério tem seu liga/desliga; ligados combinam em AND.
 * É a mesma máscara para destaque (Dashboard/Gráficos/Dados) e para gerar um run de correção.
 */
export interface FilterConfig {
  ranges:               Record<FilterRangeSignal, FilterRange>
  lambdaLoop:           { enabled: boolean; states: LambdaLoopState[] }
  maxDeltaTps:          FilterLimit
  maxDeltaMap:          FilterLimit
  maxDeltaLambdaTarget: FilterLimit
  skipClosed:           FilterSkip
  skipOpen:             FilterSkip
  skipBeforeClosed:     FilterSkip
  skipBeforeOpen:       FilterSkip
  holdPedal:            FilterWindow
  holdMap:              FilterWindow
  holdGear:             FilterHold
  stablePedal:          FilterWindow
  stableMap:            FilterWindow
}

/** Menor janela de estabilidade que mede alguma variação (1 ponto tem amplitude sempre 0). */
export const MIN_STABILITY_WINDOW = 2

const range = (enabled: boolean, min: number | null, max: number | null): FilterRange => ({ enabled, min, max })

/** Padrão: Lambda 1/CLT/Loop/alvo, descartar 5 após closed loop, descartar após degrau de Pedal/MAP e troca de marcha e a estabilidade do Pedal ligados; as demais faixas (MAP, RPM, Pedal, Lambda Corr, IAT, bateria/injeção, Lambda Target, Boost) desligadas e vazias. */
export function makeDefaultFilter(): FilterConfig {
  return {
    ranges: {
      'RPM':           range(false, null, null),
      'MAP':           range(false, null, null),
      'Boost':         range(false, null, null),
      'Pedal':         range(false, null, null),
      'Lambda 1':      range(true, 0.7, 1.09),
      'Lambda Target': range(false, null, null),
      'Lambda Corr':   range(false, null, null),
      'Inj. Pulse':    range(false, null, null),
      'Inj. DT':       range(false, null, null),
      'Inj. Utiliz.':  range(false, null, null),
      'CLT':           range(true, 87, null),
      'IAT':           range(false, null, null),
      'Batt Volt.':    range(false, null, null),
    },
    lambdaLoop:           { enabled: true, states: [1, 2] },
    maxDeltaTps:          { enabled: false, value: 5 },
    maxDeltaMap:          { enabled: false, value: 5 },
    maxDeltaLambdaTarget: { enabled: true, value: 0.05 },
    skipClosed:           { enabled: true, n: 5 },
    skipOpen:             { enabled: false, n: 10 },
    skipBeforeClosed:     { enabled: false, n: 5 },
    skipBeforeOpen:       { enabled: false, n: 10 },
    holdPedal:            { enabled: true, value: 5, n: 15 },
    holdMap:              { enabled: true, value: 5, n: 15 },
    holdGear:             { enabled: true, n: 15 },
    stablePedal:          { enabled: true, value: 5, n: 10 },
    stableMap:            { enabled: false, value: 5, n: 10 },
  }
}

export const DEFAULT_FILTER: FilterConfig = makeDefaultFilter()

export function cloneFilter(f: FilterConfig): FilterConfig {
  const ranges = {} as FilterConfig['ranges']
  for (const sig of FILTER_RANGE_SIGNALS) ranges[sig] = { ...f.ranges[sig] }
  return {
    ranges,
    lambdaLoop:           { enabled: f.lambdaLoop.enabled, states: [...f.lambdaLoop.states] },
    maxDeltaTps:          { ...f.maxDeltaTps },
    maxDeltaMap:          { ...f.maxDeltaMap },
    maxDeltaLambdaTarget: { ...f.maxDeltaLambdaTarget },
    skipClosed:           { ...f.skipClosed },
    skipOpen:             { ...f.skipOpen },
    skipBeforeClosed:     { ...f.skipBeforeClosed },
    skipBeforeOpen:       { ...f.skipBeforeOpen },
    holdPedal:            { ...f.holdPedal },
    holdMap:              { ...f.holdMap },
    holdGear:             { ...f.holdGear },
    stablePedal:          { ...f.stablePedal },
    stableMap:            { ...f.stableMap },
  }
}

function canonical(f: FilterConfig): FilterConfig {
  const c = cloneFilter(f)
  c.lambdaLoop.states = [...c.lambdaLoop.states].sort()
  return c
}

/** Igualdade estrutural (a ordem dos estados de Lambda Loop não importa). */
export function filtersEqual(a: FilterConfig, b: FilterConfig): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
}

export function isDefaultFilter(f: FilterConfig): boolean {
  return filtersEqual(f, DEFAULT_FILTER)
}

/** Quantos critérios estão ligados (cada faixa conta como um). */
export function countEnabled(f: FilterConfig): number {
  let n = 0
  for (const sig of FILTER_RANGE_SIGNALS) if (f.ranges[sig].enabled) n++
  if (f.lambdaLoop.enabled) n++
  if (f.maxDeltaTps.enabled) n++
  if (f.maxDeltaMap.enabled) n++
  if (f.maxDeltaLambdaTarget.enabled) n++
  if (f.skipClosed.enabled) n++
  if (f.skipOpen.enabled) n++
  if (f.skipBeforeClosed.enabled) n++
  if (f.skipBeforeOpen.enabled) n++
  if (f.holdPedal.enabled) n++
  if (f.holdMap.enabled) n++
  if (f.holdGear.enabled) n++
  if (f.stablePedal.enabled) n++
  if (f.stableMap.enabled) n++
  return n
}

/** Motivo do primeiro critério ligado inválido, ou null se o filtro é válido. */
export function filterError(f: FilterConfig): string | null {
  for (const sig of FILTER_RANGE_SIGNALS) {
    const r = f.ranges[sig]
    if (!r.enabled) continue
    if (r.min !== null && r.max !== null && r.min > r.max) return `${sig}: mínimo maior que o máximo`
  }
  if (f.lambdaLoop.enabled && f.lambdaLoop.states.length === 0) return 'Lambda Loop: marque ao menos um estado'
  for (const [label, l] of [
    ['Máx Delta TPS', f.maxDeltaTps], ['Máx Delta MAP', f.maxDeltaMap], ['Máx |Δ Lambda×Alvo|', f.maxDeltaLambdaTarget],
  ] as const) {
    if (l.enabled && !(Number.isFinite(l.value) && l.value >= 0)) return `${label}: valor inválido`
  }
  for (const [label, s] of [
    ['Pular antes de Closed Loop', f.skipBeforeClosed], ['Pular antes de Open Loop', f.skipBeforeOpen],
    ['Pular após Closed Loop', f.skipClosed], ['Pular após Open Loop', f.skipOpen],
  ] as const) {
    if (s.enabled && !(Number.isInteger(s.n) && s.n >= 0)) return `${label}: valor inválido`
  }
  for (const [label, w, minN] of [
    ['Descartar após degrau de Pedal', f.holdPedal, 0], ['Descartar após degrau de MAP', f.holdMap, 0],
    ['Estabilidade do Pedal', f.stablePedal, MIN_STABILITY_WINDOW], ['Estabilidade do MAP', f.stableMap, MIN_STABILITY_WINDOW],
  ] as const) {
    if (w.enabled && !(Number.isFinite(w.value) && w.value >= 0 && Number.isInteger(w.n) && w.n >= minN)) return `${label}: valor inválido`
  }
  if (f.holdGear.enabled && !(Number.isInteger(f.holdGear.n) && f.holdGear.n >= 0)) return 'Descartar após troca de marcha: valor inválido'
  return null
}

/** Chaves de primeiro nível de um filtro salvo (para reconhecer um objeto que é, de fato, um filtro). */
const FILTER_KEYS = [
  'ranges', 'lambdaLoop', 'maxDeltaTps', 'maxDeltaMap', 'maxDeltaLambdaTarget',
  'skipClosed', 'skipOpen', 'skipBeforeClosed', 'skipBeforeOpen',
  'holdPedal', 'holdMap', 'holdGear', 'stablePedal', 'stableMap',
] as const

/** Lê um valor persistido; qualquer coisa ilegível ou incompleta volta ao padrão. */
export function sanitizeFilter(raw: unknown): FilterConfig {
  const base = makeDefaultFilter()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  // Um objeto sem cara de filtro salvo (ex.: `{}`) é ilegível: vale o padrão inteiro.
  if (!FILTER_KEYS.some(k => k in r)) return base
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const rawRanges = (r.ranges && typeof r.ranges === 'object' ? r.ranges : {}) as Record<string, unknown>
  for (const sig of FILTER_RANGE_SIGNALS) {
    const v = rawRanges[sig] as Record<string, unknown> | undefined
    if (v && typeof v === 'object') {
      base.ranges[sig] = { enabled: v.enabled === true, min: num(v.min), max: num(v.max) }
    }
  }
  const loop = r.lambdaLoop as Record<string, unknown> | undefined
  if (loop && typeof loop === 'object' && Array.isArray(loop.states)) {
    const states = [...new Set(loop.states.filter(x => x === 0 || x === 1 || x === 2))] as LambdaLoopState[]
    base.lambdaLoop = { enabled: loop.enabled === true, states: states.sort() }
  }
  for (const key of ['maxDeltaTps', 'maxDeltaMap', 'maxDeltaLambdaTarget'] as const) {
    const v = r[key] as Record<string, unknown> | undefined
    const value = v && typeof v === 'object' ? num(v.value) : null
    if (value !== null) base[key] = { enabled: v!.enabled === true, value }
  }
  for (const key of ['skipClosed', 'skipOpen', 'skipBeforeClosed', 'skipBeforeOpen'] as const) {
    const v = r[key] as Record<string, unknown> | undefined
    const n = v && typeof v === 'object' ? num(v.n) : null
    if (n !== null) base[key] = { enabled: v!.enabled === true, n }
  }
  // Campos de estabilização: ausentes (filtro salvo antes deles) ou ilegíveis ficam DESLIGADOS, com os limites padrão —
  // o padrão novo os liga, mas um filtro salvo antes deles tem de continuar deixando passar os mesmos pontos.
  const count = (v: unknown, min: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= min ? v : null)
  for (const [key, minN] of [['holdPedal', 0], ['holdMap', 0], ['stablePedal', MIN_STABILITY_WINDOW], ['stableMap', MIN_STABILITY_WINDOW]] as const) {
    const v = r[key] as Record<string, unknown> | undefined
    const value = v && typeof v === 'object' ? num(v.value) : null
    const n = v && typeof v === 'object' ? count(v.n, minN) : null
    base[key] = value !== null && value >= 0 && n !== null
      ? { enabled: v!.enabled === true, value, n }
      : { ...base[key], enabled: false }
  }
  const gear = r.holdGear as Record<string, unknown> | undefined
  const gearN = gear && typeof gear === 'object' ? count(gear.n, 0) : null
  base.holdGear = gearN !== null ? { enabled: gear!.enabled === true, n: gearN } : { ...base.holdGear, enabled: false }
  return base
}
