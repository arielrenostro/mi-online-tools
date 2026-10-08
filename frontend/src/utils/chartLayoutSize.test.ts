import { describe, it, expect } from 'vitest'
import type { ChartLayout, ChartPanel } from '@/types/ui'
import {
  layoutHeight, resizePanelHeight, resizePanelWidth, hasHorizontalNeighbour,
  canResizeHeight, canResizeWidth,
  HEIGHT_STEP, MIN_HEIGHT, MAX_HEIGHT, MIN_RATIO, MAX_RATIO,
} from './chartLayoutSize'

const P = (id: string, height = 400): ChartPanel => ({ type: 'panel', panelId: id, signals: [], height })
const H = (a: ChartLayout, b: ChartLayout, ratio = 0.5): ChartLayout =>
  ({ type: 'split', direction: 'horizontal', splitId: 's', ratio, children: [a, b] })
const V = (a: ChartLayout, b: ChartLayout): ChartLayout =>
  ({ type: 'split', direction: 'vertical', splitId: 's', children: [a, b] })

function heightOf(layout: ChartLayout, id: string): number {
  if (layout.type === 'panel') return layout.panelId === id ? layout.height : NaN
  const r = heightOf(layout.children[0], id)
  return isNaN(r) ? heightOf(layout.children[1], id) : r
}

describe('layoutHeight', () => {
  it('painel, pilha e lado a lado', () => {
    expect(layoutHeight(P('a', 300))).toBe(300)
    expect(layoutHeight(V(P('a', 300), P('b', 200)))).toBe(500)
    expect(layoutHeight(H(P('a', 300), P('b', 200)))).toBe(300)
  })
})

describe('resizePanelHeight', () => {
  it('painel único: sobe e desce um passo', () => {
    const up = resizePanelHeight(P('a'), 'a', 1) as ChartPanel
    expect(up.height).toBe(400 + HEIGHT_STEP)
    expect((resizePanelHeight(P('a'), 'a', -1) as ChartPanel).height).toBe(400 - HEIGHT_STEP)
  })

  it('respeita mínimo e máximo', () => {
    expect(resizePanelHeight(P('a', MIN_HEIGHT), 'a', -1)).toBeNull()
    expect(resizePanelHeight(P('a', MAX_HEIGHT), 'a', 1)).toBeNull()
    expect((resizePanelHeight(P('a', MIN_HEIGHT + 30), 'a', -1) as ChartPanel).height).toBe(MIN_HEIGHT)
  })

  it('dois lado a lado: a linha inteira muda', () => {
    const next = resizePanelHeight(H(P('a'), P('b')), 'a', 1)!
    expect(heightOf(next, 'a')).toBe(500)
    expect(heightOf(next, 'b')).toBe(500)
  })

  it('lado a lado com alturas diferentes: a linha vai ao máximo ± passo para todos', () => {
    const next = resizePanelHeight(H(P('a', 300), P('b', 500)), 'a', -1)!
    expect(heightOf(next, 'a')).toBe(400)
    expect(heightOf(next, 'b')).toBe(400)
  })

  it('pilha: só a linha do painel muda, as outras não', () => {
    const next = resizePanelHeight(V(P('a'), P('b')), 'a', 1)!
    expect(heightOf(next, 'a')).toBe(500)
    expect(heightOf(next, 'b')).toBe(400)
    expect(layoutHeight(next)).toBe(900)
  })

  it('linha dentro de pilha: vizinhos lado a lado juntos, outra linha intacta', () => {
    const layout = V(H(P('a'), P('b')), P('c'))
    const next = resizePanelHeight(layout, 'b', -1)!
    expect(heightOf(next, 'a')).toBe(300)
    expect(heightOf(next, 'b')).toBe(300)
    expect(heightOf(next, 'c')).toBe(400)
  })

  it('pilha dentro de coluna: o painel em foco absorve a diferença', () => {
    // coluna esquerda = pilha a/b (800); direita = c (400) -> linha = 800
    const layout = H(V(P('a'), P('b')), P('c'))
    const next = resizePanelHeight(layout, 'a', 1)!
    expect(heightOf(next, 'a')).toBe(500)
    expect(heightOf(next, 'b')).toBe(400)
    expect(heightOf(next, 'c')).toBe(900)
    expect(layoutHeight(next)).toBe(900)
  })

  it('pilha dentro de coluna, foco do outro lado: a pilha ajusta o painel de baixo', () => {
    const layout = H(V(P('a'), P('b')), P('c'))
    const next = resizePanelHeight(layout, 'c', -1)!
    expect(heightOf(next, 'c')).toBe(700)
    expect(heightOf(next, 'a')).toBe(400)
    expect(heightOf(next, 'b')).toBe(300)
  })

  it('não passa do limite quando a coluna em pilha não comporta', () => {
    const layout = H(V(P('a', MIN_HEIGHT), P('b', MIN_HEIGHT)), P('c', 400))
    // linha = 400; "−" pediria 300 mas a pilha só vai a 300 (a=150,b=150) -> ok
    expect(resizePanelHeight(layout, 'c', -1)).not.toBeNull()
    const tight = H(V(P('a', MIN_HEIGHT), P('b', MIN_HEIGHT)), P('c', 300))
    // linha = 300; "−" pediria 200 < 150+150
    expect(resizePanelHeight(tight, 'c', -1)).toBeNull()
  })

  it('painel inexistente devolve null', () => {
    expect(resizePanelHeight(P('a'), 'zzz', 1)).toBeNull()
  })

  it('canResizeHeight acompanha os limites', () => {
    expect(canResizeHeight(P('a', MIN_HEIGHT), 'a', -1)).toBe(false)
    expect(canResizeHeight(P('a', MIN_HEIGHT), 'a', 1)).toBe(true)
  })
})

