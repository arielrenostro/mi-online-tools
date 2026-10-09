import { describe, it, expect } from 'vitest'
import { buildXYSeries, cursorPoints, hasXYPoints, bandCurve } from './xySeries'
import type { DatalogRow } from '@/types/datalog'

const row = (t: number, over: Record<string, number> = {}): DatalogRow => ({ timestamp_ms: t, RPM: 3000, MAP: 100, 'Lambda 1': 1, ...over })

describe('buildXYSeries', () => {
  const rows = [row(0, { RPM: 1000, MAP: 50 }), row(100, { RPM: 2000, MAP: 80 }), row(200, { RPM: 3000, MAP: 120 })]

  it('um ponto [X, Y] por linha, na ordem das linhas', () => {
    const [s] = buildXYSeries(rows, [true, true, true], null, 'RPM', ['MAP'], true)
    expect(s.signal).toBe('MAP')
    expect(s.pass).toEqual([[1000, 50], [2000, 80], [3000, 120]])
    expect(s.fail).toEqual([])
  })

  it('uma série por Y, na ordem pedida', () => {
    const out = buildXYSeries(rows, [true, true, true], null, 'RPM', ['Lambda 1', 'MAP'], true)
    expect(out.map(s => s.signal)).toEqual(['Lambda 1', 'MAP'])
    expect(out[0].pass).toEqual([[1000, 1], [2000, 1], [3000, 1]])
  })

  it('linhas que falham no filtro vão para `fail` quando "mostrar filtrados"', () => {
    const [s] = buildXYSeries(rows, [true, false, true], null, 'RPM', ['MAP'], true)
    expect(s.pass).toEqual([[1000, 50], [3000, 120]])
    expect(s.fail).toEqual([[2000, 80]])
  })

  it('com "ocultar", `fail` fica vazio e os reprovados somem', () => {
    const [s] = buildXYSeries(rows, [true, false, true], null, 'RPM', ['MAP'], false)
    expect(s.pass).toEqual([[1000, 50], [3000, 120]])
    expect(s.fail).toEqual([])
  })

  it('seleção de tempo recorta (limites inclusivos)', () => {
    const [s] = buildXYSeries(rows, [true, true, true], { start_ms: 100, end_ms: 200 }, 'RPM', ['MAP'], true)
    expect(s.pass).toEqual([[2000, 80], [3000, 120]])
  })

  it('sem X numérico a linha sai de todas as séries', () => {
    const r = [row(0, { RPM: NaN }), row(100)]
    const out = buildXYSeries(r, [true, true], null, 'RPM', ['MAP', 'Lambda 1'], true)
    expect(out.map(s => s.pass.length)).toEqual([1, 1])
  })

  it('sem aquele Y a linha sai só dessa série, não das outras', () => {
    const r = [row(0, { MAP: NaN }), row(100)]
    const [map, lam] = buildXYSeries(r, [true, true], null, 'RPM', ['MAP', 'Lambda 1'], true)
    expect(map.pass).toHaveLength(1)
    expect(lam.pass).toHaveLength(2)
  })

  it('sinal que um log não tem (chave ausente) só esvazia a própria série', () => {
    const r = [row(0, { Marcha: 3 }), row(100) /* outro log, sem Marcha */, row(200, { Marcha: 4 })]
    const [marcha, map] = buildXYSeries(r, [true, true, true], null, 'RPM', ['Marcha', 'MAP'], true)
    expect(marcha.pass.map(p => p[1])).toEqual([3, 4])
    expect(map.pass).toHaveLength(3)
  })

  it('máscara mais curta que as linhas não quebra: linha sem máscara passa', () => {
    const [s] = buildXYSeries(rows, [false], null, 'RPM', ['MAP'], true)
    expect(s.fail).toEqual([[1000, 50]])
    expect(s.pass).toEqual([[2000, 80], [3000, 120]])
  })

  it('o mesmo sinal em X e Y vira a diagonal', () => {
    const [s] = buildXYSeries(rows, [true, true, true], null, 'MAP', ['MAP'], true)
    expect(s.pass.every(([x, y]) => x === y)).toBe(true)
  })

  it('sem linhas, séries vazias', () => {
    const out = buildXYSeries([], [], null, 'RPM', ['MAP'], true)
    expect(out).toEqual([{ signal: 'MAP', pass: [], fail: [] }])
    expect(hasXYPoints(out)).toBe(false)
  })
})

describe('hasXYPoints', () => {
  it('verdadeiro se qualquer série tem ponto, passando ou não', () => {
    expect(hasXYPoints([{ signal: 'a', pass: [], fail: [[1, 1]] }])).toBe(true)
    expect(hasXYPoints([{ signal: 'a', pass: [], fail: [] }, { signal: 'b', pass: [[1, 1]], fail: [] }])).toBe(true)
  })
})

describe('cursorPoints', () => {
  const rows = [row(0, { RPM: 1000, MAP: 50 }), row(100, { RPM: 2000, MAP: 80 }), row(200, { RPM: 3000, MAP: NaN })]

  it('usa a última linha com timestamp <= cursor', () => {
    expect(cursorPoints(rows, 150, 'RPM', ['MAP'])).toEqual([[2000, 80]])
    expect(cursorPoints(rows, 100, 'RPM', ['MAP'])).toEqual([[2000, 80]])
  })

  it('sem cursor ou antes da primeira linha, tudo null', () => {
    expect(cursorPoints(rows, null, 'RPM', ['MAP'])).toEqual([null])
    expect(cursorPoints(rows, -1, 'RPM', ['MAP'])).toEqual([null])
  })

  it('null só para o Y sem valor na linha do cursor', () => {
    expect(cursorPoints(rows, 250, 'RPM', ['MAP', 'Lambda 1'])).toEqual([null, [3000, 1]])
  })

  it('X sem valor deixa todos null', () => {
    const r = [row(0, { RPM: NaN })]
    expect(cursorPoints(r, 10, 'RPM', ['MAP', 'Lambda 1'])).toEqual([null, null])
  })
})

