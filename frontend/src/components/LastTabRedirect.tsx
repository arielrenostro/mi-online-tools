import { Navigate } from 'react-router-dom'
import { useUIStore } from '@/store/uiStore'
import {
  DATALOG_TABS, MAPA_TABS, DEFAULT_DATALOG_TAB, DEFAULT_MAPA_TAB, resolveTab,
} from '@/utils/lastTab'

/**
 * Rota índice de uma seção (`/datalog`, `/mapa`): abre a última aba em que o usuário esteve nela
 * (ver `DatalogPage`/`MapaPage`, que a registram), ou a padrão se não houver nenhuma válida.
 */
export function LastTabRedirect({ section }: { section: 'datalog' | 'mapa' }) {
  const datalogTab = useUIStore(s => s.datalogTab)
  const mapaTab    = useUIStore(s => s.mapaTab)
  const to = section === 'datalog'
    ? resolveTab(datalogTab, DATALOG_TABS, DEFAULT_DATALOG_TAB)
    : resolveTab(mapaTab, MAPA_TABS, DEFAULT_MAPA_TAB)
  return <Navigate to={to} replace />
}
