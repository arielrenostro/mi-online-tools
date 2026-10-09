import type { DatalogRow } from '@/types/datalog'
import { computeVeLambda } from './veLambdaFormula'
import { computeInjEfetivo } from './injectionEffective'
import { RUNTIME_SIGNAL_DEFS } from './runtimeSignals'

/**
 * Divisor do `dACC %`: (raw − 5000) / DACC_DIVISOR. É a melhor leitura disponível, não verificada
 * contra a ECU — escala de exibição, nunca usada em cálculo. Mudar aqui exige subir `PARSER_VERSION`.
 */
export const DACC_DIVISOR = 100

export interface SignalDef {
  /** Identificador no app e chave em DatalogRow */
  name:           string
  /** Nome da coluna no CSV — ausente para sinais derivados (ver `compute`) */
  column?:        string
  /** Coluna opcional: ausente no CSV (ou valor não numérico) não derruba o import — a linha só fica sem o sinal */
  optional?:      boolean
  /** Unidade para exibição */
  unit:           string
  /** Mínimo do eixo Y nos gráficos */
  min:            number
  /** Máximo do eixo Y nos gráficos */
  max:            number
  /** Visível por padrão na aba Dados */
  defaultVisible: boolean
  /** Largura da coluna na tabela (px) */
  tableWidth:     number
  /** Converte string raw do CSV para número convertido — ausente para sinais derivados */
  convert?:       (raw: string) => number
  /** Formata número convertido para exibição */
  format:         (value: number) => string
  /** Calcula o valor a partir de outros sinais já convertidos da mesma linha — sinais derivados só (sem coluna própria no CSV) */
  compute?:       (row: DatalogRow) => number
  /**
   * Sinais lidos por `compute`. Quando presente, o derivado só é calculado numa linha em que todos
   * eles são números válidos, e só é listado num log em que todos estão listados. Ausente = sempre
   * calculado (as entradas são colunas obrigatórias, ex.: VE Lambda).
   */
  inputs?:        string[]
}

