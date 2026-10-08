import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/persistence/localStorage', () => ({
  lsSet:   vi.fn(),
  lsGet:   vi.fn(() => null),
  lsClear: vi.fn(),
}))

import { useDynoStore, DEFAULT_DYNO_SETTINGS, sanitizeDynoSettings } from './dynoStore'
import { lsSet } from '@/persistence/localStorage'

beforeEach(() => {
  useDynoStore.setState(DEFAULT_DYNO_SETTINGS)
  vi.mocked(lsSet).mockClear()
})

describe('dynoStore', () => {
  it('padrões: Pedal 90, CLT 80, Loop 0/1/2, todas as marchas, Motor, 15%, Suavizado, 100 rpm', () => {
    const s = useDynoStore.getState()
    expect(s.filters).toEqual({ minPedal: 90, minRpm: null, maxRpm: null, minMap: null, minClt: 80, lambdaLoop: [0, 1, 2], gears: [0, 1, 2, 3, 4, 5] })
    expect([s.mode, s.lossPct, s.smoothing]).toEqual(['engine', 15, 'smoothed'])
    expect(s).not.toHaveProperty('bandWidth')
  })

  it('campo vazio (null) = sem limite e persiste', () => {
    useDynoStore.getState().setFilters({ minPedal: null })
    expect(useDynoStore.getState().filters.minPedal).toBeNull()
    expect(lsSet).toHaveBeenCalledWith('miot:dyno', expect.objectContaining({ filters: expect.objectContaining({ minPedal: null }) }))
  })

  it('perda fora de 0–100 é ignorada', () => {
    const { setLossPct } = useDynoStore.getState()
    setLossPct(12); setLossPct(-1); setLossPct(101); setLossPct(NaN)
    expect(useDynoStore.getState().lossPct).toBe(12)
  })

  it('resetFilters volta filtros e perda aos padrões, sem mexer em modo/suavização, e persiste', () => {
    const s = useDynoStore.getState()
    s.setFilters({ minPedal: 50, gears: [4], minRpm: 3000 })
    s.setLossPct(30); s.setMode('wheel'); s.setSmoothing('raw')
    vi.mocked(lsSet).mockClear()
    useDynoStore.getState().resetFilters()
    const r = useDynoStore.getState()
    expect(r.filters).toEqual(DEFAULT_DYNO_SETTINGS.filters)
    expect(r.lossPct).toBe(15)
    expect([r.mode, r.smoothing]).toEqual(['wheel', 'raw'])
    expect(lsSet).toHaveBeenCalledWith('miot:dyno', expect.objectContaining({ lossPct: 15, mode: 'wheel' }))
  })

  it('mantém ao menos um estado de Lambda Loop', () => {
    useDynoStore.getState().setFilters({ lambdaLoop: [] })
    expect(useDynoStore.getState().filters.lambdaLoop).toEqual([0, 1, 2])
  })

  it('marchas: normaliza (ordem, duplicadas, fora de 0–5) e mantém ao menos uma', () => {
    const { setFilters } = useDynoStore.getState()
    setFilters({ gears: [4, 3, 3, 9] })
    expect(useDynoStore.getState().filters.gears).toEqual([3, 4])
    setFilters({ gears: [] })
    expect(useDynoStore.getState().filters.gears).toEqual([3, 4])
    setFilters({ gears: [9] })
    expect(useDynoStore.getState().filters.gears).toEqual([3, 4])
  })

  it('hydrate de marchas: restaura o salvo; ausente, vazio ou lixo → todas', () => {
    const { hydrate } = useDynoStore.getState()
    hydrate({ filters: { gears: [3, 4] } })
    expect(useDynoStore.getState().filters.gears).toEqual([3, 4])
    for (const bad of [undefined, [], 'x', [9, 10]]) {
      hydrate({ filters: { gears: bad } })
      expect(useDynoStore.getState().filters.gears).toEqual([0, 1, 2, 3, 4, 5])
    }
  })

  it('hydrate restaura o salvo e cai no padrão campo a campo em lixo', () => {
    useDynoStore.getState().hydrate({ filters: { minPedal: 80, minClt: 'x' }, mode: 'wheel', lossPct: 12, smoothing: 'raw', bandWidth: -5 })
    const s = useDynoStore.getState()
    expect(s.filters.minPedal).toBe(80)
    expect(s.filters.minClt).toBe(80)
    expect([s.mode, s.lossPct, s.smoothing]).toEqual(['wheel', 12, 'raw'])
    expect(s).not.toHaveProperty('bandWidth')
    expect(sanitizeDynoSettings(null)).toEqual(DEFAULT_DYNO_SETTINGS)
  })
})
