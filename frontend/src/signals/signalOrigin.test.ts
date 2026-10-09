import { describe, it, expect } from 'vitest'
import { signalOriginHint, CONSTANTS_ORIGIN_HINT } from './signalOrigin'
import { SIGNAL_DEFS } from './signalRegistry'

describe('signalOriginHint', () => {
  it('explains the origin of the three signals that depend on the constants', () => {
    for (const name of ['VE Lambda Corrigido', 'Potência', 'Torque']) {
      expect(signalOriginHint(name)).toBe(CONSTANTS_ORIGIN_HINT)
    }
    expect(CONSTANTS_ORIGIN_HINT).toMatch(/Configurações/)
  })

  it('has no hint for signals read from the CSV or derived without constants', () => {
    for (const name of ['RPM', 'MAP', 'Lambda 1', 'VE Lambda', 'Inj. Efetivo']) {
      expect(signalOriginHint(name)).toBeUndefined()
    }
    for (const def of SIGNAL_DEFS) expect(signalOriginHint(def.name)).toBeUndefined()
  })
})