export const SIGNAL_DEFS: SignalDef[] = [
  {
    name: 'RPM', column: 'RPM', unit: 'RPM', min: 0, max: 7000,
    defaultVisible: true, tableWidth: 70,
    convert: raw => parseInt(raw, 10),
    format:  v   => String(Math.round(v)),
  },
  {
    name: 'MAP', column: 'MAP', unit: 'kPa', min: 0, max: 200,
    defaultVisible: true, tableWidth: 80,
    convert: raw => parseInt(raw, 10),
    format:  v   => `${Math.round(v)} kPa`,
  },
  {
    name: 'Boost', column: 'Boost', unit: 'kPa', min: 0, max: 200,
    defaultVisible: true, tableWidth: 72,
    convert: raw => parseInt(raw, 10),
    format:  v   => `${Math.round(v)} kPa`,
  },
  {
    name: 'Lambda 1', column: 'Lambda 1', unit: 'λ', min: 0.7, max: 1.3,
    defaultVisible: true, tableWidth: 90,
    convert: raw => parseFloat(raw) / 1000,
    format:  v   => v.toFixed(3),
  },
  {
    name: 'Lambda Target', column: 'Lambda Target', unit: 'λ', min: 0.7, max: 1.3,
    defaultVisible: true, tableWidth: 112,
    convert: raw => parseFloat(raw) / 1000,
    format:  v   => v.toFixed(3),
  },
  {
    name: 'Lambda Corr', column: 'Lambda Corr', unit: '%', min: -30, max: 30,
    defaultVisible: true, tableWidth: 100,
    convert: raw => (parseFloat(raw) - 1000) / 10,
    format:  v   => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
  },
  {
    name: 'Lambda Loop', column: 'Lambda Loop', unit: '', min: 0, max: 2,
    defaultVisible: true, tableWidth: 90,
    convert: raw => parseInt(raw, 10),
    format:  v   => v === 0 ? 'OL' : v === 1 ? 'CL' : 'CL+AC',
  },
  {
    name: 'VE', column: 'VE Value', unit: '%', min: 0, max: 125,
    defaultVisible: true, tableWidth: 72,
    convert: raw => parseFloat(raw) / 10,
    format:  v   => `${v.toFixed(1)}%`,
  },
  {
    name: 'CLT', column: 'CLT', unit: 'ºC', min: 10, max: 120,
    defaultVisible: true, tableWidth: 72,
    convert: raw => parseInt(raw, 10) - 273,
    format:  v   => `${Math.round(v)} ºC`,
  },
  {
    name: 'IAT', column: 'IAT', unit: 'ºC', min: 10, max: 120,
    defaultVisible: true, tableWidth: 72,
    convert: raw => parseInt(raw, 10) - 273,
    format:  v   => `${Math.round(v)} ºC`,
  },
  {
    name: 'Inj. Utiliz.', column: 'Inj. Utiliz.', unit: '%', min: 0, max: 100,
    defaultVisible: true, tableWidth: 90,
    convert: raw => parseInt(raw, 10),
    format:  v   => `${Math.round(v)}%`,
  },
  {
    name: 'Ign. Adv.', column: 'Ign. Adv.', unit: 'º', min: -45, max: 45,
    defaultVisible: true, tableWidth: 72,
    convert: raw => parseInt(raw, 10),
    format:  v   => `${v.toFixed(1)} º`,
  },
  {
    name: 'KM/H', column: 'KM/H', unit: 'km/h', min: 0, max: 250,
    defaultVisible: true, tableWidth: 72,
    convert: raw => parseInt(raw, 10),
    format:  v   => `${Math.round(v)} km/h`,
  },
  {
    name: 'Turbo Target', column: 'Turbo Target', unit: 'kPa', min: 0, max: 200,
    defaultVisible: true, tableWidth: 100,
    convert: raw => parseInt(raw, 10),
    format:  v   => `${Math.round(v)} kPa`,
  },
  {
    name: 'Pedal', column: 'ACC %', unit: '%', min: 0, max: 100,
    defaultVisible: true, tableWidth: 72,
    convert: raw => Math.min(100, (parseFloat(raw) / 990) * 100),
    format:  v   => `${v.toFixed(1)}%`,
  },
  {
    // O CSV tem duas colunas chamadas "0"; a marcha é a ÚLTIMA (o parser deixa o último índice vencer).
    name: 'Marcha', column: '0', optional: true, unit: '', min: 0, max: 6,
    defaultVisible: true, tableWidth: 72,
    convert: raw => parseInt(raw, 10),
    format:  v   => String(Math.round(v)),
  },
  {
    // Raw em 10 µs por unidade: 1337 = 13,37 ms. Já inclui o dead time (ver `Inj. Efetivo`).
    name: 'Inj. Pulse', column: 'Inj. Pulse', optional: true, unit: 'ms', min: 0, max: 20,
    defaultVisible: true, tableWidth: 90,
    convert: raw => parseFloat(raw) / 100,
    format:  v   => `${v.toFixed(2)} ms`,
  },
  {
    // Raw em µs: 1100 = 1,1 ms. Varia com a tensão da bateria.
    name: 'Inj. DT', column: 'Inj. DT', optional: true, unit: 'ms', min: 0, max: 2,
    defaultVisible: true, tableWidth: 80,
    convert: raw => parseFloat(raw) / 1000,
    format:  v   => `${v.toFixed(2)} ms`,
  },
  {
    // A coluna se chama "ACP %", mas o valor é a pressão do compressor do A/C em kPa.
    name: 'ACP', column: 'ACP %', optional: true, unit: 'kPa', min: 0, max: 2000,
    defaultVisible: true, tableWidth: 80,
    convert: raw => parseInt(raw, 10),
    format:  v   => `${Math.round(v)} kPa`,
  },
  {
    // 5000 = pedal estável; positivo = subindo, negativo = soltando. Escala não verificada (DACC_DIVISOR).
    name: 'dACC', column: 'dACC %', optional: true, unit: '%', min: -5, max: 5,
    defaultVisible: true, tableWidth: 80,
    convert: raw => (parseInt(raw, 10) - 5000) / DACC_DIVISOR,
    format:  v   => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
  },
  {
    name: 'Batt Volt.', column: 'Batt Volt.', optional: true, unit: 'V', min: 8, max: 16,
    defaultVisible: true, tableWidth: 80,
    convert: raw => parseFloat(raw) / 10,
    format:  v   => `${v.toFixed(1)} V`,
  },
  {
    // A coluna se chama "Lambda 2", mas neste setup carrega a pressão de óleo (173 = 1,73 bar).
    name: 'Pressão Óleo', column: 'Lambda 2', optional: true, unit: 'bar', min: 0, max: 8,
    defaultVisible: true, tableWidth: 110,
    convert: raw => parseFloat(raw) / 100,
    format:  v   => `${v.toFixed(2)} bar`,
  },
  {
    name: 'VE Lambda', unit: '%', min: 0, max: 125,
    defaultVisible: true, tableWidth: 90,
    compute: computeVeLambda,
    format:  v => `${v.toFixed(1)}%`,
  },
  {
    name: 'Inj. Efetivo', unit: 'ms', min: 0, max: 20,
    defaultVisible: true, tableWidth: 100,
    compute: computeInjEfetivo,
    inputs:  ['Inj. Pulse', 'Inj. DT'],
    format:  v => `${v.toFixed(2)} ms`,
  },
]

