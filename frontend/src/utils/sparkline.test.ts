import { describe, it, expect } from 'vitest'
import { buildSparkline } from './sparkline'
import { findLastRow } from './findLastRow'
import type { DatalogRow } from '@/types/datalog'

function rows(values: (number | undefined)[], dt = 100): DatalogRow[] {
  return values.map((v, i) => {
    const r: DatalogRow = { timestamp_ms: i * dt }
    if (v !== undefined) r.X = v
    return r
  })
}

describe('buildSparkline', () => {
  it('mantém um pico de 1 amostra numa log longa', () => {
    const values = Array.from({ length: 10_000 }, (_, i) => (i === 5_000 ? 9999 : 10))
    const data = buildSparkline(rows(values), 'X', 10_000 * 100)
    expect(data.max).toBe(9999)
    expect(data.segments).toHaveLength(1)
    expect(Math.max(...data.segments[0].map(([, v]) => v))).toBe(9999)
  })

  it('gera menos pontos que a entrada em logs longas', () => {
    const values = Array.from({ length: 10_000 }, (_, i) => i % 7)
    const data = buildSparkline(rows(values), 'X', 10_000 * 100)
    expect(data.segments[0].length).toBeLessThanOrEqual(1600)
  })

  it('emite pontos em ordem temporal', () => {
    const values = Array.from({ length: 5_000 }, (_, i) => Math.sin(i / 3) * 100)
    const pts = buildSparkline(rows(values), 'X', 5_000 * 100).segments[0]
    for (let i = 1; i < pts.length; i++) expect(pts[i][0]).toBeGreaterThanOrEqual(pts[i - 1][0])
  })

  it('uma lacuna gera dois trechos, sem zero no meio', () => {
    const data = buildSparkline(rows([5, 6, undefined, undefined, 7, 8]), 'X', 600)
    expect(data.segments).toHaveLength(2)
    expect(data.min).toBe(5)
    expect(data.max).toBe(8)
    expect(data.segments.flat().every(([, v]) => v !== 0)).toBe(true)
  })

  it('NaN também é lacuna', () => {
    const r = rows([1, 2, 3])
    r[1].X = NaN
    expect(buildSparkline(r, 'X', 300).segments).toHaveLength(2)
  })

  it('sinal sem nenhum valor devolve vazio', () => {
    expect(buildSparkline(rows([undefined, undefined]), 'X', 200)).toEqual({ segments: [], min: 0, max: 0 })
  })

  it('total 0 devolve vazio', () => {
    expect(buildSparkline(rows([1, 2]), 'X', 0).segments).toEqual([])
  })
})

describe('findLastRow', () => {
  const r = rows([1, 2, 3, 4]) // t = 0,100,200,300
  it('acha a última linha <= t', () => {
    expect(findLastRow(r, 250)?.timestamp_ms).toBe(200)
    expect(findLastRow(r, 300)?.timestamp_ms).toBe(300)
    expect(findLastRow(r, 9999)?.timestamp_ms).toBe(300)
  })
  it('antes da primeira linha ou vazio devolve null', () => {
    expect(findLastRow(r, -1)).toBeNull()
    expect(findLastRow([], 10)).toBeNull()
  })
})
