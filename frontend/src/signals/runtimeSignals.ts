import type { DatalogRow } from '@/types/datalog'
import { computeEnginePower } from './enginePower'
import type { EngineConstants } from './enginePower'

/**
 * Sinais que dependem das constantes editáveis (constantes da tela Configurações) — por isso são
 * calculados na leitura (`getDisplayRows`), nunca no parse nem gravados no `model` persistido.
 */
export interface RuntimeSignalDef {
  name:           string
  unit:           string
  min:            number
  max:            number
  defaultVisible: boolean
  tableWidth:     number
  format:         (value: number) => string
}

export interface RuntimeSignalContext {
  constants: EngineConstants
  /** Fator de calibração de VE (k = 100% / VE informado). */
  k:         number
}

export const RUNTIME_SIGNAL_DEFS: RuntimeSignalDef[] = [
  {
    name: 'VE Lambda Corrigido', unit: '%', min: 0, max: 125,
    defaultVisible: true, tableWidth: 130,
    format: v => `${v.toFixed(1)}%`,
  },
  {
    name: 'Potência', unit: 'cv', min: 0, max: 250,
    defaultVisible: true, tableWidth: 90,
    format: v => `${v.toFixed(1)} cv`,
  },
  {
    name: 'Torque', unit: 'kgf·m', min: 0, max: 30,
    defaultVisible: true, tableWidth: 100,
    format: v => `${v.toFixed(2)} kgf·m`,
  },
]

export const RUNTIME_SIGNAL_NAMES: string[] = RUNTIME_SIGNAL_DEFS.map(s => s.name)

/** Preenche in-place os sinais de runtime na ordem: VE Lambda Corrigido → Potência → Torque. */
export function applyRuntimeSignals(row: DatalogRow, ctx: RuntimeSignalContext): void {
  const veCorrected = row['VE Lambda'] * ctx.k
  row['VE Lambda Corrigido'] = veCorrected

  const { power, torque } = computeEnginePower(
    { map: row['MAP'], rpm: row['RPM'], iatC: row['IAT'], lambda1: row['Lambda 1'], veFraction: veCorrected / 100 },
    ctx.constants,
  )
  row['Potência'] = power
  row['Torque']   = torque
}
