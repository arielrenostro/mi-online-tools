import { describe, it, expect } from 'vitest'
import { migrateChartLayout } from './chartLayoutMigration'
import { layoutHeight, DEFAULT_HEIGHT, MIN_HEIGHT, MAX_HEIGHT } from './chartLayoutSize'

const oldPanel = (id: string) => ({ type: 'panel', panelId: id, signals: ['RPM'] })

describe('migrateChartLayout', () => {
  it('painel único antigo recebe a altura de chartsHeight', () => {
    expect(migrateChartLayout(oldPanel('a'), 600)).toEqual({ type: 'panel', panelId: 'a', signals: ['RPM'], height: 600 })
  })

  it('sem chartsHeight usa o padrão', () => {
    expect((migrateChartLayout(oldPanel('a')) as any).height).toBe(DEFAULT_HEIGHT)
  })

  it('vertical 50/50 com chartsHeight 400 vira dois painéis de 200', () => {
    const old = { type: 'split', direction: 'vertical', splitId: 's', ratio: 0.5, children: [oldPanel('a'), oldPanel('b')] }
    const m = migrateChartLayout(old, 400) as any
    expect(m.direction).toBe('vertical')
    expect('ratio' in m).toBe(false)
    expect(m.children.map((c: any) => c.height)).toEqual([200, 200])
    expect(layoutHeight(m)).toBe(400)
  })

  it('vertical com ratio diferente divide proporcionalmente', () => {
    const old = { type: 'split', direction: 'vertical', splitId: 's', ratio: 0.75, children: [oldPanel('a'), oldPanel('b')] }
    const m = migrateChartLayout(old, 800) as any
    expect(m.children.map((c: any) => c.height)).toEqual([600, 200])
  })

  it('só horizontal: ambos recebem a altura total e o ratio é mantido', () => {
    const old = { type: 'split', direction: 'horizontal', splitId: 's', ratio: 0.5, children: [oldPanel('a'), oldPanel('b')] }
    const m = migrateChartLayout(old, 500) as any
    expect(m.ratio).toBe(0.5)
    expect(m.children.map((c: any) => c.height)).toEqual([500, 500])
  })

  it('horizontal sem ratio/splitId (formato mais antigo) ganha 0,5 e um splitId', () => {
    const old = { type: 'split', direction: 'horizontal', children: [oldPanel('a'), oldPanel('b')] }
    const m = migrateChartLayout(old, 400) as any
    expect(m.ratio).toBe(0.5)
    expect(typeof m.splitId).toBe('string')
  })

  it('aninhado: a altura herdada desce pela árvore', () => {
    const old = {
      type: 'split', direction: 'vertical', splitId: 's', ratio: 0.5,
      children: [
        { type: 'split', direction: 'horizontal', splitId: 't', ratio: 0.5, children: [oldPanel('a'), oldPanel('b')] },
        oldPanel('c'),
      ],
    }
    const m = migrateChartLayout(old, 800) as any
    expect(m.children[0].children.map((c: any) => c.height)).toEqual([400, 400])
    expect(m.children[1].height).toBe(400)
  })

  it('limita a altura ao mínimo e ao máximo', () => {
    expect((migrateChartLayout(oldPanel('a'), 50) as any).height).toBe(MIN_HEIGHT)
    expect((migrateChartLayout(oldPanel('a'), 5000) as any).height).toBe(MAX_HEIGHT)
  })

  it('é idempotente: layout já migrado não muda', () => {
    const old = { type: 'split', direction: 'vertical', splitId: 's', ratio: 0.5, children: [oldPanel('a'), oldPanel('b')] }
    const once = migrateChartLayout(old, 400)
    const twice = migrateChartLayout(once, 999)
    expect(twice).toEqual(once)
  })

  it('valores inválidos: ratio fora de (0,1) vira 0,5; lixo devolve null', () => {
    const bad = { type: 'split', direction: 'vertical', splitId: 's', ratio: 7, children: [oldPanel('a'), oldPanel('b')] }
    expect((migrateChartLayout(bad, 400) as any).children.map((c: any) => c.height)).toEqual([200, 200])
    expect(migrateChartLayout(null)).toBeNull()
    expect(migrateChartLayout('x')).toBeNull()
    expect(migrateChartLayout({ type: 'split', children: [oldPanel('a')] })).toBeNull()
    expect(migrateChartLayout({ type: 'panel' })).toBeNull()
  })

  it('chartsHeight inválido cai no padrão', () => {
    expect((migrateChartLayout(oldPanel('a'), NaN) as any).height).toBe(DEFAULT_HEIGHT)
    expect((migrateChartLayout(oldPanel('a'), -5) as any).height).toBe(DEFAULT_HEIGHT)
  })
})
