/** Constantes de engenharia editáveis na tela Configurações (seção "Constantes"). */
export interface EngineConstants {
  /** Cilindrada (cc). */
  displacementCc: number
  /** Relação ar-combustível estequiométrica (etanol ≈ 9). */
  afr:            number
  /** Consumo específico de combustível (lb/hp·h). */
  bsfc:           number
}

export const DEFAULT_ENGINE_CONSTANTS: EngineConstants = {
  displacementCc: 1587,
  afr:            9,
  bsfc:           0.8,
}

export interface EnginePowerInput {
  map:        number // kPa
  rpm:        number
  iatC:       number // ºC
  lambda1:    number
  /** VE como fração (VE% / 100), já com a calibração aplicada. */
  veFraction: number
}

const GAS_CONSTANT_AIR = 287      // J/(kg·K)
const KELVIN_OFFSET    = 273
const LB_PER_KG        = 2.20462
const TORQUE_CV_FACTOR = 716.2    // kgf·m = cv × 716,2 / rpm
const CV_PER_HP        = 745.7 / 735.5 // hp (745,7 W) → cv métrico (735,5 W)

/**
 * Potência (cv) e torque (kgf·m) do motor estimados pelo consumo de combustível — a conta das
 * colunas AM/AN da aba "Log" da planilha, com o BSFC em lb/hp·h e a potência em hp convertida para cv. NaN quando a entrada não permite o cálculo.
 */
export function computeEnginePower(
  input: EnginePowerInput,
  constants: EngineConstants,
): { power: number; torque: number } {
  const { map, rpm, iatC, lambda1, veFraction } = input
  const invalid = { power: NaN, torque: NaN }
  if (!(lambda1 > 0) || !(rpm >= 0) || !(iatC + KELVIN_OFFSET > 0)) return invalid

  const airKgS  = (map * 1000 * veFraction * (constants.displacementCc / 1e6) * rpm)
                  / (GAS_CONSTANT_AIR * (iatC + KELVIN_OFFSET) * 2 * 60)
  const fuelKgS = airKgS / (constants.afr * lambda1)
  const powerHp = (fuelKgS * 3600 * LB_PER_KG) / constants.bsfc
  const power   = powerHp * CV_PER_HP
  const torque  = rpm > 0 ? (power * TORQUE_CV_FACTOR) / rpm : 0

  if (!Number.isFinite(power) || !Number.isFinite(torque)) return invalid
  return { power, torque }
}