describe('bandCurve: faixas, mínimo de 3 e prolongamento até as pontas', () => {
  // faixas de 100 sobre [0, 1000] (10 faixas), mínimo de 3 pontos por faixa
  const run = (pts: [number, number][], stat: 'mean' | 'max' | 'min' = 'mean', minSamples = 3) =>
    bandCurve(pts, 0, 1000, stat, 10, minSamples)

  it('um ponto por faixa (média de X e de Y), prolongado até o menor e o maior X dos pontos', () => {
    // faixas 100–200 e 500–600: pontos em X médio 120 e 520; a linha ainda alcança 110 e 530
    expect(run([[110, 10], [120, 20], [130, 30], [510, 100], [520, 200], [530, 300]]))
      .toEqual([[110, 20], [120, 20], [520, 200], [530, 200]])
  })

  it('max e min: o maior e o menor Y da faixa', () => {
    const pts: [number, number][] = [[110, 5], [120, 9], [130, 1], [510, 40], [520, 20], [530, 30]]
    expect(run(pts, 'max')).toEqual([[110, 9], [120, 9], [520, 40], [530, 40]])
    expect(run(pts, 'min')).toEqual([[110, 1], [120, 1], [520, 20], [530, 20]])
  })

  it('saída em ordem crescente de X, mesmo com entrada desordenada', () => {
    const out = run([[910, 1], [920, 1], [930, 1], [110, 2], [120, 2], [130, 2]])
    expect(out.map(p => p[0])).toEqual([110, 120, 920, 930])
  })

  it('faixa com menos de 3 pontos não gera ponto próprio, mas as outras geram', () => {
    expect(run([[110, 10], [120, 20], [510, 1], [520, 2], [530, 3]]).map(p => p[1])).toContain(2)
  })

  it('prolonga a linha até o menor e o maior X dos pontos, no nível do primeiro e do último ponto', () => {
    // 20 e 950 estão em faixas ralas (1 ponto) e não geram ponto; a linha ainda os alcança
    const out = run([[20, 40], [110, 1], [120, 2], [130, 3], [510, 10], [520, 20], [530, 30], [950, 90]])
    expect(out).toEqual([[20, 2], [120, 2], [520, 20], [950, 20]])
  })

  it('sem prolongamento quando a primeira e a última faixa já chegam nas pontas', () => {
    const out = run([[100, 1], [100, 2], [100, 3], [900, 7], [900, 8], [900, 9]])
    expect(out).toEqual([[100, 2], [900, 8]])
  })

  it('max e min também são prolongados, com o valor da primeira/última faixa', () => {
    const pts: [number, number][] = [[20, 99], [110, 1], [120, 2], [130, 3], [950, -99]]
    expect(run(pts, 'max')).toEqual([[20, 3], [120, 3], [950, 3]])
    expect(run(pts, 'min')).toEqual([[20, 1], [120, 1], [950, 1]])
  })

  it('só uma faixa válida: linha horizontal cobrindo de ponta a ponta', () => {
    expect(run([[15, 1], [110, 4], [120, 4], [130, 4], [980, 1]])).toEqual([[15, 4], [120, 4], [980, 4]])
  })

  it('nenhuma faixa com o mínimo de pontos: sem linha (e sem prolongar nada)', () => {
    expect(run([[110, 1], [510, 2], [910, 3]])).toEqual([])
    expect(run([])).toEqual([])
  })

  it('o mínimo de pontos é configurável', () => {
    expect(run([[110, 10], [120, 20]], 'mean', 2)).toEqual([[110, 15], [115, 15], [120, 15]])
  })

  it('faixa de X inválida, vazio', () => {
    expect(bandCurve([[1, 1], [2, 2], [3, 3]], 5, 5, 'mean', 10, 1)).toEqual([])
    expect(bandCurve([[1, 1]], 10, 0, 'mean', 10, 1)).toEqual([])
  })

  it('só `pass` conta: um pico reprovado não vira máximo nem estica a linha', () => {
    const rows = [100, 110, 120, 130].map((rpm, i) => row(i * 100, { RPM: rpm, MAP: [50, 60, 70, 900][i] }))
    const [s] = buildXYSeries(rows, [true, true, true, false], null, 'RPM', ['MAP'], true)
    // 130 (reprovado) não estica a linha: ela termina em 120, o maior X que passa
    expect(bandCurve(s.pass, 0, 1000, 'max', 10, 3)).toEqual([[100, 70], [110, 70], [120, 70]])
  })

  it('respeita a seleção de tempo', () => {
    const rows = [100, 110, 120, 130].map((rpm, i) => row(i * 100, { RPM: rpm, MAP: [900, 60, 70, 80][i] }))
    const [s] = buildXYSeries(rows, [true, true, true, true], { start_ms: 100, end_ms: 300 }, 'RPM', ['MAP'], true)
    expect(bandCurve(s.pass, 0, 1000, 'mean', 10, 3)).toEqual([[110, 70], [120, 70], [130, 70]])
  })

  it('padrão: 70 faixas e mínimo de 3', () => {
    // RPM em [0, 7000]: faixas de 100; 1990 e 2010 ficam em faixas diferentes, 3 pontos em cada
    const pts: [number, number][] = [[1990, 1], [1991, 1], [1992, 1], [2010, 3], [2011, 3], [2012, 3]]
    const out = bandCurve(pts, 0, 7000, 'mean')
    expect(out).toContainEqual([1991, 1])
    expect(out).toContainEqual([2011, 3])
  })
})
