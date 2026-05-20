export interface SignalDef {
  /** Identificador no app e chave em DatalogRow */
  name:           string
  /** Nome da coluna no CSV */
  column:         string
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
  /** Converte string raw do CSV para número convertido */
  convert:        (raw: string) => number
  /** Formata número convertido para exibição */
  format:         (value: number) => string
}

export const SIGNAL_DEFS: SignalDef[] = [
  {
    name: 'RPM', column: 'RPM', unit: 'RPM', min: 0, max: 7000,
    defaultVisible: true, tableWidth: 70,
    convert: raw => parseInt(raw, 10),
    format:  v   => String(Math.round(v)),
  },
  {
    name: 'MAP', column: 'MAP', unit: 'kPa', min: 20, max: 250,
    defaultVisible: true, tableWidth: 80,
    convert: raw => parseInt(raw, 10),
    format:  v   => `${Math.round(v)} kPa`,
  },
  {
    name: 'Boost', column: 'Boost', unit: 'kPa', min: 20, max: 250,
    defaultVisible: false, tableWidth: 72,
    convert: raw => parseInt(raw, 10),
    format:  v   => `${Math.round(v)} kPa`,
  },
  {
    name: 'Lambda 1', column: 'Lambda 1', unit: 'λ', min: 0.5, max: 1.5,
    defaultVisible: true, tableWidth: 90,
    convert: raw => parseFloat(raw) / 1000,
    format:  v   => v.toFixed(3),
  },
  {
    name: 'Lambda Target', column: 'Lambda Target', unit: 'λ', min: 0.5, max: 1.5,
    defaultVisible: true, tableWidth: 112,
    convert: raw => parseFloat(raw) / 1000,
    format:  v   => v.toFixed(3),
  },
  {
    name: 'Lambda Corr', column: 'Lambda Corr', unit: '%', min: -20, max: 20,
    defaultVisible: true, tableWidth: 100,
    convert: raw => (parseFloat(raw) - 1000) / 10,
    format:  v   => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
  },
  {
    name: 'Lambda Loop', column: 'Lambda Loop', unit: '', min: 0, max: 1,
    defaultVisible: false, tableWidth: 90,
    convert: raw => parseInt(raw, 10),
    format:  v   => v === 1 ? 'CL' : 'OL',
  },
  {
    name: 'VE', column: 'VE Value', unit: '%', min: 0, max: 150,
    defaultVisible: false, tableWidth: 72,
    convert: raw => parseFloat(raw) / 10,
    format:  v   => `${v.toFixed(1)}%`,
  },
  {
    name: 'CLT', column: 'CLT', unit: 'ºC', min: -20, max: 120,
    defaultVisible: true, tableWidth: 72,
    convert: raw => parseInt(raw, 10) - 273,
    format:  v   => `${Math.round(v)} ºC`,
  },
  {
    name: 'IAT', column: 'IAT', unit: 'ºC', min: -20, max: 80,
    defaultVisible: false, tableWidth: 72,
    convert: raw => parseInt(raw, 10) - 273,
    format:  v   => `${Math.round(v)} ºC`,
  },
  {
    name: 'Inj. Utiliz.', column: 'Inj. Utiliz.', unit: '%', min: 0, max: 100,
    defaultVisible: false, tableWidth: 90,
    convert: raw => parseInt(raw, 10),
    format:  v   => `${Math.round(v)}%`,
  },
  {
    name: 'Ign. Adv.', column: 'Ign. Adv.', unit: 'º', min: -45, max: 45,
    defaultVisible: false, tableWidth: 72,
    convert: raw => parseInt(raw, 10),
    format:  v   => `${v.toFixed(1)} º`,
  },
  {
    name: 'KM/H', column: 'KM/H', unit: 'km/h', min: 0, max: 250,
    defaultVisible: false, tableWidth: 72,
    convert: raw => parseInt(raw, 10),
    format:  v   => `${Math.round(v)} km/h`,
  },
  {
    name: 'Turbo Target', column: 'Turbo Target', unit: 'kPa', min: 20, max: 250,
    defaultVisible: false, tableWidth: 100,
    convert: raw => parseInt(raw, 10),
    format:  v   => `${Math.round(v)} kPa`,
  },
  {
    name: 'Pedal', column: 'ACC %', unit: '%', min: 0, max: 100,
    defaultVisible: false, tableWidth: 72,
    convert: raw => Math.min(100, (parseFloat(raw) / 990) * 100),
    format:  v   => `${v.toFixed(1)}%`,
  },
]

export const SIGNAL_MAP = new Map<string, SignalDef>(SIGNAL_DEFS.map(s => [s.name, s]))

export function getSignalDef(name: string): SignalDef | undefined {
  return SIGNAL_MAP.get(name)
}
