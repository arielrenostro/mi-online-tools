import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useMapStore } from '@/store/mapStore'
import { undoTargetForPath } from '@/utils/undoTarget'
import { MapaTabLink } from '@/components/MapaTabLink'
import { useUIStore } from '@/store/uiStore'
import { tabFromPath, MAPA_TABS } from '@/utils/lastTab'

export default function MapaPage() {
  const location = useLocation()
  const setMapaTab = useUIStore(s => s.setMapaTab)

  // Lembra a aba para a TopBar reabrir nela ao voltar para Mapa.
  useEffect(() => {
    const tab = tabFromPath('mapa', location.pathname, MAPA_TABS)
    if (tab) setMapaTab(tab)
  }, [location.pathname, setMapaTab])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      const tag = (e.target as HTMLElement)?.tagName ?? ''
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const target = undoTargetForPath(location.pathname)
      if (!target) return
      const store = useMapStore.getState()
      const undo = { ve: store.undo, ignition: store.undoIgnition, lambda: store.undoLambda }[target]
      const redo = { ve: store.redo, ignition: store.redoIgnition, lambda: store.redoLambda }[target]

      if (e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo(); else undo()
      }
      if (e.key.toLowerCase() === 'y' && !e.shiftKey) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [location])

  return (
    <div className="flex flex-col h-full">
      <nav className="flex items-center gap-1 px-4 pt-2 border-b border-gray-800 flex-shrink-0">
        <MapaTabLink to="arquivo" label="Arquivo" />
        <MapaTabLink to="ve" label="Eficiência Volumétrica" />
        <MapaTabLink to="ignition" label="Ignition" />
        <MapaTabLink to="lambda" label="Lambda" />
      </nav>

      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