/** Metadados de exibição comuns a sinais do CSV, derivados no parse e de runtime. */
export type DisplaySignalDef = Pick<SignalDef, 'name' | 'unit' | 'min' | 'max' | 'defaultVisible' | 'tableWidth' | 'format'>

/**
 * Ordem de exibição: sinais parecidos lado a lado, em todo lugar que lista sinais (Dashboard,
 * sidebar/seletor dos Gráficos, colunas e menu da aba Dados). Independe da ordem das colunas do CSV
 * e da ordem gravada no model do log; sinal ausente some sem deixar buraco no grupo.
 */
export const SIGNAL_GROUPS: string[][] = [
  ['RPM', 'MAP', 'Boost', 'Turbo Target'],
  ['Pedal', 'dACC'],
  ['Lambda 1', 'Lambda Target', 'Lambda Corr', 'Lambda Loop'],
  ['VE', 'VE Lambda', 'VE Lambda Corrigido'],
  ['Inj. Pulse', 'Inj. DT', 'Inj. Efetivo', 'Inj. Utiliz.'],
  ['Ign. Adv.'],
  ['CLT', 'IAT'],
  ['Batt Volt.', 'ACP', 'Pressão Óleo'],
  ['KM/H', 'Marcha'],
  ['Potência', 'Torque'],
]

const SIGNAL_ORDER = new Map<string, number>(SIGNAL_GROUPS.flat().map((name, i) => [name, i]))

const rank = (name: string) => SIGNAL_ORDER.get(name) ?? SIGNAL_ORDER.size

/** Nomes de sinais na ordem de exibição agrupada; desconhecidos vão por último, em ordem relativa estável. */
export function sortSignals(names: readonly string[]): string[] {
  return [...names].sort((a, b) => rank(a) - rank(b))
}

/**
 * Todos os sinais exibíveis: `SIGNAL_DEFS` (parse — o que o parser lê/calcula e grava no `model`)
 * e os de runtime (`RUNTIME_SIGNAL_DEFS`, calculados na leitura a partir das constantes), na ordem
 * de exibição agrupada.
 */
export const DISPLAY_SIGNAL_DEFS: DisplaySignalDef[] = [...SIGNAL_DEFS, ...RUNTIME_SIGNAL_DEFS]
  .sort((a, b) => rank(a.name) - rank(b.name))

export const SIGNAL_MAP = new Map<string, DisplaySignalDef>(DISPLAY_SIGNAL_DEFS.map(s => [s.name, s]))

export function getSignalDef(name: string): DisplaySignalDef | undefined {
  return SIGNAL_MAP.get(name)
}
