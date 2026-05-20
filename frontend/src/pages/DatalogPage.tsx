import { NavLink, Outlet } from 'react-router-dom'
import { TimeRail } from '@/components/TimeRail'

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
  return (
    <div className="flex flex-col h-full">
      <nav className="flex gap-1 border-b border-gray-800 px-4 pt-2 flex-shrink-0">
        <TabLink to="logs" label="Logs" />
        <TabLink to="dashboard" label="Dashboard" />
        <TabLink to="charts" label="Gráficos" />
        <TabLink to="data" label="Dados" />
      </nav>
      <TimeRail />
      <div className="flex-1 overflow-auto min-h-0">
        <Outlet />
      </div>
    </div>
  )
}

