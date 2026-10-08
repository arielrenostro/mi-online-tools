import type { ChartLayout, ChartPanel } from '@/types/ui'

export const HEIGHT_STEP    = 100
export const MIN_HEIGHT     = 150
export const MAX_HEIGHT     = 1000
export const DEFAULT_HEIGHT = 400
export const WIDTH_STEP     = 0.1
export const MIN_RATIO      = 0.15
export const MAX_RATIO      = 0.85

type Dir = 1 | -1

/** Altura efetiva de um nó: painel = `height`; pilha = soma; lado a lado = a maior. */
export function layoutHeight(node: ChartLayout): number {
  if (node.type === 'panel') return node.height
  const [a, b] = node.children
  return node.direction === 'vertical'
    ? layoutHeight(a) + layoutHeight(b)
    : Math.max(layoutHeight(a), layoutHeight(b))
}

export function findPanel(node: ChartLayout, panelId: string): ChartPanel | null {
  if (node.type === 'panel') return node.panelId === panelId ? node : null
  return findPanel(node.children[0], panelId) ?? findPanel(node.children[1], panelId)
}

function contains(node: ChartLayout, panelId: string): boolean {
  return findPanel(node, panelId) !== null
}

// ─── altura ──────────────────────────────────────────────────────────────────

/**
 * Faixa de alturas que `node` pode assumir ao ser esticado a uma altura única pela regra de
 * `setHeight` (o painel em foco absorve a diferença nas pilhas).
 */
function heightRange(node: ChartLayout, focusId: string): [number, number] {
  if (node.type === 'panel') return [MIN_HEIGHT, MAX_HEIGHT]
  const [a, b] = node.children
  if (node.direction === 'horizontal') {
    const [al, ah] = heightRange(a, focusId)
    const [bl, bh] = heightRange(b, focusId)
    return [Math.max(al, bl), Math.min(ah, bh)]
  }
  const focusIsA = contains(a, focusId)
  const target = focusIsA ? a : b
  const other  = focusIsA ? b : a
  const [lo, hi] = heightRange(target, focusId)
  const o = layoutHeight(other)
  return [lo + o, hi + o]
}

/** Estica `node` à altura `h`. Lado a lado: todos os filhos. Pilha: só o filho do foco (ou o de baixo). */
function setHeight(node: ChartLayout, h: number, focusId: string): ChartLayout {
  if (node.type === 'panel') return { ...node, height: h }
  const [a, b] = node.children
  if (node.direction === 'horizontal') {
    return { ...node, children: [setHeight(a, h, focusId), setHeight(b, h, focusId)] }
  }
  const focusIsA = contains(a, focusId)
  return focusIsA
    ? { ...node, children: [setHeight(a, h - layoutHeight(b), focusId), b] }
    : { ...node, children: [a, setHeight(b, h - layoutHeight(a), focusId)] }
}

/**
 * Aumenta (`dir` = 1) ou diminui (-1) a altura da LINHA do painel — o nó mais alto alcançado
 * subindo enquanto o pai for um split lado a lado. Devolve `null` se nada muda (limite).
 */
export function resizePanelHeight(layout: ChartLayout, panelId: string, dir: Dir): ChartLayout | null {
  if (!contains(layout, panelId)) return null
  // Pilha vertical: a linha do painel está no filho que o contém. Painel ou lado a lado: é a raiz da linha.
  if (layout.type === 'split' && layout.direction === 'vertical') {
    const [a, b] = layout.children
    const inA = contains(a, panelId)
    const next = resizePanelHeight(inA ? a : b, panelId, dir)
    return next && ({ ...layout, children: inA ? [next, b] : [a, next] } as ChartLayout)
  }
  const current = layoutHeight(layout)
  const [lo, hi] = heightRange(layout, panelId)
  const next = Math.max(lo, Math.min(hi, current + dir * HEIGHT_STEP))
  return next === current ? null : setHeight(layout, next, panelId)
}

// ─── largura ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Aumenta/diminui a largura do painel tomando do (ou devolvendo ao) vizinho: ajusta o `ratio` do
 * split lado a lado mais próximo acima dele. Devolve `null` sem vizinho horizontal ou no limite.
 */
export function resizePanelWidth(layout: ChartLayout, panelId: string, dir: Dir): ChartLayout | null {
  if (layout.type === 'panel' || !contains(layout, panelId)) return null
  const [a, b] = layout.children
  const inA = contains(a, panelId)
  // o split mais próximo do painel vence: tenta primeiro dentro do filho que o contém
  const deeper = resizePanelWidth(inA ? a : b, panelId, dir)
  if (deeper) return { ...layout, children: inA ? [deeper, b] : [a, deeper] } as ChartLayout
  // se o filho contém algum split lado a lado acima do painel, o limite dele vale — não sobe
  if (hasHorizontalAbove(inA ? a : b, panelId)) return null
  if (layout.direction !== 'horizontal') return null
  const next = round2(Math.max(MIN_RATIO, Math.min(MAX_RATIO, layout.ratio + (inA ? dir : -dir) * WIDTH_STEP)))
  if (next === layout.ratio) return null
  return { ...layout, ratio: next }
}

function hasHorizontalAbove(node: ChartLayout, panelId: string): boolean {
  if (node.type === 'panel' || !contains(node, panelId)) return false
  if (node.direction === 'horizontal') return true
  const [a, b] = node.children
  return hasHorizontalAbove(contains(a, panelId) ? a : b, panelId)
}

/** O painel tem um painel ao lado (algum ancestral é um split lado a lado)? */
export function hasHorizontalNeighbour(layout: ChartLayout, panelId: string): boolean {
  return hasHorizontalAbove(layout, panelId)
}

export function canResizeHeight(layout: ChartLayout, panelId: string, dir: Dir): boolean {
  return resizePanelHeight(layout, panelId, dir) !== null
}

export function canResizeWidth(layout: ChartLayout, panelId: string, dir: Dir): boolean {
  return resizePanelWidth(layout, panelId, dir) !== null
}

// ─── layout padrão ───────────────────────────────────────────────────────────

/** Painéis abertos por padrão (sem layout salvo), de cima para baixo. */
export const DEFAULT_PANEL_SIGNALS: string[][] = [
  ['RPM'],
  ['MAP', 'Pedal'],
  ['Lambda Target', 'Lambda 1', 'Lambda Corr'],
  ['VE', 'VE Lambda'],
  ['Inj. Pulse', 'Inj. DT', 'Inj. Efetivo'],
  ['Batt Volt.'],
]
export const DEFAULT_PANEL_HEIGHT = 280

/** Pilha vertical com um painel por grupo de `DEFAULT_PANEL_SIGNALS`. */
export function buildDefaultChartLayout(): ChartLayout {
  const panels: ChartPanel[] = DEFAULT_PANEL_SIGNALS.map(signals => ({
    type: 'panel', panelId: crypto.randomUUID(), signals: [...signals], height: DEFAULT_PANEL_HEIGHT,
  }))
  return buildStack(panels)
}

// árvore binária aninhada à direita: [p0, [p1, [p2, ...]]]
function buildStack(panels: ChartPanel[]): ChartLayout {
  if (panels.length === 1) return panels[0]
  return {
    type: 'split', direction: 'vertical', splitId: crypto.randomUUID(),
    children: [panels[0], buildStack(panels.slice(1))],
  }
}
