import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/persistence/localStorage', () => ({
  lsSet:   vi.fn(),
  lsGet:   vi.fn(() => null),
  lsClear: vi.fn(),
}))

import { useXYStore, DEFAULT_XY_SETTINGS, sanitizeXYSettings } from './xyStore'
import { lsSet } from '@/persistence/localStorage'

beforeEach(() => {
  useXYStore.setState({ xSignal: DEFAULT_XY_SETTINGS.xSignal, ySignals: [...DEFAULT_XY_SETTINGS.ySignals], showMean: false, showMax: false, showMin: false })
  vi.mocked(lsSet).mockClear()
})

describe('xyStore', () => {
  it('padrão: X = RPM, Y = [MAP]', () => {
    const s = useXYStore.getState()
    expect([s.xSignal, s.ySignals, s.showMean, s.showMax, s.showMin]).toEqual(['RPM', ['MAP'], false, false, false])
  })

  it('linha média: desligada por padrão; alternar persiste; repetir o mesmo valor não persiste de novo', () => {
    const { setShowMean } = useXYStore.getState()
    setShowMean(true)
    expect(useXYStore.getState().showMean).toBe(true)
    expect(lsSet).toHaveBeenLastCalledWith('miot:xy', { xSignal: 'RPM', ySignals: ['MAP'], showMean: true, showMax: false, showMin: false })
    vi.mocked(lsSet).mockClear()
    setShowMean(true)
    expect(lsSet).not.toHaveBeenCalled()
    setShowMean(false)
    expect(useXYStore.getState().showMean).toBe(false)
  })

  it('linha máxima e mínima: desligadas por padrão, independentes entre si e da média, e persistem', () => {
    const s = useXYStore.getState()
    s.setShowMax(true)
    expect(useXYStore.getState()).toMatchObject({ showMean: false, showMax: true, showMin: false })
    expect(lsSet).toHaveBeenLastCalledWith('miot:xy', { xSignal: 'RPM', ySignals: ['MAP'], showMean: false, showMax: true, showMin: false })
    s.setShowMin(true); s.setShowMean(true)
    expect(useXYStore.getState()).toMatchObject({ showMean: true, showMax: true, showMin: true })
    s.setShowMax(false)
    expect(useXYStore.getState()).toMatchObject({ showMean: true, showMax: false, showMin: true })
    vi.mocked(lsSet).mockClear()
    s.setShowMin(true) // sem mudança: não persiste de novo
    expect(lsSet).not.toHaveBeenCalled()
  })

  it('setX troca o X e persiste', () => {
    useXYStore.getState().setX('Pedal')
    expect(useXYStore.getState().xSignal).toBe('Pedal')
    expect(lsSet).toHaveBeenCalledWith('miot:xy', { xSignal: 'Pedal', ySignals: ['MAP'], showMean: false, showMax: false, showMin: false })
  })

  it('addY acrescenta no fim, em ordem, e persiste', () => {
    const { addY } = useXYStore.getState()
    addY('Lambda 1'); addY('Inj. Pulse')
    expect(useXYStore.getState().ySignals).toEqual(['MAP', 'Lambda 1', 'Inj. Pulse'])
    expect(lsSet).toHaveBeenLastCalledWith('miot:xy', { xSignal: 'RPM', ySignals: ['MAP', 'Lambda 1', 'Inj. Pulse'], showMean: false, showMax: false, showMin: false })
  })

  it('addY ignora sinal repetido (sem persistir de novo)', () => {
    useXYStore.getState().addY('MAP')
    expect(useXYStore.getState().ySignals).toEqual(['MAP'])
    expect(lsSet).not.toHaveBeenCalled()
  })

  it('removeY tira o sinal e mantém a ordem dos demais', () => {
    const s = useXYStore.getState()
    s.addY('Lambda 1'); s.addY('Pedal')
    s.removeY('Lambda 1')
    expect(useXYStore.getState().ySignals).toEqual(['MAP', 'Pedal'])
  })

  it('removeY remove inclusive o único Y: a lista fica vazia e persiste vazia', () => {
    useXYStore.getState().removeY('MAP')
    expect(useXYStore.getState().ySignals).toEqual([])
    expect(lsSet).toHaveBeenLastCalledWith('miot:xy', { xSignal: 'RPM', ySignals: [], showMean: false, showMax: false, showMin: false })
  })

  it('removeY de sinal que não está na lista é ignorado', () => {
    useXYStore.getState().removeY('Pedal')
    expect(useXYStore.getState().ySignals).toEqual(['MAP'])
    expect(lsSet).not.toHaveBeenCalled()
  })

  it('depois de esvaziar, addY volta a ter um Y', () => {
    const s = useXYStore.getState()
    s.removeY('MAP'); s.addY('Lambda 1')
    expect(useXYStore.getState().ySignals).toEqual(['Lambda 1'])
  })

  it('o mesmo sinal pode ser X e Y', () => {
    useXYStore.getState().setX('MAP')
    expect(useXYStore.getState()).toMatchObject({ xSignal: 'MAP', ySignals: ['MAP'] })
  })

  it('hydrate restaura um valor salvo', () => {
    useXYStore.getState().hydrate({ xSignal: 'MAP', ySignals: ['Lambda 1', 'Inj. Pulse'] })
    expect(useXYStore.getState()).toMatchObject({ xSignal: 'MAP', ySignals: ['Lambda 1', 'Inj. Pulse'] })
  })
})

