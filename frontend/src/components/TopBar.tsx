import { NavLink, Link } from 'react-router-dom'
import { useMapStore } from '@/store/mapStore'

function navClass({ isActive }: { isActive: boolean }) {
  return `px-3 py-1 text-sm font-medium transition-colors border-b-2 ${
    isActive
      ? 'text-blue-400 border-blue-400'
      : 'text-gray-400 hover:text-gray-200 border-transparent'
  }`
}

export function TopBar() {
  const mapName = useMapStore((s) => s.originalMap?.name ?? null)

  return (
    <header className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-lg font-bold text-blue-400 tracking-tight hover:text-blue-300 transition-colors">
          Master Injection Online Tools
        </Link>
        {mapName && (
          <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded truncate max-w-[240px]">
            {mapName}
          </span>
        )}
      </div>

      <nav className="flex items-center gap-1">
        <NavLink to="/" end className={navClass}>Home</NavLink>
        <NavLink to="/tuning" className={navClass}>Tuning</NavLink>
        <NavLink to="/datalog" className={navClass}>Datalog</NavLink>
      </nav>
    </header>
  )
}
