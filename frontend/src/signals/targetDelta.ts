import type { DatalogRow } from '@/types/datalog'

/**
 * Erro de mistura (λ): medido − alvo. Positivo = mais pobre que o alvo, negativo = mais rico.
 * Sem clamp, como `Inj. Efetivo` — o valor cru é o que o usuário quer ver.
 */
export function computeDeltaLambdaTarget(row: DatalogRow): number {
  return row['Lambda 1'] - row['Lambda Target']
}

/** Erro de boost (kPa): medido − alvo. Positivo = acima do alvo, negativo = abaixo. */
export function computeDeltaBoostTarget(row: DatalogRow): number {
  return row['Boost'] - row['Boost Target']
}
