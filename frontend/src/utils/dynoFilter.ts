import type { DatalogRow, TimeSelection } from '@/types/datalog'
import type { DynoFilters } from '@/store/dynoStore'
import { GEAR_OPTIONS } from '@/store/dynoStore'

/** Mínimo de RPM maior que o máximo: nenhuma linha pode passar. */
export function isDynoRangeInvalid(filters: DynoFilters): boolean {
  return filters.minRpm !== null && filters.maxRpm !== null && filters.minRpm > filters.maxRpm
}

/** Há restrição de marcha quando nem todas as marchas estão marcadas. */
export function isGearRestricted(filters: DynoFilters): boolean {
  return GEAR_OPTIONS.some(g => !filters.gears.includes(g))
}

/**
 * Linhas usadas pelo dinamômetro: dentro da seleção de tempo (quando há) e satisfazendo TODOS os
 * campos preenchidos (AND, limites inclusivos; `null` = sem limite). Valor não numérico (NaN) falha
 * o campo preenchido correspondente. Marcha só restringe quando nem todas estão marcadas — com tudo
 * marcado, linhas sem Marcha (logs sem a coluna) passam. Independente da máscara de correção e do filtro visual.
 */
export function selectDynoRows(
  rows: DatalogRow[],
  filters: DynoFilters,
  selection: TimeSelection | null,
): DatalogRow[] {
  if (isDynoRangeInvalid(filters) || filters.lambdaLoop.length === 0) return []

  const { minPedal, minRpm, maxRpm, minMap, minClt, lambdaLoop, gears } = filters
  const gearRestricted = isGearRestricted(filters)
  const passes = (v: unknown, min: number | null, max: number | null): boolean => {
    if (min === null && max === null) return true
    if (typeof v !== 'number' || Number.isNaN(v)) return false
    return (min === null || v >= min) && (max === null || v <= max)
  }

  return rows.filter(row => {
    if (selection && (row.timestamp_ms < selection.start_ms || row.timestamp_ms > selection.end_ms)) return false
    if (!lambdaLoop.includes(row['Lambda Loop'] as 0 | 1 | 2)) return false
    if (gearRestricted) {
      const gear = row['Marcha']
      if (!Number.isFinite(gear) || !gears.includes(gear)) return false
    }
    return passes(row['Pedal'], minPedal, null)
        && passes(row['RPM'],   minRpm,   maxRpm)
        && passes(row['MAP'],   minMap,   null)
        && passes(row['CLT'],   minClt,   null)
  })
}
