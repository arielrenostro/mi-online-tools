import { describe, it, expect } from 'vitest'
import { selectDynoRows, isDynoRangeInvalid, isGearRestricted } from './dynoFilter'
import { DEFAULT_DYNO_SETTINGS } from '@/store/dynoStore'
import type { DynoFilters } from '@/store/dynoStore'
import type { DatalogRow } from '@/types/datalog'

function row(over: Partial<DatalogRow> = {}): DatalogRow {
  return { timestamp_ms: 0, 'Pedal': 100, 'RPM': 4000, 'MAP': 120, 'CLT': 90, 'Lambda Loop': 1, ...over }
}
const F = DEFAULT_DYNO_SETTINGS.filters
const withF = (p: Partial<DynoFilters>): DynoFilters => ({ ...F, ...p })

describe('marcha', () => {
  const rows = [0, 1, 2, 3, 4, 5].map(g => row({ Marcha: g }))

  it('uma marcha', () => {
    expect(selectDynoRows(rows, withF({ gears: [4] }), null).map(r => r.Marcha)).toEqual([4])
  })

  it('várias marchas', () => {
    expect(selectDynoRows(rows, withF({ gears: [3, 4] }), null).map(r => r.Marcha)).toEqual([3, 4])
  })

  it('todas marcadas = sem restrição, inclusive linha sem Marcha', () => {
    const semMarcha = row()
    expect(isGearRestricted(F)).toBe(false)
    expect(selectDynoRows([...rows, semMarcha], F, null)).toHaveLength(7)
  })

  it('sob restrição, linha sem Marcha ou com NaN falha', () => {
    const f = withF({ gears: [3, 4] })
    expect(isGearRestricted(f)).toBe(true)
    expect(selectDynoRows([row(), row({ Marcha: NaN })], f, null)).toEqual([])
  })

  it('combina em AND com os demais filtros', () => {
    const rs = [row({ Marcha: 4, Pedal: 100 }), row({ Marcha: 4, Pedal: 10 }), row({ Marcha: 3, Pedal: 100 })]
    expect(selectDynoRows(rs, withF({ gears: [4] }), null)).toEqual([rs[0]])
  })
})

describe('selectDynoRows', () => {
  it('filtros padrão: Pedal ≥ 90 e CLT ≥ 80', () => {
    const rows = [row(), row({ Pedal: 89.9 }), row({ CLT: 79 }), row({ Pedal: 90, CLT: 80 })]
    expect(selectDynoRows(rows, F, null)).toEqual([rows[0], rows[3]])
  })

  it('campo vazio (null) = sem limite', () => {
    const rows = [row({ Pedal: 10 }), row({ Pedal: 100 })]
    expect(selectDynoRows(rows, withF({ minPedal: null }), null)).toHaveLength(2)
  })

  it('RPM mín/máx inclusivos', () => {
    const rows = [2999, 3000, 5000, 5001].map(RPM => row({ RPM }))
    expect(selectDynoRows(rows, withF({ minRpm: 3000, maxRpm: 5000 }), null).map(r => r.RPM)).toEqual([3000, 5000])
  })

  it('MAP mínimo', () => {
    const rows = [row({ MAP: 99 }), row({ MAP: 100 })]
    expect(selectDynoRows(rows, withF({ minMap: 100 }), null)).toEqual([rows[1]])
  })

  it('Lambda Loop por pertencimento', () => {
    const rows = [row({ 'Lambda Loop': 0 }), row({ 'Lambda Loop': 1 }), row({ 'Lambda Loop': 2 })]
    expect(selectDynoRows(rows, withF({ lambdaLoop: [1, 2] }), null)).toEqual([rows[1], rows[2]])
  })

  it('NaN falha apenas campo preenchido', () => {
    const r = row({ MAP: NaN })
    expect(selectDynoRows([r], withF({ minMap: 100 }), null)).toEqual([])
    expect(selectDynoRows([r], withF({ minMap: null }), null)).toEqual([r])
  })

  it('seleção de tempo restringe (inclusiva) em AND com os filtros', () => {
    const rows = [0, 100, 200, 300].map(timestamp_ms => row({ timestamp_ms }))
    const sel = { start_ms: 100, end_ms: 200 }
    expect(selectDynoRows(rows, F, sel).map(r => r.timestamp_ms)).toEqual([100, 200])
    expect(selectDynoRows([row({ timestamp_ms: 100, Pedal: 5 })], F, sel)).toEqual([])
  })

  it('RPM mín > máx é inválido e nada passa', () => {
    const f = withF({ minRpm: 5000, maxRpm: 3000 })
    expect(isDynoRangeInvalid(f)).toBe(true)
    expect(selectDynoRows([row()], f, null)).toEqual([])
    expect(isDynoRangeInvalid(withF({ minRpm: 3000, maxRpm: 3000 }))).toBe(false)
  })
})
