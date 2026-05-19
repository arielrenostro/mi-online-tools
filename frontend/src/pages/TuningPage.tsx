import { useState, useEffect } from 'react'
import { useTuningStore } from '@/store/tuningStore'
import { useMapStore } from '@/store/mapStore'
import { listEngines } from '@/api/engines'
import type { EngineInfo } from '@/types/engine'
import TopBar from '@/features/tuning/TopBar'
import LogsPanel from '@/features/tuning/LogsPanel'
import TuningConfigModal from '@/features/tuning/TuningConfigModal'
import OriginalMapSection from '@/features/tuning/OriginalMapSection'
import EditableMapSection from '@/features/tuning/EditableMapSection'
import AnalysisSection from '@/features/tuning/AnalysisSection'

export default function TuningPage() {
  const [logsOpen,    setLogsOpen]    = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [engines,      setEngines]     = useState<EngineInfo[]>([])

  const config           = useTuningStore(s => s.config)
  const selectedEngineId = useTuningStore(s => s.selectedEngineId)
  const updateConfig     = useTuningStore(s => s.updateConfig)
  const resetConfig      = useTuningStore(s => s.resetConfig)
  const setEngine        = useTuningStore(s => s.setEngine)

  useEffect(() => {
    listEngines().then(setEngines).catch(() => { /* non-fatal */ })
  }, [])

  // Global undo/redo — skips when focus is inside an input or textarea
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      const tag = (e.target as HTMLElement)?.tagName ?? ''
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) useMapStore.getState().redo()
        else            useMapStore.getState().undo()
      }
      if (e.key.toLowerCase() === 'y' && !e.shiftKey) {
        e.preventDefault()
        useMapStore.getState().redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const selectedEngine = engines.find(e => e.engineId === selectedEngineId)

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <TopBar onLogsClick={() => setLogsOpen(true)} onSettingsClick={() => setSettingsOpen(true)} />

      {/* Engine selector tabs */}
      <div className="flex items-center gap-1 px-5 pt-3 border-b border-gray-800 flex-shrink-0">
        {engines.map(engine => (
          <button
            key={engine.engineId}
            onClick={() => setEngine(engine.engineId)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              engine.engineId === selectedEngineId
                ? 'border-blue-500 text-blue-400 bg-gray-800'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {engine.name}
          </button>
        ))}
        {/* Locked tabs */}
        {(['Ignição', 'Lambda', 'Boost'] as const).map(name => (
          <button
            key={name}
            disabled
            className="px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 border-transparent text-gray-700 cursor-not-allowed"
          >
            {name} 🔒
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto py-4 space-y-4">
          <OriginalMapSection />
          <EditableMapSection />
          <AnalysisSection />
        </div>
      </main>

      <LogsPanel open={logsOpen} onClose={() => setLogsOpen(false)} />

      <TuningConfigModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config}
        schema={selectedEngine?.configSchema}
        onUpdate={updateConfig}
        onReset={resetConfig}
      />
    </div>
  )
}
