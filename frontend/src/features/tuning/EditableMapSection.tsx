import { useMemo } from 'react'
import { useMapStore } from '@/store/mapStore'
import { useTuningStore } from '@/store/tuningStore'
import { useLogStore, selectActiveLogs } from '@/store/logStore'
import { exportMapCsv, downloadCsv } from '@/utils/mapExporter'
import HeatmapTable from '@/components/HeatmapTable'

export default function EditableMapSection() {
  const originalMap     = useMapStore(s => s.originalMap)
  const editableMap     = useMapStore(s => s.editableMap)
  const updateCell      = useMapStore(s => s.updateCell)
  const bulkUpdateCells = useMapStore(s => s.bulkUpdateCells)
  const resetEditable   = useMapStore(s => s.resetEditable)
  const isDirty         = useMapStore(s => s.isDirty)

  const isRunning   = useTuningStore(s => s.isRunning)
  const lastError   = useTuningStore(s => s.lastError)
  const configDirty = useTuningStore(s => s.configDirty)
  const lastOutput  = useTuningStore(s => s.lastOutput)
  const runTuning   = useTuningStore(s => s.runTuning)

  const activeLogs = useLogStore(selectActiveLogs)

  const modifiedCells = useMemo<Set<string>>(() => {
    if (!originalMap || !editableMap) return new Set()
    const s = new Set<string>()
    for (let r = 0; r < editableMap.length; r++) {
      for (let c = 0; c < editableMap[r].length; c++) {
        if (editableMap[r][c] !== originalMap.cells[r][c]) s.add(`${r}:${c}`)
      }
    }
    return s
  }, [originalMap, editableMap])

  if (!originalMap || !editableMap) {
    return (
      <section className="px-5 py-8 flex items-center justify-center">
        <p className="text-sm text-gray-500">Importe um mapa para começar.</p>
      </section>
    )
  }

  function handleExport() {
    if (!originalMap || !editableMap) return
    const content = exportMapCsv(originalMap.rawLines, editableMap)
    downloadCsv(content, `${originalMap.name.replace(/\.csv$/i, '')}_tuned.csv`)
  }

  const canRun = activeLogs.length > 0 && !isRunning

  return (
    <section className="px-5 pb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Mapa Editável
          {configDirty && lastOutput && (
            <span className="ml-2 text-yellow-400 normal-case font-normal">(parâmetros alterados)</span>
          )}
        </h2>

        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={resetEditable}
              className="px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 transition-colors"
            >
              Resetar
            </button>
          )}
          <button
            onClick={handleExport}
            className="px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 transition-colors"
          >
            Exportar CSV
          </button>
          <button
            onClick={runTuning}
            disabled={!canRun}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              canRun
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isRunning ? (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Calculando…
              </span>
            ) : 'Auto-tuning'}
          </button>
        </div>
      </div>

      {lastError && (
        <div className="mb-2 text-xs text-red-400 bg-red-950 rounded p-2">{lastError}</div>
      )}

      <HeatmapTable
        cells={editableMap}
        rowHeaders={originalMap.mapBreakpoints}
        colHeaders={originalMap.rpmBreakpoints}
        colorScale="warm"
        readOnly={false}
        onCellChange={updateCell}
        onBulkChange={bulkUpdateCells}
        modifiedCells={modifiedCells}
        formatValue={v => v === null ? '—' : String(v as number)}
      />
    </section>
  )
}
