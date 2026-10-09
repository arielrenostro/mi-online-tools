import { describe, it, expect } from 'vitest'
import { undoTargetForPath } from './undoTarget'

describe('undoTargetForPath', () => {
  it('uma tabela por aba', () => {
    expect(undoTargetForPath('/mapa/ve')).toBe('ve')
    expect(undoTargetForPath('/mapa/ignition')).toBe('ignition')
    expect(undoTargetForPath('/mapa/lambda')).toBe('lambda')
  })

  it('ignora barra final', () => {
    expect(undoTargetForPath('/mapa/lambda/')).toBe('lambda')
  })

  it('abas sem tabela editável não têm alvo', () => {
    expect(undoTargetForPath('/mapa/arquivo')).toBeNull()
    expect(undoTargetForPath('/mapa')).toBeNull()
    expect(undoTargetForPath('/')).toBeNull()
  })
})