describe('resizePanelWidth', () => {
  it('painel sozinho ou em pilha: sem vizinho horizontal', () => {
    expect(resizePanelWidth(P('a'), 'a', 1)).toBeNull()
    expect(resizePanelWidth(V(P('a'), P('b')), 'a', 1)).toBeNull()
    expect(hasHorizontalNeighbour(V(P('a'), P('b')), 'a')).toBe(false)
    expect(canResizeWidth(P('a'), 'a', 1)).toBe(false)
  })

  it('aumentar o da esquerda sobe o ratio, do direito desce (soma constante)', () => {
    const layout = H(P('a'), P('b'))
    const l = resizePanelWidth(layout, 'a', 1) as { ratio: number }
    expect(l.ratio).toBe(0.6)
    const r = resizePanelWidth(layout, 'b', 1) as { ratio: number }
    expect(r.ratio).toBe(0.4)
    expect((resizePanelWidth(layout, 'a', -1) as { ratio: number }).ratio).toBe(0.4)
  })

  it('respeita os limites', () => {
    expect(resizePanelWidth(H(P('a'), P('b'), MAX_RATIO), 'a', 1)).toBeNull()
    expect(resizePanelWidth(H(P('a'), P('b'), MIN_RATIO), 'a', -1)).toBeNull()
    expect((resizePanelWidth(H(P('a'), P('b'), 0.8), 'a', 1) as { ratio: number }).ratio).toBe(MAX_RATIO)
  })

  it('aninhado: mexe no split lado a lado mais próximo', () => {
    // [ a | [ b | c ] ] : b mexe no ratio interno; a mexe no externo
    const layout = H(P('a'), H(P('b'), P('c')))
    const b = resizePanelWidth(layout, 'b', 1) as any
    expect(b.ratio).toBe(0.5)
    expect(b.children[1].ratio).toBe(0.6)
    const a = resizePanelWidth(layout, 'a', 1) as any
    expect(a.ratio).toBe(0.6)
    expect(a.children[1].ratio).toBe(0.5)
  })

  it('no limite do split mais próximo não sobe para o de fora', () => {
    const layout = H(P('a'), H(P('b'), P('c'), MAX_RATIO))
    expect(resizePanelWidth(layout, 'b', 1)).toBeNull()
  })

  it('painel numa pilha dentro de uma coluna usa o split lado a lado acima', () => {
    const layout = H(V(P('a'), P('b')), P('c'))
    expect(hasHorizontalNeighbour(layout, 'a')).toBe(true)
    expect((resizePanelWidth(layout, 'a', 1) as { ratio: number }).ratio).toBe(0.6)
  })
})
