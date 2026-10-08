import type { DatalogRow } from '@/types/datalog'

/** Largura fixa (rpm) das faixas do suavizado — não é configurável pelo usuário. */
export const RPM_BAND_WIDTH = 100

export interface DynoPoint {
  rpm:    number
  power:  number // cv
  torque: number // kgf·m
}

function toPoints(rows: DatalogRow[]): DynoPoint[] {
  const points: DynoPoint[] = []
  for (const row of rows) {
    const rpm = row['RPM'], power = row['Potência'], torque = row['Torque']
    if (Number.isFinite(rpm) && Number.isFinite(power) && Number.isFinite(torque)) {
      points.push({ rpm, power, torque })
    }
  }
  return points
}

/** Cada linha qualificada como um ponto, em ordem crescente de RPM (linhas sem potência/torque são descartadas). */
export function buildRawCurve(rows: DatalogRow[]): DynoPoint[] {
  return toPoints(rows).sort((a, b) => a.rpm - b.rpm)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function mean(values: number[]): number {
  let sum = 0
  for (const v of values) sum += v
  return sum / values.length
}

/**
 * Mediana móvel de 3 com a regra de ponta de Tukey: a primeira/última faixa vira a mediana de si
 * mesma, da vizinha já suavizada e da extrapolação linear das duas seguintes — exata numa tendência
 * linear (não achata a curva crescente) e ainda remove um spike na ponta. Com menos de 3 valores,
 * devolve-os como estão.
 */
function runningMedian3(values: number[]): number[] {
  const n = values.length
  if (n < 3) return values
  const out = values.map((v, i) => (i === 0 || i === n - 1 ? v : median([values[i - 1], v, values[i + 1]])))
  out[0]     = median([values[0],     out[1],     3 * out[1]     - 2 * out[2]])
  out[n - 1] = median([values[n - 1], out[n - 2], 3 * out[n - 2] - 2 * out[n - 3]])
  return out
}

/** Média móvel de 3; nas pontas usa só os vizinhos existentes. */
function movingAverage3(values: number[]): number[] {
  return values.map((_, i) => mean(values.slice(Math.max(i - 1, 0), Math.min(i + 2, values.length))))
}

function smooth(values: number[]): number[] {
  return movingAverage3(runningMedian3(values))
}

/**
 * Um ponto por faixa de RPM (`floor(rpm / bandWidth)`) com amostra: mediana de potência e de torque na
 * faixa (RPM = média dos RPM da faixa), depois mediana móvel e média móvel entre faixas vizinhas com
 * amostra. Faixas vazias não geram ponto. Um spike isolado (inclusive em faixa de 1–2 amostras) não
 * vira pico.
 */
export function buildSmoothedCurve(rows: DatalogRow[], bandWidth: number = RPM_BAND_WIDTH): DynoPoint[] {
  if (!(bandWidth > 0)) return []
  const bands = new Map<number, DynoPoint[]>()
  for (const p of toPoints(rows)) {
    const key = Math.floor(p.rpm / bandWidth)
    const list = bands.get(key)
    if (list) list.push(p); else bands.set(key, [p])
  }

  const keys = [...bands.keys()].sort((a, b) => a - b)
  const rpms    = keys.map(k => mean(bands.get(k)!.map(p => p.rpm)))
  const powers  = smooth(keys.map(k => median(bands.get(k)!.map(p => p.power))))
  const torques = smooth(keys.map(k => median(bands.get(k)!.map(p => p.torque))))

  return keys.map((_, i) => ({ rpm: rpms[i], power: powers[i], torque: torques[i] }))
}

/** Modo Roda: multiplica potência e torque por `1 − perda/100` (RPM intacto). */
export function applyLoss(points: DynoPoint[], lossPct: number): DynoPoint[] {
  const factor = 1 - lossPct / 100
  return points.map(p => ({ rpm: p.rpm, power: p.power * factor, torque: p.torque * factor }))
}
