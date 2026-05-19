import { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useMapStore } from '@/store/mapStore'
import { exportMapCsv, downloadCsv } from '@/utils/mapExporter'
import { TuningTabLink } from '@/components/TuningTabLink'

export default function TuningPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const location = useLocation()

  const originalMap        = useMapStore(s => s.originalMap)
  const editableMap        = useMapStore(s => s.editableMap)
  const editableIgnitionMap = useMapStore(s => s.editableIgnitionMap)
  const editableLambdaMap  = useMapStore(s => s.editableLambdaMap)
  const loadMap            = useMapStore(s => s.loadMap)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      const tag = (e.target as HTMLElement)?.tagName ?? ''
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const path        = location.pathname
      const isIgnition  = path.includes('/ignition')
      const isLambda    = path.includes('/lambda')
      const store       = useMapStore.getState()

      if (e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (isIgnition) { if (e.shiftKey) store.redoIgnition(); else store.undoIgnition() }
        else if (isLambda) { if (e.shiftKey) store.redoLambda(); else store.undoLambda() }
        else { if (e.shiftKey) store.redo(); else store.undo() }
      }
      if (e.key.toLowerCase() === 'y' && !e.shiftKey) {
        e.preventDefault()
        if (isIgnition) store.redoIgnition()
        else if (isLambda) store.redoLambda()
        else store.redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [location])

  function handleExport() {
    if (!originalMap || !editableMap) return
    const content = exportMapCsv(
      originalMap.rawLines,
      editableMap,
      editableIgnitionMap,
      editableLambdaMap,
    )
    downloadCsv(content, `${originalMap.name.replace(/\.csv$/i, '')}_tuned.csv`)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) await loadMap(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full">
      <nav className="flex items-center gap-1 px-4 pt-2 border-b border-gray-800 flex-shrink-0">
        <TuningTabLink to="ve" label="VE" />
        <TuningTabLink to="ignition" label="Ignition" />
        <TuningTabLink to="lambda" label="Lambda" />

        <div className="ml-auto mb-1 relative">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
            title="Ações"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <circle cx="8" cy="2.5"  r="1.5" />
              <circle cx="8" cy="8"    r="1.5" />
              <circle cx="8" cy="13.5" r="1.5" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[180px] py-1">
                <button
                  onClick={() => { setMenuOpen(false); fileRef.current?.click() }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Importar Mapa
                </button>
                <button
                  onClick={() => { setMenuOpen(false); handleExport() }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M8 11l4 4 4-4M12 4v11" />
                  </svg>
                  Exportar Mapa
                </button>
              </div>
            </>
          )}
        </div>
      </nav>

      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
