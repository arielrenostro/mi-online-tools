import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { TimeRail } from '@/components/TimeRail'
import DatalogHelpModal from '@/features/datalog/DatalogHelpModal'
import VisualFilterModal from '@/features/datalog/VisualFilterModal'
import { useVisualFilterStore } from '@/store/visualFilterStore'
import { isVisualFilterActive } from '@/utils/visualFilter'

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

export function DatalogPage() {
  const [helpOpen, setHelpOpen] = useState(false)
  const [visualOpen, setVisualOpen] = useState(false)
  const visualActive = useVisualFilterStore(s => isVisualFilterActive(s.filter))
  // O filtro visual só destaca Gráficos/Dados/Dashboard; no Dinamômetro não tem efeito, então some do cabeçalho.
  const onDyno = useLocation().pathname.endsWith('/dyno')

  return (
    <div className="flex flex-col h-full">
      <nav className="flex items-end gap-1 border-b border-gray-800 px-4 pt-2 flex-shrink-0">
        <TabLink to="logs" label="Logs" />
        <TabLink to="dashboard" label="Dashboard" />
        <TabLink to="charts" label="Gráficos" />
        <TabLink to="data" label="Dados" />
        <TabLink to="dyno" label="Dinamômetro" />
        <div className="ml-auto pb-2 flex items-center gap-2">
          {!onDyno && <button
            onClick={() => setVisualOpen(true)}
            title={visualActive ? 'Filtro visual ativo — substitui o destaque dos filtros de correção' : 'Filtro visual'}
            className={
              visualActive
                ? 'px-2.5 h-6 flex items-center rounded-full border border-yellow-500 bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 text-xs font-medium transition-colors'
                : 'px-2.5 h-6 flex items-center rounded-full border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 text-xs font-medium transition-colors'
            }
          >
            Filtro visual{visualActive ? ' •' : ''}
          </button>}
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
      <VisualFilterModal open={visualOpen && !onDyno} onClose={() => setVisualOpen(false)} />
      <TimeRail />
      <div className="flex-1 overflow-auto min-h-0">
        <Outlet />
      </div>
    </div>
  )
}

