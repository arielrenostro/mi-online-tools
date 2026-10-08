import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/persistence/localStorage', () => ({
  lsSet:   vi.fn(),
  lsGet:   vi.fn(() => null),
  lsClear: vi.fn(),
}))
vi.mock('@/persistence/correctionPersistence', () => ({
  saveSnapshot:  vi.fn(async () => {}),
  loadSnapshot:  vi.fn(async () => undefined),
  clearSnapshot: vi.fn(async () => {}),
}))

import { useConstantsStore, selectCalibrationFactor, DEFAULT_CONSTANTS, sanitizeConstants } from './constantsStore'
import { useCorrectionStore } from './correctionStore'
import { lsSet } from '@/persistence/localStorage'

beforeEach(() => {
  useConstantsStore.setState({ values: DEFAULT_CONSTANTS })
  useCorrectionStore.setState({ snapshot: null, isStale: false })
  vi.mocked(lsSet).mockClear()
})

describe('constantsStore', () => {
  it('começa com os padrões 1587 / 9 / 0,8 / 1000 e k = 1', () => {
    const s = useConstantsStore.getState()
    expect(s.values).toEqual({ displacementCc: 1587, afr: 9, bsfc: 0.8, veAtFull: 1000 })
    expect(selectCalibrationFactor(s)).toBe(1)
  })

  it('k = 1000 / veAtFull', () => {
    useConstantsStore.getState().set({ veAtFull: 873 })
    expect(selectCalibrationFactor(useConstantsStore.getState())).toBeCloseTo(1.1455, 3)
  })

  it('set persiste em miot:constants', () => {
    useConstantsStore.getState().set({ bsfc: 0.7 })
    expect(lsSet).toHaveBeenCalledWith('miot:constants', expect.objectContaining({ bsfc: 0.7, afr: 9 }))
  })

  it('ignora valores inválidos e mantém o último válido', () => {
    const { set } = useConstantsStore.getState()
    set({ afr: 10 })
    for (const bad of [0, -1, NaN, Infinity]) set({ afr: bad })
    expect(useConstantsStore.getState().values.afr).toBe(10)
  })

  it('reset volta aos padrões', () => {
    useConstantsStore.getState().set({ displacementCc: 2000, veAtFull: 900 })
    useConstantsStore.getState().reset()
    expect(useConstantsStore.getState().values).toEqual(DEFAULT_CONSTANTS)
  })

  it('hydrate valida campo a campo e cai no padrão em lixo', () => {
    useConstantsStore.getState().hydrate({ displacementCc: 2000, afr: 'x', bsfc: -3 })
    expect(useConstantsStore.getState().values).toEqual({ ...DEFAULT_CONSTANTS, displacementCc: 2000 })
    useConstantsStore.getState().hydrate(null)
    expect(useConstantsStore.getState().values).toEqual(DEFAULT_CONSTANTS)
    expect(sanitizeConstants('lixo')).toEqual(DEFAULT_CONSTANTS)
  })

  it('alterar uma constante não marca o snapshot como desatualizado', () => {
    useCorrectionStore.setState({ snapshot: { cells: [], generatedAt: 0, provenance: { logFilenames: [], timeRange: null, filters: useCorrectionStore.getState().filters } }, isStale: false })
    useConstantsStore.getState().set({ veAtFull: 873 })
    expect(useCorrectionStore.getState().isStale).toBe(false)
  })
})
