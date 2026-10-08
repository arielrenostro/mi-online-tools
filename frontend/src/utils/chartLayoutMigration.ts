import type { ChartLayout } from '@/types/ui'
import { DEFAULT_HEIGHT, MIN_HEIGHT, MAX_HEIGHT } from './chartLayoutSize'

function isNum(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v)
}

function clampHeight(h: number): number {
  return Math.round(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h)))
}

function validRatio(v: unknown): number {
  return isNum(v) && v > 0 && v < 1 ? v : 0.5
}

/**
 * Normaliza um layout de gráficos salvo (inclusive o formato antigo, em que o tamanho vinha de
 * `chartsHeight` + `ratio` dos splits verticais) para o formato atual. `available` é a altura que o
 * nó ocupava no formato antigo. Painéis que já têm `height` não são tocados (idempotente).
 * Devolve `null` se `raw` não for um layout reconhecível.
 */
export function migrateChartLayout(raw: unknown, chartsHeight?: number): ChartLayout | null {
  const total = isNum(chartsHeight) && chartsHeight > 0 ? chartsHeight : DEFAULT_HEIGHT
  return walk(raw, total)
}

function walk(raw: unknown, available: number): ChartLayout | null {
  if (!raw || typeof raw !== 'object') return null
  const node = raw as Record<string, unknown>

  if (node.type === 'panel') {
    if (typeof node.panelId !== 'string') return null
    return {
      type:    'panel',
      panelId: node.panelId,
      signals: Array.isArray(node.signals) ? node.signals.filter((s): s is string => typeof s === 'string') : [],
      height:  clampHeight(isNum(node.height) ? node.height : available),
    }
  }

  if (node.type === 'split' && Array.isArray(node.children) && node.children.length === 2) {
    const splitId = typeof node.splitId === 'string' ? node.splitId : crypto.randomUUID()
    const vertical = node.direction === 'vertical'
    const ratio = validRatio(node.ratio)
    const [h0, h1] = vertical ? [available * ratio, available * (1 - ratio)] : [available, available]
    const a = walk(node.children[0], h0)
    const b = walk(node.children[1], h1)
    if (!a || !b) return null
    return vertical
      ? { type: 'split', direction: 'vertical', splitId, children: [a, b] }
      : { type: 'split', direction: 'horizontal', splitId, ratio, children: [a, b] }
  }

  return null
}
