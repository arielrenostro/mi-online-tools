import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/persistence/localStorage', () => ({
  lsSet: vi.fn(),
  lsGet: vi.fn(),
}))

import { useUIStore, flattenPanels } from './uiStore'
import { lsSet } from '@/persistence/localStorage'
import { layoutHeight, DEFAULT_PANEL_HEIGHT, DEFAULT_PANEL_SIGNALS, HEIGHT_STEP } from '@/utils/chartLayoutSize'
import type { ChartLayout } from '@/types/ui'

const panel = (id: string, height = 400): ChartLayout => ({ type: 'panel', panelId: id, signals: [], height })

function reset(layout: ChartLayout) {
  useUIStore.setState({ chartLayout: layout })
  vi.mocked(lsSet).mockClear()
}

describe('uiStore — tamanho dos painéis', () => {
  beforeEach(() => reset(panel('a')))

  it('o layout inicial traz os painéis padrão, empilhados, com a altura padrão', () => {
    const initial = useUIStore.getInitialState().chartLayout
    const panels = flattenPanels(initial)
    expect(panels.map(p => p.signals)).toEqual(DEFAULT_PANEL_SIGNALS)
    expect(panels.every(p => p.height === DEFAULT_PANEL_HEIGHT)).toBe(true)
    expect(new Set(panels.map(p => p.panelId)).size).toBe(panels.length)
    expect(layoutHeight(initial)).toBe(DEFAULT_PANEL_HEIGHT * DEFAULT_PANEL_SIGNALS.length)
  })

  it('"abaixo" cria o painel com a altura do de origem e não mexe nos outros', () => {
    reset({ type: 'split', direction: 'vertical', splitId: 's', children: [panel('a', 300), panel('b', 500)] })
    useUIStore.getState().addChartPanel('a', 'vertical')
    const layout = useUIStore.getState().chartLayout
    const panels = flattenPanels(layout)
    expect(panels).toHaveLength(3)
    const added = panels.find(p => p.panelId !== 'a' && p.panelId !== 'b')!
    expect(added.height).toBe(300)
    expect(panels.find(p => p.panelId === 'a')!.height).toBe(300)
    expect(panels.find(p => p.panelId === 'b')!.height).toBe(500)
    expect(layoutHeight(layout)).toBe(300 + 300 + 500)
  })

  it('divisão lado a lado: dois painéis de mesma altura, ratio 0,5', () => {
    reset(panel('a', 350))
    useUIStore.getState().addChartPanel('a', 'horizontal')
    const layout = useUIStore.getState().chartLayout
    expect(layout.type === 'split' && layout.direction === 'horizontal' && layout.ratio).toBe(0.5)
    expect(flattenPanels(layout).map(p => p.height)).toEqual([350, 350])
  })

  it('addChartPanel com painel inexistente não muda nada', () => {
    const before = useUIStore.getState().chartLayout
    useUIStore.getState().addChartPanel('nope', 'vertical')
    expect(useUIStore.getState().chartLayout).toBe(before)
  })

  it('resizePanelHeight altera e persiste; no limite não faz nada', () => {
    useUIStore.getState().resizePanelHeight('a', 1)
    expect(flattenPanels(useUIStore.getState().chartLayout)[0].height).toBe(400 + HEIGHT_STEP)
    expect(lsSet).toHaveBeenCalledTimes(1)

    reset(panel('a', 150))
    useUIStore.getState().resizePanelHeight('a', -1)
    expect(lsSet).not.toHaveBeenCalled()
  })

  it('resizePanelWidth mexe no ratio do split lado a lado', () => {
    reset({ type: 'split', direction: 'horizontal', splitId: 's', ratio: 0.5, children: [panel('a'), panel('b')] })
    useUIStore.getState().resizePanelWidth('a', 1)
    const l = useUIStore.getState().chartLayout
    expect(l.type === 'split' && l.direction === 'horizontal' && l.ratio).toBe(0.6)
    useUIStore.getState().resizePanelWidth('a', 1) // 0,7
    useUIStore.getState().resizePanelWidth('a', 1) // 0,8
    useUIStore.getState().resizePanelWidth('a', 1) // 0,85 (limite)
    useUIStore.getState().resizePanelWidth('a', 1) // nada
    const r = useUIStore.getState().chartLayout
    expect(r.type === 'split' && r.direction === 'horizontal' && r.ratio).toBe(0.85)
  })

  it('persiste sem chartsHeight', () => {
    useUIStore.getState().resizePanelHeight('a', 1)
    const saved = vi.mocked(lsSet).mock.calls[0][1] as Record<string, unknown>
    expect('chartsHeight' in saved).toBe(false)
    expect(saved.chartLayout).toBeDefined()
  })

  it('remover um painel mantém as alturas dos demais', () => {
    reset({ type: 'split', direction: 'vertical', splitId: 's', children: [panel('a', 300), panel('b', 500)] })
    useUIStore.getState().removeChartPanel('a')
    expect(flattenPanels(useUIStore.getState().chartLayout).map(p => [p.panelId, p.height])).toEqual([['b', 500]])
  })
})

