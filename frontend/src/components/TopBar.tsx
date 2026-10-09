import { NavLink, Link } from 'react-router-dom'
import { useCorrectionStore } from '@/store/correctionStore'

function navClass({ isActive }: { isActive: boolean }) {
  return `px-3 py-1 text-sm font-medium transition-colors border-b-2 ${
    isActive
      ? 'text-blue-400 border-blue-400'
      : 'text-gray-400 hover:text-gray-200 border-transparent'
  }`
}

export function TopBar() {
  const hasUnseenRun = useCorrectionStore((s) => s.hasUnseenRun)

  return (
    <header className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-lg font-bold text-blue-400 tracking-tight hover:text-blue-300 transition-colors">
          Master Injection Online Tools
        </Link>
      </div>

      <nav className="flex items-center gap-1">
        <NavLink to="/" end className={navClass}>Home</NavLink>
        <NavLink to="/mapa" className={navClass}>
          Mapa
          {hasUnseenRun && (
            <span
              title="Há um run de correção novo na aba Eficiência Volumétrica"
              aria-label="Run de correção novo"
              className="inline-block w-2 h-2 rounded-full bg-blue-400 ml-1.5 align-middle"
            />
          )}
        </NavLink>
        <NavLink to="/datalog" className={navClass}>Datalog</NavLink>
        <NavLink to="/settings" className={navClass}>Configurações</NavLink>
      </nav>
    </header>
  )
}
