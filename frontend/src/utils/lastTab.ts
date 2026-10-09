import type { DatalogTab, MapaTab } from '@/types/ui'

export const DATALOG_TABS: readonly DatalogTab[] = ['logs', 'dashboard', 'charts', 'data', 'dyno', 'xy']
export const MAPA_TABS: readonly MapaTab[] = ['arquivo', 've', 'ignition', 'lambda']

export const DEFAULT_DATALOG_TAB: DatalogTab = 'logs'
export const DEFAULT_MAPA_TAB: MapaTab = 've'

/** Aba da seção em um caminho (`/datalog/xy` → `xy`), ou `null` fora da seção ou numa aba desconhecida. */
export function tabFromPath<T extends string>(section: string, pathname: string, valid: readonly T[]): T | null {
  const [, root, tab] = pathname.split('/')
  return root === section && tab && (valid as readonly string[]).includes(tab) ? (tab as T) : null
}

/** A aba salva, se ainda for uma aba conhecida (o estado salvo pode vir de outra versão); senão o padrão. */
export function resolveTab<T extends string>(saved: unknown, valid: readonly T[], fallback: T): T {
  return typeof saved === 'string' && (valid as readonly string[]).includes(saved) ? (saved as T) : fallback
}
