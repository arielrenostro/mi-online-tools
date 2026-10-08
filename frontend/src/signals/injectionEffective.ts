import type { DatalogRow } from '@/types/datalog'

/**
 * Tempo de injeção que de fato entrega combustível (ms): o `Inj. Pulse` logado já inclui o dead
 * time, então basta subtrair `Inj. DT`. Sem clamp — um valor negativo seria um DT errado, não algo
 * a esconder.
 */
export function computeInjEfetivo(row: DatalogRow): number {
  return row['Inj. Pulse'] - row['Inj. DT']
}
