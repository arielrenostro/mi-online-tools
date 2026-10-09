import type { DatalogRow, TimeSelection } from '@/types/datalog'
import { findLastRow } from './findLastRow'

export type XYPoint = [x: number, y: number]

export interface XYSeriesData {
  signal: string
  /** Pontos que passam no filtro aplicado. */
  pass:   XYPoint[]
  /** Pontos que falham no filtro — vazio quando "Mostrar pontos filtrados" está desligado. */
  fail:   XYPoint[]
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Uma entrada por sinal Y, na ordem dada. Uma linha vira ponto de uma série só quando X e aquele Y são
 * números na linha — faltar um Y não tira a linha das outras séries. Linhas fora da seleção de tempo
 * (quando há) ficam de fora. `mask[i]` é o resultado do filtro aplicado para `rows[i]`; só `false`
 * reprova (máscara mais curta que as linhas = sem informação = passa). Pontos reprovados vão para `fail`
 * quando `showFiltered`, e são descartados quando não.
 */
export function buildXYSeries(
  rows:         DatalogRow[],
  mask:         boolean[],
  selection:    TimeSelection | null,
  xSignal:      string,
  ySignals:     string[],
  showFiltered: boolean,
): XYSeriesData[] {
  const out: XYSeriesData[] = ySignals.map(signal => ({ signal, pass: [], fail: [] }))

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (selection && (row.timestamp_ms < selection.start_ms || row.timestamp_ms > selection.end_ms)) continue
    const x = row[xSignal]
    if (!isNum(x)) continue
    const passes = mask[i] !== false
    if (!passes && !showFiltered) continue

    for (let s = 0; s < ySignals.length; s++) {
      const y = row[ySignals[s]]
      if (!isNum(y)) continue
      ;(passes ? out[s].pass : out[s].fail).push([x, y])
    }
  }
  return out
}

/**
 * Ponto (X, Y) de cada sinal Y na linha do cursor — a última com `timestamp_ms <= cursor_ms`, passe ou
 * não no filtro. `null` por sinal quando não há cursor, linha ou valor numérico em X ou naquele Y.
 */
export function cursorPoints(
  rows:      DatalogRow[],
  cursor_ms: number | null,
  xSignal:   string,
  ySignals:  string[],
): (XYPoint | null)[] {
  const row = cursor_ms === null ? null : findLastRow(rows, cursor_ms)
  return ySignals.map(sig => {
    if (!row) return null
    const x = row[xSignal], y = row[sig]
    return isNum(x) && isNum(y) ? [x, y] : null
  })
}

/**
 * Faixas das curvas por X: a faixa padrão do sinal é dividida em `CURVE_BANDS` faixas de mesma largura
 * (RPM: 100 rpm cada) e só faixas com ao menos `CURVE_MIN_SAMPLES` pontos geram um ponto da linha — uma
 * amostra isolada não puxa a curva.
 */
export const CURVE_BANDS       = 70
export const CURVE_MIN_SAMPLES = 3

export type BandStat = 'mean' | 'max' | 'min'

/**
 * Curva de uma estatística de Y em função de X: para cada faixa de X com pelo menos `minSamples` pontos,
 * `[média de X, estatística de Y]` dos pontos dela (`mean` = média, `max` = maior, `min` = menor), em
 * ordem crescente de X. A curva é então **prolongada na horizontal**, no nível do primeiro e do último
 * ponto, até o menor e o maior X de *todos* os pontos recebidos — assim cobre todas as posições
 * horizontais com pontos, inclusive as pontas ralas em que nenhuma faixa chega ao mínimo. Sem nenhuma
 * faixa válida, vazio. Pontos fora de [xMin, xMax] formam faixas próprias (fora do eixo).
 */
export function bandCurve(
  points:     XYPoint[],
  xMin:       number,
  xMax:       number,
  stat:       BandStat,
  bands:      number = CURVE_BANDS,
  minSamples: number = CURVE_MIN_SAMPLES,
): XYPoint[] {
  const width = (xMax - xMin) / bands
  if (!(width > 0)) return []

  const acc = new Map<number, { n: number; sx: number; sy: number; max: number; min: number }>()
  let lo = Infinity, hi = -Infinity
  for (const [x, y] of points) {
    if (x < lo) lo = x
    if (x > hi) hi = x
    const key = Math.floor((x - xMin) / width)
    const a = acc.get(key)
    if (a) {
      a.n++; a.sx += x; a.sy += y
      if (y > a.max) a.max = y
      if (y < a.min) a.min = y
    } else acc.set(key, { n: 1, sx: x, sy: y, max: y, min: y })
  }
  const curve = [...acc.entries()]
    .filter(([, a]) => a.n >= minSamples)
    .sort(([k1], [k2]) => k1 - k2)
    .map(([, a]) => [a.sx / a.n, stat === 'mean' ? a.sy / a.n : stat === 'max' ? a.max : a.min] as XYPoint)

  if (curve.length === 0) return curve
  const first = curve[0], last = curve[curve.length - 1]
  if (lo < first[0]) curve.unshift([lo, first[1]])
  if (hi > last[0])  curve.push([hi, last[1]])
  return curve
}

/** Há ao menos um ponto a desenhar em alguma série. */
export function hasXYPoints(series: XYSeriesData[]): boolean {
  return series.some(s => s.pass.length > 0 || s.fail.length > 0)
}
