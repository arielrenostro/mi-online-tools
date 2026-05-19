import { useRef } from 'react'
import { useLogStore } from '@/store/logStore'

interface Props {
  open:    boolean
  onClose: () => void
}

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

export default function LogsPanel({ open, onClose }: Props) {
  const fileRef   = useRef<HTMLInputElement>(null)
  const logs      = useLogStore(s => s.logs)
  const isUpload  = useLogStore(s => s.isUploading)
  const lastError = useLogStore(s => s.lastError)
  const addLog    = useLogStore(s => s.addLog)
  const removeLog = useLogStore(s => s.removeLog)
  const toggleLog = useLogStore(s => s.toggleLog)

  if (!open) return null

  async function handleFiles(files: FileList | null) {
    if (!files) return
    for (const f of Array.from(files)) {
      if (f.name.endsWith('.csv')) await addLog(f)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-gray-900 border-l border-gray-700 h-full w-96 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="font-semibold text-gray-100">Datalogs</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>

        {/* Drop zone */}
        <div
          className="mx-4 mt-4 border-2 border-dashed border-gray-600 rounded-lg p-5 text-center cursor-pointer hover:border-blue-500 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          {isUpload ? (
            <span className="text-sm text-blue-400 animate-pulse">Carregando…</span>
          ) : (
            <>
              <p className="text-sm text-gray-300">Arraste CSVs de datalog aqui</p>
              <p className="text-xs text-gray-500 mt-1">ou clique para selecionar</p>
            </>
          )}
        </div>

        {lastError && (
          <p className="mx-4 mt-2 text-xs text-red-400 bg-red-950 rounded p-2">{lastError}</p>
        )}

        {/* Log list */}
        <div className="flex-1 overflow-y-auto mt-4 px-4 space-y-2 pb-4">
          {logs.length === 0 && (
            <p className="text-xs text-gray-500 text-center mt-8">Nenhum log carregado</p>
          )}
          {logs.map(log => (
            <div
              key={log.hash}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                log.enabled ? 'bg-gray-800 border-gray-600' : 'bg-gray-850 border-gray-700 opacity-60'
              }`}
            >
              {/* Toggle */}
              <button
                onClick={() => toggleLog(log.hash)}
                className={`w-9 h-5 rounded-full flex-shrink-0 transition-colors relative ${
                  log.enabled ? 'bg-blue-600' : 'bg-gray-600'
                }`}
                title={log.enabled ? 'Desativar' : 'Ativar'}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    log.enabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-200 truncate font-medium">{log.filename}</p>
                <p className="text-xs text-gray-500">{fmtDuration(log.duration_ms)}</p>
              </div>

              {/* Remove */}
              <button
                onClick={() => removeLog(log.hash)}
                className="text-gray-500 hover:text-red-400 text-lg leading-none flex-shrink-0"
                title="Remover"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
