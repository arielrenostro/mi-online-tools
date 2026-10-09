/** Paleta das séries de sinais — compartilhada por Gráficos e XY, para o mesmo índice ter a mesma cor. */
export const PALETTE = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#fb923c', '#4ade80', '#e879f9']

/** Cor da série de índice `idx` (repete a paleta depois de 8). */
export function sigColor(_signal: string, idx: number): string {
  return PALETTE[idx % PALETTE.length]
}

/** Versão esmaecida (25% de opacidade) de uma cor `#rrggbb` da paleta — pontos que não passam no filtro. */
export function dimColor(color: string): string {
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  return `rgba(${r},${g},${b},0.25)`
}

/** Vermelho da linha média e o vermelho escuro usado quando a cor da série já é o vermelho da paleta. */
export const MEAN_LINE_COLOR      = '#ef4444'
export const MEAN_LINE_COLOR_DARK = '#b91c1c'

/** Cor da linha média de uma série: vermelha, a menos que a série seja ela própria vermelha (some na nuvem). */
export function meanLineColor(seriesColor: string): string {
  return seriesColor === PALETTE[4] ? MEAN_LINE_COLOR_DARK : MEAN_LINE_COLOR
}

/** Cor das linhas máxima e mínima (pontilhadas): neutra, para não competir com a média nem com a nuvem. */
export const ENVELOPE_LINE_COLOR = '#e5e7eb'
