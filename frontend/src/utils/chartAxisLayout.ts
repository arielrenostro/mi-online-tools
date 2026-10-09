import type { SignalRange } from '@/store/signalRangesStore'

/** Fonte 9 px: um dígito/ponto/sinal ocupa ~5 px. */
const CHAR_WIDTH = 5
/** Comprimento do traço do eixo (padrão do ECharts) + distância dele ao rótulo (`axisLabel.margin`). */
export const AXIS_LABEL_MARGIN = 4
const AXIS_TICK = 5
/** Folga entre o fim dos rótulos de um eixo e a linha do eixo seguinte. */
const AXIS_GAP = 6
/** Folga entre o fim dos rótulos do último eixo e a borda do gráfico. */
const EDGE_GAP = 4
/** Sem eixo à direita, o último rótulo do eixo X (centrado na borda da área) precisa de espaço para não cortar. */
const X_LABEL_OVERHANG = 20
/** Sinal sem faixa conhecida: assume rótulos de 5 caracteres. */
const FALLBACK_CHARS = 5

const fmt = (v: number) => String(Number(v.toFixed(3)))

/** Largura (px) que um eixo Y da direita ocupa: traço + margem + rótulo mais largo da faixa (suas pontas). */
export function rightAxisWidth(range: SignalRange | undefined): number {
  const chars = range ? Math.max(fmt(range.min).length, fmt(range.max).length) : FALLBACK_CHARS
  return AXIS_TICK + AXIS_LABEL_MARGIN + chars * CHAR_WIDTH
}

/**
 * Posição dos eixos Y empilhados à direita da área de plotagem. Cada eixo ocupa só a largura dos
 * seus próprios rótulos: `offsets[k]` é o deslocamento do k-ésimo eixo da direita a partir da borda
 * da área (o 1º fica colado, offset 0) e `gridRight` é a margem direita que o `grid` reserva.
 */
export function rightAxisLayout(ranges: (SignalRange | undefined)[]): { offsets: number[]; gridRight: number } {
  const offsets: number[] = []
  let used = 0
  ranges.forEach((r, k) => {
    offsets.push(k === 0 ? 0 : used + AXIS_GAP)
    used = offsets[k] + rightAxisWidth(r)
  })
  return { offsets, gridRight: ranges.length === 0 ? X_LABEL_OVERHANG : used + EDGE_GAP }
}

export interface PlotMargins { left: number; right: number }

/**
 * Margens (px) que a área de plotagem de UM painel precisa: à esquerda, o eixo do 1º sinal; à direita,
 * os eixos empilhados dos demais. `ranges` = faixa efetiva de cada sinal do painel, na ordem dos sinais.
 */
export function panelMargins(ranges: (SignalRange | undefined)[]): PlotMargins {
  return {
    left:  rightAxisWidth(ranges[0]) + EDGE_GAP,
    right: rightAxisLayout(ranges.slice(1)).gridRight,
  }
}

/**
 * Margens comuns a todos os painéis: a maior de cada lado. Assim todas as áreas de plotagem ocupam o
 * mesmo trecho horizontal e o eixo de tempo/cursor ficam alinhados de um painel para o outro.
 * Painéis sem sinal (que não desenham eixo) não contam.
 */
export function sharedMargins(panels: (SignalRange | undefined)[][]): PlotMargins | undefined {
  const m = panels.filter(r => r.length > 0).map(panelMargins)
  if (m.length === 0) return undefined
  return { left: Math.max(...m.map(x => x.left)), right: Math.max(...m.map(x => x.right)) }
}
