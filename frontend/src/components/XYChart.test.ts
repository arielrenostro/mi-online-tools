import { describe, it, expect } from 'vitest'
import { buildXYOption, cursorUpdate } from './XYChart'
import { sigColor, dimColor, meanLineColor, MEAN_LINE_COLOR, MEAN_LINE_COLOR_DARK, ENVELOPE_LINE_COLOR, PALETTE } from '@/utils/signalColor'
import type { XYSeriesData } from '@/utils/xySeries'

const S = (signal: string, pass: [number, number][], fail: [number, number][] = []): XYSeriesData => ({ signal, pass, fail })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const opt = (series: XYSeriesData[], x = 'RPM', showMean = false, showMax = false, showMin = false) =>
  buildXYOption(series, x, { mean: showMean, max: showMax, min: showMin }) as any

describe('buildXYOption', () => {
  it('um eixo Y por sinal, com a faixa padrão do sinal e o nome com unidade', () => {
    const o = opt([S('MAP', [[1000, 50]]), S('Lambda 1', [[1000, 1]])])
    expect(o.yAxis).toHaveLength(2)
    expect(o.yAxis[0]).toMatchObject({ min: 0, max: 200, name: 'MAP (kPa)' })
    expect(o.yAxis[1]).toMatchObject({ min: 0.7, max: 1.3, name: 'Lambda 1 (λ)' })
    expect(o.xAxis).toMatchObject({ min: 0, max: 7000, name: 'RPM' })
  })

  it('eixos alternam esquerda/direita e não se sobrepõem', () => {
    const o = opt(['MAP', 'Lambda 1', 'Pedal', 'CLT'].map(s => S(s, [[1, 1]])))
    expect(o.yAxis.map((a: { position: string }) => a.position)).toEqual(['left', 'right', 'left', 'right'])
    expect(o.yAxis.map((a: { offset: number }) => a.offset)).toEqual([0, 0, 60, 60])
  })

  it('a margem do grid cresce com os eixos de cada lado', () => {
    expect(opt([S('MAP', [[1, 1]])]).grid).toMatchObject({ left: 64, right: 20 })
    expect(opt(['MAP', 'Pedal', 'CLT'].map(s => S(s, [[1, 1]]))).grid).toMatchObject({ left: 124, right: 64 })
  })

  it('cor do eixo = cor da série (a mesma do chip, via sigColor)', () => {
    const o = opt([S('MAP', [[1, 1]]), S('Pedal', [[1, 1]])])
    o.yAxis.forEach((a: { axisLine: { lineStyle: { color: string } } }, i: number) => {
      expect(a.axisLine.lineStyle.color).toBe(sigColor('', i))
    })
    const pass = o.series.filter((s: { id: string }) => s.id.endsWith('-pass'))
    expect(pass.map((s: { itemStyle: { color: string } }) => s.itemStyle.color)).toEqual([sigColor('', 0), sigColor('', 1)])
  })

  it('série "passa" na cor cheia e "falha" esmaecida, por baixo; ambas no eixo do sinal', () => {
    const o = opt([S('MAP', [[1, 1]], [[2, 2]])])
    const pass = o.series.find((s: { id: string }) => s.id === 'y-0-pass')
    const fail = o.series.find((s: { id: string }) => s.id === 'y-0-fail')
    expect(pass.itemStyle.color).toBe(sigColor('MAP', 0))
    expect(fail.itemStyle.color).toBe(dimColor(sigColor('MAP', 0)))
    expect(fail.z).toBeLessThan(pass.z)
    expect([pass.yAxisIndex, fail.yAxisIndex]).toEqual([0, 0])
    expect(pass.type).toBe('scatter')
  })

  it('sem pontos reprovados ("ocultar") não cria série `fail`', () => {
    const ids = opt([S('MAP', [[1, 1]]), S('Pedal', [[1, 1]])]).series.map((s: { id: string }) => s.id)
    expect(ids.some((id: string) => id.endsWith('-fail'))).toBe(false)
  })

  it('usa o modo large e não amostra: todos os pontos entram na série', () => {
    const pts: [number, number][] = Array.from({ length: 50_000 }, (_, i) => [i % 7000, 20 + (i % 230)])
    const o = opt([S('MAP', pts)])
    const pass = o.series.find((s: { id: string }) => s.id === 'y-0-pass')
    expect(pass.large).toBe(true)
    expect(pass.data).toHaveLength(50_000)
  })

  it('um marcador de cursor (vazio) por sinal Y, com id estável', () => {
    const cursor = opt([S('MAP', [[1, 1]]), S('Pedal', [[1, 1]])]).series.filter((s: { id: string }) => s.id.startsWith('cursor-'))
    expect(cursor.map((s: { id: string }) => s.id)).toEqual(['cursor-0', 'cursor-1'])
    expect(cursor.every((s: { data: unknown[] }) => s.data.length === 0)).toBe(true)
  })

  it('tooltip mostra nome, valor com unidade e o X; marca o ponto fora do filtro', () => {
    const o = opt([S('MAP', [[1000, 120]], [[2000, 80]])])
    const f = o.tooltip.formatter
    const pass = f({ seriesName: 'MAP', seriesId: 'y-0-pass', value: [1000, 120], color: '#60a5fa' })
    expect(pass).toContain('MAP')
    expect(pass).toContain('120 kPa')
    expect(pass).toContain('RPM: 1000')
    expect(pass).not.toContain('fora do filtro')
    expect(f({ seriesName: 'MAP', seriesId: 'y-0-fail', value: [2000, 80], color: '#000' })).toContain('fora do filtro')
  })
})

