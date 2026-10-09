import { RUNTIME_SIGNAL_NAMES } from './runtimeSignals'

export const CONSTANTS_ORIGIN_HINT = 'Calculado a partir das constantes definidas em Configurações'

/**
 * Texto de hover dos sinais que dependem das constantes editáveis (VE Lambda Corrigido, Potência,
 * Torque), para o usuário saber de onde vêm os valores. Sinais lidos do CSV não têm hover.
 */
export function signalOriginHint(name: string): string | undefined {
  return RUNTIME_SIGNAL_NAMES.includes(name) ? CONSTANTS_ORIGIN_HINT : undefined
}
