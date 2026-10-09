import { describe, it, expect } from 'vitest'
import { filterChips, logChip, logChips, fmtClock } from './runRecipe'
import { cloneFilter, DEFAULT_FILTER } from '@/types/filter'

describe('filterChips', () => {
  it('lists every enabled criterion of the default filter and nothing else', () => {
    expect(filterChips(DEFAULT_FILTER)).toEqual([
      'Lambda 1 0.6–1.1', 'CLT ≥ 85', 'Loop: Fechado/Fechado+AC',
      'ΔTPS ≤ 5', 'ΔMAP ≤ 5', '|Δλ×alvo| ≤ 0.03', 'pula 5 1ºs CL', 'pula 10 1ºs OL',
    ])
  })

  it('includes an enabled MAP range, with open-ended and empty variants', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.ranges['MAP'] = { enabled: true, min: 80, max: 120 }
    f.ranges['RPM'] = { enabled: true, min: null, max: 5000 }
    f.ranges['Pedal'] = { enabled: true, min: null, max: null }
    const chips = filterChips(f)
    expect(chips).toContain('MAP 80–120')
    expect(chips).toContain('RPM ≤ 5000')
    expect(chips).toContain('Pedal (sem limites)')
  })

  it('lists an enabled new range', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.ranges['Inj. Utiliz.'] = { enabled: true, min: null, max: 85 }
    expect(filterChips(f)).toContain('Inj. Utiliz. ≤ 85')
  })

  it('renders a recipe saved before the new ranges existed, without them', () => {
    const f = cloneFilter(DEFAULT_FILTER) as unknown as { ranges: Record<string, unknown> }
    for (const sig of ['Batt Volt.', 'Inj. DT', 'Inj. Utiliz.', 'Inj. Pulse', 'Lambda Target', 'Boost', 'IAT'] as const) delete f.ranges[sig]
    expect(filterChips(f as never)).toEqual(filterChips(DEFAULT_FILTER))
  })

  it('lists the enabled "before" skips', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.skipBeforeClosed = { enabled: true, n: 3 }
    f.skipBeforeOpen = { enabled: true, n: 4 }
    const chips = filterChips(f)
    expect(chips).toContain('pula 3 últimos antes de CL')
    expect(chips).toContain('pula 4 últimos antes de OL')
    expect(filterChips(DEFAULT_FILTER).some(c => c.includes('antes de'))).toBe(false)
  })

  it('tolerates the filter of a run saved before the "before" skips existed', () => {
    const old = cloneFilter(DEFAULT_FILTER) as unknown as Record<string, unknown>
    delete old.skipBeforeClosed
    delete old.skipBeforeOpen
    expect(() => filterChips(old as unknown as typeof DEFAULT_FILTER)).not.toThrow()
    expect(filterChips(old as unknown as typeof DEFAULT_FILTER)).toContain('pula 5 1ºs CL')
  })

  it('omits disabled criteria and tolerates an unknown filter', () => {
    const f = cloneFilter(DEFAULT_FILTER)
    f.skipOpen.enabled = false
    f.lambdaLoop.enabled = false
    expect(filterChips(f)).not.toContain('pula 10 1ºs OL')
    expect(filterChips(f).some(c => c.startsWith('Loop'))).toBe(false)
    expect(filterChips(null)).toEqual([])
  })
})

describe('logChip / logChips', () => {
  it('shows full, unused and per-log intervals', () => {
    expect(logChip({ hash: 'a', filename: 'a.csv', range: 'full' })).toBe('a.csv')
    expect(logChip({ hash: 'b', filename: 'b.csv', range: 'unused' })).toBe('b.csv (não usado)')
    expect(logChip({ hash: 'c', filename: 'c.csv', range: { start_ms: 65_000, end_ms: 125_000 } })).toBe('c.csv 01:05–02:05')
  })

  it('adds the global interval of a migrated run', () => {
    const chips = logChips({ logs: [{ hash: null, filename: 'old.csv', range: 'full' }], filter: null, globalTimeRange: { start_ms: 1000, end_ms: 61_000 } })
    expect(chips).toEqual(['old.csv', 'intervalo 00:01–01:01 (linha do tempo)'])
  })
})

describe('fmtClock', () => {
  it('formats mm:ss', () => {
    expect(fmtClock(0)).toBe('00:00')
    expect(fmtClock(61_500)).toBe('01:01')
  })
})
