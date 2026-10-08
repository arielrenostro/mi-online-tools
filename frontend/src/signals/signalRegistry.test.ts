import { describe, it, expect } from 'vitest'
import { SIGNAL_DEFS, DISPLAY_SIGNAL_DEFS, SIGNAL_GROUPS, sortSignals } from './signalRegistry'
import { RUNTIME_SIGNAL_NAMES } from './runtimeSignals'

const ALL = SIGNAL_DEFS.map(s => s.name).concat(RUNTIME_SIGNAL_NAMES)

describe('SIGNAL_GROUPS', () => {
  it('nomeia cada sinal conhecido exatamente uma vez', () => {
    const named = SIGNAL_GROUPS.flat()
    expect(new Set(named).size).toBe(named.length)
    expect([...named].sort()).toEqual([...ALL].sort())
  })
})

describe('sortSignals', () => {
  it('põe os sinais parecidos lado a lado, qualquer que seja a ordem de entrada', () => {
    const sorted = sortSignals([...ALL].reverse())
    const at = (n: string) => sorted.indexOf(n)
    expect(at('VE Lambda')).toBe(at('VE') + 1)
    expect(at('VE Lambda Corrigido')).toBe(at('VE Lambda') + 1)
    expect(at('Inj. DT')).toBe(at('Inj. Pulse') + 1)
    expect(at('Inj. Efetivo')).toBe(at('Inj. DT') + 1)
    expect(at('Torque')).toBe(at('Potência') + 1)
  })

  it('segue a ordem dos grupos', () => {
    const sorted = sortSignals([...ALL])
    expect(sorted.slice(0, 4)).toEqual(['RPM', 'MAP', 'Boost', 'Turbo Target'])
    expect(sorted.slice(-2)).toEqual(['Potência', 'Torque'])
  })

  it('sinal ausente não deixa buraco nem desfaz o grupo', () => {
    const sorted = sortSignals(ALL.filter(n => n !== 'Inj. DT' && n !== 'Inj. Efetivo').reverse())
    expect(sorted.indexOf('Inj. Utiliz.')).toBe(sorted.indexOf('Inj. Pulse') + 1)
    expect(sorted).not.toContain('Inj. DT')
  })

  it('sinal desconhecido vai depois dos nomeados, mantendo a ordem relativa', () => {
    const sorted = sortSignals(['Zeta', 'Torque', 'Alfa', 'RPM'])
    expect(sorted).toEqual(['RPM', 'Torque', 'Zeta', 'Alfa'])
  })

  it('não altera o array de entrada', () => {
    const input = ['Torque', 'RPM']
    sortSignals(input)
    expect(input).toEqual(['Torque', 'RPM'])
  })
})

describe('DISPLAY_SIGNAL_DEFS', () => {
  it('está na ordem agrupada e inclui os sinais de runtime junto do seu grupo', () => {
    const names = DISPLAY_SIGNAL_DEFS.map(d => d.name)
    expect(names).toEqual(sortSignals(names))
    expect(names.indexOf('VE Lambda Corrigido')).toBe(names.indexOf('VE Lambda') + 1)
  })
})