describe('sanitizeXYSettings', () => {
  it('ausente ou ilegível cai no padrão, sem erro', () => {
    for (const bad of [null, undefined, 42, 'x', [], {}]) {
      expect(sanitizeXYSettings(bad)).toEqual(DEFAULT_XY_SETTINGS)
    }
  })

  it('descarta itens que não são texto e deduplica', () => {
    expect(sanitizeXYSettings({ xSignal: 'RPM', ySignals: ['MAP', 3, null, '', 'MAP', 'Pedal'] }))
      .toEqual({ xSignal: 'RPM', ySignals: ['MAP', 'Pedal'], showMean: false, showMax: false, showMin: false })
  })

  it('lista Y salva vazia é uma escolha válida e volta vazia', () => {
    expect(sanitizeXYSettings({ xSignal: 'Pedal', ySignals: [] }).ySignals).toEqual([])
  })

  it('Y ausente, que não é lista ou lista só de lixo volta ao padrão; X inválido volta a RPM — campo a campo', () => {
    for (const bad of [undefined, null, 'MAP', 7, {}, [3, null, '']]) {
      expect(sanitizeXYSettings({ xSignal: 'Pedal', ySignals: bad }).ySignals).toEqual(['MAP'])
    }
    expect(sanitizeXYSettings({ xSignal: 7, ySignals: ['Lambda 1'] })).toEqual({ xSignal: 'RPM', ySignals: ['Lambda 1'], showMean: false, showMax: false, showMin: false })
  })

  it('showMean: só `true` liga; qualquer outra coisa fica desligada', () => {
    expect(sanitizeXYSettings({ showMean: true, showMax: false, showMin: false }).showMean).toBe(true)
    for (const bad of [false, 1, 'true', null, undefined]) expect(sanitizeXYSettings({ showMean: bad }).showMean).toBe(false)
  })

  it('showMax/showMin: só `true` liga; o resto fica desligado, cada um no seu campo', () => {
    expect(sanitizeXYSettings({ showMax: true, showMin: false })).toMatchObject({ showMax: true, showMin: false })
    expect(sanitizeXYSettings({ showMin: true })).toMatchObject({ showMax: false, showMin: true })
    for (const bad of [1, 'true', null, undefined]) {
      expect(sanitizeXYSettings({ showMax: bad, showMin: bad })).toMatchObject({ showMax: false, showMin: false })
    }
  })

  it('não filtra por sinais disponíveis (sinal de log inativo é mantido)', () => {
    expect(sanitizeXYSettings({ xSignal: 'RPM', ySignals: ['Marcha'] }).ySignals).toEqual(['Marcha'])
  })
})