// uma coluna de pontos: vários Y no mesmo valor de X
const col = (x: number, ys: number[]): [number, number][] => ys.map(y => [x, y])

describe('linha média', () => {
  // coluna RPM 1000: [40, 50, 60]; coluna RPM 2000: [100, 110, 120]; 900 só em `fail` (nunca entra)
  const map = S('MAP', [...col(1000, [40, 50, 60]), ...col(2000, [100, 110, 120])], col(1000, [900, 900, 900]))
  const lam = S('Lambda 1', [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meanOf = (o: any) => o.series.filter((s: { id: string }) => s.id.startsWith('mean-'))

  it('desligada: nenhuma série de média', () => {
    expect(meanOf(opt([map, lam]))).toHaveLength(0)
  })

  it('ligada: uma série `line` por Y com curva, no eixo do sinal, acima dos pontos', () => {
    const [m] = meanOf(opt([map, lam], 'RPM', true))
    expect(m).toMatchObject({ id: 'mean-0', type: 'line', yAxisIndex: 0, name: 'MAP' })
    expect(m.z).toBeGreaterThan(2)
  })

  it('linha tracejada e vermelha; os marcadores levam a cor do sinal', () => {
    const o = opt([map], 'RPM', true)
    const [m] = meanOf(o)
    const base = sigColor('MAP', 0)
    expect(m.lineStyle.type).toBe('dashed')
    expect(m.lineStyle.color).toBe(MEAN_LINE_COLOR)
    expect(m.itemStyle.color).toBe(base)
    const pass = o.series.find((s: { id: string }) => s.id === 'y-0-pass')
    expect(pass.itemStyle.color).toBe(base) // a nuvem continua na cor cheia
  })

  it('com vários Y todas as linhas são vermelhas, distinguidas pelos marcadores', () => {
    const ms = meanOf(opt([S('MAP', col(1000, [1, 2, 3])), S('Pedal', col(1000, [1, 2, 3]))], 'RPM', true))
    expect(ms.map((m: { lineStyle: { color: string } }) => m.lineStyle.color)).toEqual([MEAN_LINE_COLOR, MEAN_LINE_COLOR])
    expect(ms.map((m: { itemStyle: { color: string } }) => m.itemStyle.color)).toEqual([sigColor('MAP', 0), sigColor('Pedal', 1)])
  })

  it('série que já é vermelha (5ª cor) usa o vermelho escuro para não sumir na nuvem', () => {
    expect(meanLineColor(PALETTE[4])).toBe(MEAN_LINE_COLOR_DARK)
    expect(meanLineColor(PALETTE[0])).toBe(MEAN_LINE_COLOR)
    const five = ['MAP', 'Pedal', 'CLT', 'IAT', 'Boost'].map(n => S(n, col(1000, [1, 2, 3])))
    const ms = meanOf(opt(five, 'RPM', true))
    expect(ms[4].lineStyle.color).toBe(MEAN_LINE_COLOR_DARK)
    expect(ms[0].lineStyle.color).toBe(MEAN_LINE_COLOR)
  })

  it('um ponto por faixa de X, no X médio da faixa, com a média do Y dela', () => {
    const [m] = meanOf(opt([map], 'RPM', true))
    expect(m.data).toEqual([[1000, 50], [2000, 110]])
  })

  it('a linha cobre toda a extensão horizontal dos pontos, inclusive as pontas ralas', () => {
    // 20 e 250 estão em faixas com 1 ponto: sem ponto próprio, mas a linha é prolongada até eles
    const [m] = meanOf(opt([S('MAP', [[20, 40], ...col(100, [1, 2, 3]), [250, 90]])], 'RPM', true))
    expect(m.data).toEqual([[20, 2], [100, 2], [250, 2]])
  })

  it('pontos reprovados não entram na média nem esticam a linha', () => {
    const [m] = meanOf(opt([map], 'RPM', true))
    expect(m.data[0]).toEqual([1000, 50])
  })

  it('Y sem nenhum ponto que passa não tem curva; os outros mantêm a sua', () => {
    const ids = meanOf(opt([map, S('Pedal', [], [[1, 1]])], 'RPM', true)).map((s: { id: string }) => s.id)
    expect(ids).toEqual(['mean-0'])
  })

  it('tooltip da curva mostra "média de", valor com unidade e o X do ponto', () => {
    const f = opt([map], 'RPM', true).tooltip.formatter
    const t = f({ seriesName: 'MAP', seriesId: 'mean-0', value: [1000, 50], color: '#60a5fa' })
    expect(t).toContain('média de')
    expect(t).toContain('50 kPa')
    expect(t).toContain('RPM: 1000')
  })

  it('o cursor segue por cima da curva', () => {
    const o = opt([map], 'RPM', true)
    const cursor = o.series.find((s: { id: string }) => s.id === 'cursor-0')
    expect(cursor.z).toBeGreaterThan(meanOf(o)[0].z)
  })
})

describe('linha máxima e mínima', () => {
  const map = S('MAP', [...col(1000, [40, 50, 60]), ...col(2000, [100, 110, 120])], col(1000, [900, 900, 900]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ids = (o: any) => o.series.map((s: { id: string }) => s.id).filter((id: string) => /^(mean|max|min)-/.test(id))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const get = (o: any, id: string) => o.series.find((s: { id: string }) => s.id === id)

  it('desligadas: nenhuma série de máximo/mínimo', () => {
    expect(ids(opt([map], 'RPM', true))).toEqual(['mean-0'])
  })

  it('cada checkbox liga só a sua linha, sem mexer nas outras', () => {
    expect(ids(opt([map], 'RPM', false, true, false))).toEqual(['max-0'])
    expect(ids(opt([map], 'RPM', false, false, true))).toEqual(['min-0'])
    expect(ids(opt([map], 'RPM', true, true, true)).sort()).toEqual(['max-0', 'mean-0', 'min-0'])
  })

  it('máximo e mínimo por faixa: maior/menor Y, só dos que passam', () => {
    const o = opt([map], 'RPM', true, true, true)
    expect(get(o, 'max-0').data).toEqual([[1000, 60], [2000, 120]])
    expect(get(o, 'min-0').data).toEqual([[1000, 40], [2000, 100]])
  })

  it('em cada faixa: máxima ≥ média ≥ mínima', () => {
    const o = opt([map], 'RPM', true, true, true)
    const [mx, me, mn] = ['max-0', 'mean-0', 'min-0'].map(id => get(o, id).data as number[][])
    mx.forEach((p, i) => { expect(p[1]).toBeGreaterThanOrEqual(me[i][1]); expect(me[i][1]).toBeGreaterThanOrEqual(mn[i][1]) })
  })

  it('pontilhadas em cinza-claro, abaixo da média e acima da nuvem; marcadores na cor do sinal', () => {
    const o = opt([map], 'RPM', true, true, true)
    const mx = get(o, 'max-0')
    expect(mx.lineStyle).toMatchObject({ type: 'dotted', color: ENVELOPE_LINE_COLOR })
    expect(mx.itemStyle.color).toBe(sigColor('MAP', 0))
    expect(mx.z).toBeGreaterThan(get(o, 'y-0-pass').z)
    expect(mx.z).toBeLessThan(get(o, 'mean-0').z)
    expect(get(o, 'min-0').lineStyle.color).toBe(ENVELOPE_LINE_COLOR)
  })

  it('Y sem ponto que passa não tem linhas; os outros mantêm as suas', () => {
    expect(ids(opt([map, S('Pedal', [], [[1, 1]])], 'RPM', false, true, true)).sort()).toEqual(['max-0', 'min-0'])
  })

  it('tooltip diz "máximo de"/"mínimo de", com valor e unidade e o X do ponto', () => {
    const f = opt([map], 'RPM', false, true, true).tooltip.formatter
    const mx = f({ seriesName: 'MAP', seriesId: 'max-0', value: [1000, 60], color: '#60a5fa' })
    expect(mx).toContain('máximo de')
    expect(mx).toContain('60 kPa')
    expect(mx).toContain('RPM: 1000')
    expect(f({ seriesName: 'MAP', seriesId: 'min-0', value: [1000, 40], color: '#60a5fa' })).toContain('mínimo de')
  })

  it('máximo e mínimo também cobrem a extensão horizontal, como a média', () => {
    const o = opt([S('MAP', [[20, 40], ...col(100, [1, 2, 3]), [250, 90]])], 'RPM', true, true, true)
    for (const id of ['mean-0', 'max-0', 'min-0']) {
      const xs = get(o, id).data.map((p: number[]) => p[0])
      expect([xs[0], xs[xs.length - 1]]).toEqual([20, 250])
    }
  })

  it('cada Y tem as suas linhas, no próprio eixo', () => {
    const o = opt([S('MAP', col(1000, [1, 2, 3])), S('Pedal', col(1000, [1, 2, 3]))], 'RPM', false, true, false)
    expect(get(o, 'max-0').yAxisIndex).toBe(0)
    expect(get(o, 'max-1').yAxisIndex).toBe(1)
  })
})

describe('faixa configurada', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const build = (series: XYSeriesData[], ranges?: any, curves = { mean: false, max: false, min: false }) =>
    buildXYOption(series, 'RPM', curves, ranges) as any

  it('sem sobrescrita os eixos X e Y usam a faixa padrão', () => {
    const o = build([S('MAP', [[1000, 50]])])
    expect(o.xAxis).toMatchObject({ min: 0, max: 7000 })
    expect(o.yAxis[0]).toMatchObject({ min: 0, max: 200 })
  })

  it('a sobrescrita vale para o eixo X e para o eixo Y daquele sinal, só dele', () => {
    const o = build([S('MAP', [[1000, 50]]), S('Lambda 1', [[1000, 1]])], { RPM: { min: 800, max: 6000 }, MAP: { min: 0, max: 400 } })
    expect(o.xAxis).toMatchObject({ min: 800, max: 6000 })
    expect(o.yAxis[0]).toMatchObject({ min: 0, max: 400 })
    expect(o.yAxis[1]).toMatchObject({ min: 0.7, max: 1.3 })
  })

  it('as curvas por faixa de X usam o intervalo configurado do eixo X', () => {
    const pts: [number, number][] = [[1000, 40], [1001, 50], [1002, 60]]
    const meanData = (o: any) => o.series.find((s: { id: string }) => s.id === 'mean-0')?.data
    const all = { mean: true, max: false, min: false }
    // padrão (0–7000, faixas de 100): os três caem na mesma faixa → há curva (prolongada até as pontas)
    expect(meanData(build([S('MAP', pts)], undefined, all))).toEqual([[1000, 50], [1001, 50], [1002, 50]])
    // 0–7 (faixas de 0,1): cada ponto numa faixa → nenhuma tem as 3 amostras mínimas → sem curva
    expect(meanData(build([S('MAP', pts)], { RPM: { min: 0, max: 7 } }, all))).toBeUndefined()
  })

  it('não altera os dados das séries', () => {
    const a = build([S('MAP', [[1000, 50]])])
    const b = build([S('MAP', [[1000, 50]])], { MAP: { min: 0, max: 400 } })
    expect(b.series).toEqual(a.series)
  })
})

describe('cursorUpdate', () => {
  it('um ponto por sinal com valor, vazio quando null', () => {
    expect(cursorUpdate([[1000, 50], null])).toEqual({
      series: [{ id: 'cursor-0', data: [[1000, 50]] }, { id: 'cursor-1', data: [] }],
    })
  })
})
