import type { DatalogRow } from '@/types/datalog'

/**
 * VE that the map would need at this point to reach Lambda Target, given the
 * measured lambda and the ECU's own fuel trim. Same unit scale as the `VE`
 * signal (%), so it's directly comparable to it.
 */
export function computeVeLambda(row: DatalogRow): number {
  return (row['Lambda 1'] - row['Lambda Target'] + 1 + row['Lambda Corr'] / 100) * row['VE']
}