describe('uiStore — hydrate (migração de layouts salvos)', () => {
  it('layout antigo com chartsHeight e ratio vertical vira alturas por painel', () => {
    const old = {
      type: 'split', direction: 'vertical', splitId: 's', ratio: 0.5,
      children: [
        { type: 'panel', panelId: 'a', signals: ['RPM'] },
        { type: 'panel', panelId: 'b', signals: ['MAP'] },
      ],
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useUIStore.getState().hydrate({ chartLayout: old as any, chartsHeight: 600 })
    const s = useUIStore.getState()
    expect(flattenPanels(s.chartLayout).map(p => p.height)).toEqual([300, 300])
    expect('chartsHeight' in s).toBe(false)
  })

  it('layout já no formato novo é mantido', () => {
    const layout = panel('a', 777)
    useUIStore.getState().hydrate({ chartLayout: layout })
    expect(useUIStore.getState().chartLayout).toEqual(layout)
  })

  it('layout ilegível cai no layout padrão sem erro', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useUIStore.getState().hydrate({ chartLayout: { type: 'xyz' } as any })
    expect(flattenPanels(useUIStore.getState().chartLayout).map(p => p.signals)).toEqual(DEFAULT_PANEL_SIGNALS)
  })

  it('outras preferências continuam sendo restauradas', () => {
    useUIStore.getState().hydrate({ originalMapCollapsed: true })
    expect(useUIStore.getState().originalMapCollapsed).toBe(true)
  })
})

describe('uiStore — modo de análise do Mapa', () => {
  beforeEach(() => {
    useUIStore.setState({ mapaAnalysisMode: 've_lambda' })
    vi.mocked(lsSet).mockClear()
  })

  it('restaura o campo antigo tuningAnalysisMode como mapaAnalysisMode', () => {
    useUIStore.getState().hydrate({ tuningAnalysisMode: 'coverage' })
    expect(useUIStore.getState().mapaAnalysisMode).toBe('coverage')
  })

  it('o campo novo vence o antigo quando os dois existem', () => {
    useUIStore.getState().hydrate({ tuningAnalysisMode: 'coverage', mapaAnalysisMode: 'confidence' })
    expect(useUIStore.getState().mapaAnalysisMode).toBe('confidence')
  })

  it('o próximo persist grava só o nome novo', () => {
    useUIStore.getState().hydrate({ tuningAnalysisMode: 'coverage' })
    useUIStore.getState().setMapaAnalysisMode('confidence')
    const saved = vi.mocked(lsSet).mock.calls[vi.mocked(lsSet).mock.calls.length - 1][1] as Record<string, unknown>
    expect(saved.mapaAnalysisMode).toBe('confidence')
    expect('tuningAnalysisMode' in saved).toBe(false)
  })
})
