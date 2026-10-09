import { describe, it, expect } from 'vitest'
import { countEditedCells, summarizeMap } from './mapInfo'
import type { MapModel } from '@/types/map'

function makeMap(rpm = [1000, 2000, 3000], map = [40, 20]): MapModel {
  const grid = (v: number) => map.map(() => rpm.map(() => v))
  return {
    name: 'a.csv', rawLines: [], rpmBreakpoints: rpm, mapBreakpoints: map,
    cells: grid(100), ignitionCells: grid(10), lambdaCells: grid(1000),
  }
}

const clone = (g: number[][]) => g.map(r => [...r])

describe('countEditedCells', () => {
  it('é 0 para tabelas iguais', () => {
    const m = makeMap()
    expect(countEditedCells(clone(m.cells), m.cells)).toBe(0)
  })

  it('conta cada célula diferente', () => {
    const m = makeMap()
    const e = clone(m.cells)
    e[0][0] = 150; e[1][2] = 90
    expect(countEditedCells(e, m.cells)).toBe(2)
  })

  it('voltar ao valor original deixa de contar', () => {
    const m = makeMap()
    const e = clone(m.cells)
    e[0][1] = 999
    e[0][1] = 100
    expect(countEditedCells(e, m.cells)).toBe(0)
  })
})

describe('summarizeMap', () => {
  it('mapa sem edições: tudo zero, grade e faixas do arquivo', () => {
    const m = makeMap()
    const info = summarizeMap(m, clone(m.cells), clone(m.ignitionCells), clone(m.lambdaCells))
    expect(info).toMatchObject({
      name: 'a.csv', rpmCount: 3, mapCount: 2,
      rpmMin: 1000, rpmMax: 3000, mapMin: 20, mapMax: 40,
      editedVe: 0, editedIgnition: 0, editedLambda: 0,
    })
  })

  it('conta edições por tabela (7 VE, 2 ignição)', () => {
    const rpm = [1000, 2000, 3000, 4000]
    const m = makeMap(rpm, [60, 40, 20])
    const ve = clone(m.cells)
    for (let i = 0; i < 7; i++) ve[Math.floor(i / 4)][i % 4] += 5
    const ign = clone(m.ignitionCells)
    ign[2][0] = 1; ign[2][3] = 2
    const info = summarizeMap(m, ve, ign, clone(m.lambdaCells))
    expect([info.editedVe, info.editedIgnition, info.editedLambda]).toEqual([7, 2, 0])
  })

  it('faixas não dependem da ordem dos breakpoints', () => {
    const m = makeMap([3000, 1000, 2000], [20, 60, 40])
    const info = summarizeMap(m, m.cells, m.ignitionCells, m.lambdaCells)
    expect([info.rpmMin, info.rpmMax, info.mapMin, info.mapMax]).toEqual([1000, 3000, 20, 60])
  })

  it('grade fora do padrão (16×16)', () => {
    const rpm = Array.from({ length: 16 }, (_, i) => 500 + i * 500)
    const map = Array.from({ length: 16 }, (_, i) => 160 - i * 10)
    const m = makeMap(rpm, map)
    const info = summarizeMap(m, m.cells, m.ignitionCells, m.lambdaCells)
    expect([info.rpmCount, info.mapCount]).toEqual([16, 16])
  })

  it('tabelas editáveis ausentes contam 0', () => {
    const m = makeMap()
    const info = summarizeMap(m, null, null, null)
    expect([info.editedVe, info.editedIgnition, info.editedLambda]).toEqual([0, 0, 0])
  })
})
