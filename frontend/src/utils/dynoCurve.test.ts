import { describe, it, expect } from 'vitest'
import { buildRawCurve, buildSmoothedCurve, applyLoss } from './dynoCurve'
import type { DatalogRow } from '@/types/datalog'

const r = (rpm: number, power: number, torque = power / 10): DatalogRow =>
  ({ timestamp_ms: 0, 'RPM': rpm, 'Potência': power, 'Torque': torque })

/** Tendência linear: potência = rpm / 40 (cv), 3 amostras por faixa de 100 rpm entre 3000 e 6000. */
function trend(): DatalogRow[] {
  const rows: DatalogRow[] = []
  for (let rpm = 3000; rpm < 6000; rpm += 100) {
    for (const off of [10, 50, 90]) rows.push(r(rpm + off, (rpm + off) / 40))
  }
  return rows
}

describe('buildRawCurve', () => {
  it('ordena por RPM e descarta linhas sem potência/torque', () => {
    const curve = buildRawCurve([r(4000, 100), r(3000, 80), r(3500, NaN), r(5000, 120)])
    expect(curve.map(p => p.rpm)).toEqual([3000, 4000, 5000])
  })
})

describe('buildSmoothedCurve', () => {
  it('gera um ponto por faixa com amostra e nenhum para faixa vazia', () => {
    const rows = [r(3010, 80), r(3050, 82), r(3510, 90)] // faixas 30 e 35 — 31..34 vazias
    const curve = buildSmoothedCurve(rows, 100)
    expect(curve).toHaveLength(2)
    expect(curve[0].rpm).toBeCloseTo(3030, 6)
    expect(curve[1].rpm).toBe(3510)
  })

  it('segue a tendência de dados limpos', () => {
    const curve = buildSmoothedCurve(trend(), 100)
    expect(curve).toHaveLength(30)
    for (const p of curve.slice(1, -1)) expect(p.power).toBeCloseTo(p.rpm / 40, 0)
  })

  it('spike numa faixa de 1 amostra não vira pico', () => {
    const rows = trend().filter(row => Math.floor(row.RPM / 100) !== 45) // remove a faixa 45
    rows.push(r(4550, 1000))                                             // spike sozinho na faixa
    const curve = buildSmoothedCurve(rows, 100)
    const max = Math.max(...curve.map(p => p.power))
    expect(max).toBeLessThan(150 * 1.05) // tendência chega a ~150 cv em 6000 rpm
  })

  it('spike numa faixa com 2 amostras e na ponta também são removidos', () => {
    const rows = trend().filter(row => Math.floor(row.RPM / 100) !== 40)
    rows.push(r(4010, 900), r(4060, 101.5)) // média das duas ≠ mediana robusta; mediana móvel entre faixas corta
    rows.push(r(3020, 900))                 // spike extra na primeira faixa
    const curve = buildSmoothedCurve(rows.filter(x => !(Math.floor(x.RPM / 100) === 30 && x.Potência < 900)), 100)
    expect(Math.max(...curve.map(p => p.power))).toBeLessThan(150 * 1.05)
  })

  it('mudar a largura de faixa reconstrói o suavizado', () => {
    const rows = trend()
    expect(buildSmoothedCurve(rows, 100)).toHaveLength(30)
    expect(buildSmoothedCurve(rows, 300)).toHaveLength(10)
  })

  it('largura inválida não gera curva', () => {
    expect(buildSmoothedCurve(trend(), 0)).toEqual([])
  })
})

describe('applyLoss', () => {
  it('perda 15% → 85% de potência e torque, RPM intacto', () => {
    const [p] = applyLoss([{ rpm: 5000, power: 100, torque: 14 }], 15)
    expect(p.rpm).toBe(5000)
    expect(p.power).toBeCloseTo(85, 9)
    expect(p.torque).toBeCloseTo(11.9, 9)
  })

  it('perda 0 não muda nada', () => {
    const pts = [{ rpm: 5000, power: 100, torque: 14 }]
    expect(applyLoss(pts, 0)).toEqual(pts)
  })
})
