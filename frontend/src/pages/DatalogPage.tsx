import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { TimeRail } from '@/components/TimeRail'
import DatalogHelpModal from '@/features/datalog/DatalogHelpModal'
import { FilterButton } from '@/features/datalog/FilterButton'
import { GenerateCorrectionButton } from '@/features/datalog/GenerateCorrectionButton'
import { ChartsTab } from '@/features/datalog/ChartsTab'
import { LogsTab } from '@/features/datalog/LogsTab'
import { DashboardTab } from '@/features/datalog/DashboardTab'
import { DataTab } from '@/features/datalog/DataTab'
import { DynoTab } from '@/features/datalog/DynoTab'
import { XYTab } from '@/features/datalog/XYTab'
import { RequireLog } from '@/components/guards/RequireLog'
import { useUIStore } from '@/store/uiStore'
import { useLogStore } from '@/store/logStore'
import { useSessionStore } from '@/store/sessionStore'
import { tabFromPath, DATALOG_TABS } from '@/utils/lastTab'

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        isActive
          ? 'px-4 py-2 text-sm border-b-2 border-blue-500 text-blue-400 font-medium'
          : 'px-4 py-2 text-sm text-gray-500 hover:text-gray-300'
      }
    >
      {label}
    </NavLink>
  )
}

/**
 * A seção Datalog. Fica montada pelo `RootLayout` mesmo ao ir para Mapa/Home/Configurações (`visible`
 * false: escondida, só os gráficos continuam vivos), para voltar sem reconstruir os gráficos — as
 * demais abas só existem enquanto estão abertas.
 */
export function DatalogPage({ visible }: { visible: boolean }) {
  const [helpOpen, setHelpOpen] = useState(false)
  // O filtro (e a geração de correção) não têm efeito no Dinamômetro, que tem filtros próprios — somem do cabeçalho.
  const pathname = useLocation().pathname
  const onDyno = visible && pathname.endsWith('/dyno')
  const onCharts = visible && pathname.endsWith('/charts')
  const tab = tabFromPath('datalog', pathname, DATALOG_TABS)
  const setDatalogTab = useUIStore(s => s.setDatalogTab)

  // Lembra a aba para a TopBar reabrir nela ao voltar para Datalog.
  useEffect(() => {
    const tab = tabFromPath('datalog', pathname, DATALOG_TABS)
    if (tab) setDatalogTab(tab)
  }, [pathname, setDatalogTab])

  // Os gráficos custam caro para montar: depois da primeira visita ficam montados (escondidos nas
  // outras abas, sem reconstruir) em vez de refeitos a cada volta. A guarda de log da rota `charts`
  // continua valendo; sem log ativo (ou restaurando a sessão) não há o que manter.
  const hasLogs = useLogStore(s => s.logs.some(l => l.enabled))
  const isRestoring = useSessionStore(s => s.isRestoring)
  const [chartsVisited, setChartsVisited] = useState(onCharts)
  useEffect(() => { if (onCharts) setChartsVisited(true) }, [onCharts])
  const keepCharts = chartsVisited && hasLogs && !isRestoring

  return (
    <div className={visible ? 'flex flex-col h-full' : 'hidden'}>
      {visible && (<>
      <nav className="flex items-end gap-1 border-b border-gray-800 px-4 pt-2 flex-shrink-0">
        <TabLink to="/datalog/logs" label="Logs" />
        <TabLink to="/datalog/data" label="Dados" />
        <TabLink to="/datalog/dashboard" label="Dashboard" />
        <TabLink to="/datalog/charts" label="Gráficos" />
        <TabLink to="/datalog/xy" label="XY" />
        <TabLink to="/datalog/dyno" label="Dinamômetro" />
        <div className="ml-auto pb-2 flex items-center gap-2">
          {!onDyno && <FilterButton />}
          {!onDyno && <GenerateCorrectionButton />}
          <button
            onClick={() => setHelpOpen(true)}
            title="Ajuda"
            className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 text-xs font-bold transition-colors"
          >
            ?
          </button>
        </div>
      </nav>
      <DatalogHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <TimeRail />
      </>)}
      <div className="flex-1 overflow-auto min-h-0">
        {keepCharts && (
          <div className={onCharts ? 'h-full' : 'hidden'}>
            <ChartsTab active={onCharts} />
          </div>
        )}
        {visible && tab === 'logs'      && <LogsTab />}
        {visible && tab === 'dashboard' && <RequireLog><DashboardTab /></RequireLog>}
        {visible && tab === 'charts'    && <RequireLog>{null}</RequireLog>}
        {visible && tab === 'data'      && <RequireLog><DataTab /></RequireLog>}
        {visible && tab === 'dyno'      && <RequireLog><DynoTab /></RequireLog>}
        {visible && tab === 'xy'        && <RequireLog><XYTab /></RequireLog>}
      </div>
    </div>
  )
}
