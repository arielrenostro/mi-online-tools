import type { DatalogRow } from '@/types/datalog'

/** Intervalo de tempo (ms), inclusivo nas duas pontas. */
export interface TimeWindow { start_ms: number; end_ms: number }

/** Folga carregada de cada lado do intervalo visível, em larguras do intervalo visível. */
export const WINDOW_MARGIN = 1

/** A janela carregada é refeita quando ficou mais de N vezes maior que a ideal (zoom-in forte). */
export const MAX_OVERSIZE = 2

const width = (w: TimeWindow) => w.end_ms - w.start_ms

/** Janela a carregar para um intervalo visível: ele ± `margin` larguras, limitada ao domínio. */
export function windowFor(visible: TimeWindow, domain: TimeWindow, margin = WINDOW_MARGIN): TimeWindow {
  const pad = width(visible) * margin
  return {
    start_ms: Math.max(domain.start_ms, visible.start_ms - pad),
    end_ms:   Math.min(domain.end_ms,   visible.end_ms   + pad),
  }
}

/**
 * A janela já carregada ainda serve ao intervalo visível? Serve quando contém o intervalo (na ponta
 * do domínio basta chegar nela) e não é muito maior que a ideal — senão o gráfico continuaria
 * processando um log inteiro com o zoom bem fechado.
 */
export function windowCovers(loaded: TimeWindow | null, visible: TimeWindow, domain: TimeWindow): boolean {
  if (!loaded) return false
  const v = {
    start_ms: Math.max(domain.start_ms, visible.start_ms),
    end_ms:   Math.min(domain.end_ms,   visible.end_ms),
  }
  if (loaded.start_ms > v.start_ms || loaded.end_ms < v.end_ms) return false
  return width(loaded) <= MAX_OVERSIZE * width(windowFor(v, domain))
}

/** Mantém a janela carregada enquanto ela serve; senão devolve uma nova centrada no intervalo visível. */
export function nextWindow(prev: TimeWindow | null, visible: TimeWindow, domain: TimeWindow): TimeWindow {
  return windowCovers(prev, visible, domain) ? prev! : windowFor(visible, domain)
}

/** Primeiro índice com `timestamp_ms >= t` (busca binária; `rows` ordenadas por tempo). */
function lowerBound(rows: DatalogRow[], t: number): number {
  let lo = 0, hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (rows[mid].timestamp_ms < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Fatia `rows` e `mask` (indexada por linha) juntas para a janela, com uma linha de cada lado para a
 * linha do gráfico não terminar no vazio. Sem janela, devolve os mesmos arrays.
 */
export function windowRows(
  rows: DatalogRow[], mask: boolean[], win: TimeWindow | null,
): { rows: DatalogRow[]; mask: boolean[] } {
  if (!win || rows.length === 0) return { rows, mask }
  const lo = Math.max(0, lowerBound(rows, win.start_ms) - 1)
  const hi = Math.min(rows.length, lowerBound(rows, win.end_ms + 1) + 1)
  if (lo === 0 && hi === rows.length) return { rows, mask }
  return { rows: rows.slice(lo, hi), mask: mask.slice(lo, hi) }
}
