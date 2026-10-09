export type RGB = [number, number, number]

/** Teto da correção: a partir de ±15% o mapa "bateu no limite" e a cor não escurece mais. */
export const CORRECTION_LIMIT_PCT = 15

/**
 * Cor por intensidade da correção, em pontos percentuais absolutos (a direção — mais ou menos —
 * não muda a cor: os dois extremos "esquentam"). A escala é propositalmente não linear:
 * 5% já é muita coisa (amarelo), 10% é MUITA (vermelho) e 15% é o limite (vinho).
 */
export const CORRECTION_COLOR_STOPS: { pct: number; color: RGB }[] = [
  { pct: 0,                      color: [59, 130, 246] },  // sem correção: azul
  { pct: 2,                      color: [34, 197, 94] },   // ajuste fino: verde
  { pct: 5,                      color: [234, 179, 8] },   // já é bastante: amarelo
  { pct: 10,                     color: [239, 68, 68] },   // é MUITA coisa: vermelho
  { pct: CORRECTION_LIMIT_PCT,   color: [127, 29, 29] },   // limite: vinho
]

function lerp(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

/** Cor de uma correção de `pct` pontos percentuais (positivo ou negativo). */
export function correctionColor(pct: number): RGB {
  const x = Math.min(Math.abs(pct), CORRECTION_LIMIT_PCT)
  for (let i = 1; i < CORRECTION_COLOR_STOPS.length; i++) {
    const lo = CORRECTION_COLOR_STOPS[i - 1]
    const hi = CORRECTION_COLOR_STOPS[i]
    if (x <= hi.pct) return lerp(lo.color, hi.color, (x - lo.pct) / (hi.pct - lo.pct))
  }
  return CORRECTION_COLOR_STOPS[CORRECTION_COLOR_STOPS.length - 1].color
}

/** Intensidade mínima de uma célula sem confiança nenhuma: o tom do valor mal aparece, mas o número segue legível. */
export const MIN_CONFIDENCE_OPACITY = 0.08

/**
 * Opacidade (MIN..1) da célula pela confiança `w = n / (n + k)` (0..1). A cor continua sendo a do valor
 * da correção; poucas amostras só deixam a célula mais transparente (menos destaque sobre o fundo).
 */
export function confidenceOpacity(w: number): number {
  const clamped = Math.max(0, Math.min(1, w))
  return MIN_CONFIDENCE_OPACITY + (1 - MIN_CONFIDENCE_OPACITY) * clamped
}

/** Cor de uma célula sem dados (cinza-azulado escuro): para onde as células de pouca confiança desbotam. */
export const NEUTRAL_CELL_COLOR: RGB = [31, 41, 55]

/**
 * Mistura `color` com a cor neutra de célula vazia: opacidade 1 = a cor inteira, 0 = a neutra. Em vez de
 * deixar a célula transparente sobre o fundo preto (o que escurece as cores já escuras, como o vinho, e
 * cria buracos que chamam atenção), todas as de pouca confiança convergem para o mesmo tom discreto.
 */
export function fadeToNeutral(color: RGB, opacity: number): RGB {
  return lerp(NEUTRAL_CELL_COLOR, color, Math.max(0, Math.min(1, opacity)))
}
