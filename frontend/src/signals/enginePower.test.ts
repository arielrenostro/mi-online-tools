import { describe, it, expect } from 'vitest'
import { computeEnginePower, DEFAULT_ENGINE_CONSTANTS } from './enginePower'

// Linha 2 da aba "Log" de `65lbs - 23.xlsx`: MAP 35, RPM 2567, IAT 323 K, λ 0,998,
// VE Lambda 59,225% e k = 1,18985849 (Config!B2 do arquivo externo) → AN2 = 9,9765 hp e AM2 = 2,7835.
// O app converte hp → cv (× 745,7 / 735,5), então 9,9765 hp = 10,1149 cv e o torque sobe igual.
const K_SHEET = 1.1898584905660377
const HP_TO_CV = 745.7 / 735.5

describe('computeEnginePower', () => {
  it('reproduz a linha de referência da planilha', () => {
    const { power, torque } = computeEnginePower(
      { map: 35, rpm: 2567, iatC: 50, lambda1: 0.998, veFraction: (59.225 * K_SHEET) / 100 },
      DEFAULT_ENGINE_CONSTANTS,
    )
    expect(power).toBeCloseTo(9.9765 * HP_TO_CV, 3)
    expect(torque).toBeCloseTo(2.7835 * HP_TO_CV, 3)
    expect(torque).toBeCloseTo((power * 716.2) / 2567, 6)
  })

  it('torque é 0 com RPM 0, sem erro', () => {
    const { power, torque } = computeEnginePower(
      { map: 35, rpm: 0, iatC: 50, lambda1: 1, veFraction: 0.6 },
      DEFAULT_ENGINE_CONSTANTS,
    )
    expect(power).toBe(0)
    expect(torque).toBe(0)
  })

  it('λ ≤ 0 não tem valor (NaN)', () => {
    for (const lambda1 of [0, -0.5]) {
      const { power, torque } = computeEnginePower(
        { map: 35, rpm: 3000, iatC: 50, lambda1, veFraction: 0.6 },
        DEFAULT_ENGINE_CONSTANTS,
      )
      expect(power).toBeNaN()
      expect(torque).toBeNaN()
    }
  })

  it('escala linearmente com a cilindrada e inversamente com o BSFC', () => {
    const input = { map: 100, rpm: 4800, iatC: 40, lambda1: 0.85, veFraction: 1 }
    const base = computeEnginePower(input, DEFAULT_ENGINE_CONSTANTS).power
    expect(computeEnginePower(input, { ...DEFAULT_ENGINE_CONSTANTS, displacementCc: 3174 }).power).toBeCloseTo(base * 2, 6)
    expect(computeEnginePower(input, { ...DEFAULT_ENGINE_CONSTANTS, bsfc: 1.6 }).power).toBeCloseTo(base / 2, 6)
  })
})
