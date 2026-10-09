import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/persistence/localStorage', () => ({
  lsSet:   vi.fn(),
  lsGet:   vi.fn(() => null),
  lsClear: vi.fn(),
}))
vi.mock('@/persistence/runPersistence', () => ({
  saveRun:     vi.fn(async () => {}),
  deleteRun:   vi.fn(async () => {}),
  loadAllRuns: vi.fn(async () => []),
}))

import { useSignalRangesStore, resolveRange, sanitizeSignalRanges } from './signalRangesStore'
import { useCorrectionStore } from './correctionStore'
import { lsSet } from '@/persistence/localStorage'

const st = () => useSignalRangesStore.getState()

beforeEach(() => {
  useSignalRangesStore.setState({ overrides: {} })
  useCorrectionStore.setState({ runs: [], selectedRunId: null, hasUnseenRun: false })
  vi.mocked(lsSet).mockClear()
})

describe('signalRangesStore', () => {
  it('sem sobrescrita devolve a faixa padrão do registro (inclui sinais de runtime)', () => {
    expect(resolveRange('RPM', st().overrides)).toEqual({ min: 0, max: 7000 })
    expect(resolveRange('Lambda 1')).toEqual({ min: 0.7, max: 1.3 })
    expect(resolveRange('Potência', st().overrides)).toEqual({ min: 0, max: 250 })
    expect(resolveRange('Inexistente')).toBeUndefined()
  })

  it('setRange guarda a sobrescrita, persiste e resolveRange a usa', () => {
    st().setRange('MAP', 0, 400)
    expect(resolveRange('MAP', st().overrides)).toEqual({ min: 0, max: 400 })
    expect(resolveRange('RPM', st().overrides)).toEqual({ min: 0, max: 7000 })
    expect(lsSet).toHaveBeenCalledWith('miot:signal-ranges', { MAP: { min: 0, max: 400 } })
  })

  it('aceita limites negativos e zero', () => {
    st().setRange('Lambda Corr', -50, 0)
    expect(st().overrides['Lambda Corr']).toEqual({ min: -50, max: 0 })
  })

  it('rejeita min >= max e não finitos, mantendo a última faixa válida', () => {
    st().setRange('MAP', 10, 300)
    for (const [a, b] of [[300, 300], [400, 300], [NaN, 5], [0, Infinity]] as const) st().setRange('MAP', a, b)
    expect(st().overrides.MAP).toEqual({ min: 10, max: 300 })
  })

  it('ignora sinal desconhecido', () => {
    st().setRange('Inexistente', 0, 1)
    expect(st().overrides).toEqual({})
  })

  it('par igual ao padrão não fica guardado', () => {
    st().setRange('MAP', 0, 400)
    st().setRange('MAP', 0, 200)
    expect(st().overrides).toEqual({})
  })

  it('resetOne restaura só aquele sinal; resetAll restaura todos', () => {
    st().setRange('MAP', 0, 400)
    st().setRange('RPM', 500, 6000)
    st().resetOne('MAP')
    expect(st().overrides).toEqual({ RPM: { min: 500, max: 6000 } })
    st().resetAll()
    expect(st().overrides).toEqual({})
    expect(lsSet).toHaveBeenLastCalledWith('miot:signal-ranges', {})
  })

  it('sanitize descarta nome inexistente, não numérico e min >= max, entrada a entrada', () => {
    const saved = {
      MAP: { min: 0, max: 400 },
      RPM: { min: 'x', max: 7000 },
      CLT: { min: 50, max: 50 },
      Fantasma: { min: 0, max: 1 },
      Pedal: null,
    }
    expect(sanitizeSignalRanges(saved)).toEqual({ MAP: { min: 0, max: 400 } })
    for (const junk of [null, undefined, 'lixo', 42, [1, 2]]) expect(sanitizeSignalRanges(junk)).toEqual({})
  })

  it('hydrate restaura o salvo e cai no padrão com lixo', () => {
    st().hydrate({ MAP: { min: 0, max: 400 } })
    expect(st().overrides).toEqual({ MAP: { min: 0, max: 400 } })
    st().hydrate(null)
    expect(st().overrides).toEqual({})
  })

  it('alterar uma faixa não altera os runs de correção', () => {
    const run = { id: 'r1', name: 'x', createdAt: 0, breakpoints: { map: [1], rpm: [1] }, cells: [], recipe: { logs: [], filter: null } }
    useCorrectionStore.setState({ runs: [run], selectedRunId: 'r1' })
    st().setRange('MAP', 0, 400)
    expect(useCorrectionStore.getState().runs).toEqual([run])
  })
})
