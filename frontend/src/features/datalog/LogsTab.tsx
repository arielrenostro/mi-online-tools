import { useRef } from 'react'
import { useLogStore } from '@/store/logStore'
import type { LogEntry } from '@/types/datalog'

function fmtDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function DragHandle() {
  return (
    <svg
      className="w-4 h-4 text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0"
      fill="currentColor"
      viewBox="0 0 16 16"
    >
      <circle cx="5" cy="4"  r="1.2" />
      <circle cx="5" cy="8"  r="1.2" />
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="11" cy="4"  r="1.2" />
      <circle cx="11" cy="8"  r="1.2" />
      <circle cx="11" cy="12" r="1.2" />
    </svg>
  )
}

interface LogItemProps {
  log: LogEntry
  index: number
  isDraggingOver: boolean
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDrop: (index: number) => void
  onDragEnd: () => void
  onToggle: (hash: string) => void
  onRemove: (hash: string) => void
}

function LogItem({
  log, index, isDraggingOver,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onToggle, onRemove,
}: LogItemProps) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => { e.preventDefault(); onDragOver(e, index) }}
      onDrop={() => onDrop(index)}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors select-none ${
        log.enabled ? 'bg-gray-800 border-gray-600' : 'bg-gray-900 border-gray-700 opacity-60'
      } ${isDraggingOver ? 'border-t-2 border-t-blue-500' : ''}`}
    >
      <DragHandle />

      <button
        onClick={() => onToggle(log.hash)}
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

      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-200 font-medium truncate">{log.filename}</p>
        <p className="text-xs text-gray-500">{fmtDuration(log.duration_ms)}</p>
      </div>

      <button
        onClick={() => onRemove(log.hash)}
        className="text-gray-500 hover:text-red-400 text-lg leading-none flex-shrink-0 transition-colors"
        title="Remover"
      >
        ×
      </button>
    </div>
  )
}

export function LogsTab() {
  const fileRef   = useRef<HTMLInputElement>(null)
  const dragIndex = useRef<number | null>(null)
  const overIndex = useRef<number | null>(null)

  const logs      = useLogStore(s => s.logs)
  const isUpload  = useLogStore(s => s.isUploading)
  const lastError = useLogStore(s => s.lastError)
  const addLog    = useLogStore(s => s.addLog)
  const removeLog = useLogStore(s => s.removeLog)
  const toggleLog = useLogStore(s => s.toggleLog)
  const reorder   = useLogStore(s => s.reorder)

  const totalActive = logs
    .filter(l => l.enabled)
    .reduce((acc, l) => acc + l.duration_ms, 0)

  async function handleFiles(files: FileList | null) {
    if (!files) return
    for (const f of Array.from(files)) {
      if (f.name.endsWith('.csv')) await addLog(f)
    }
  }

  function handleDragStart(index: number) {
    dragIndex.current = index
    overIndex.current = index
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    overIndex.current = index
  }

  function handleDrop(index: number) {
    if (dragIndex.current === null || dragIndex.current === index) return
    const hashes = logs.map(l => l.hash)
    const [moved] = hashes.splice(dragIndex.current, 1)
    hashes.splice(index, 0, moved)
    reorder(hashes)
    dragIndex.current = null
    overIndex.current = null
  }

  function handleDragEnd() {
    dragIndex.current = null
    overIndex.current = null
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-6 flex flex-col gap-4">
      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
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
            <p className="text-sm text-gray-300">Arraste arquivos CSV de datalog aqui</p>
            <p className="text-xs text-gray-500 mt-1">ou clique para selecionar</p>
          </>
        )}
      </div>

      {/* Error */}
      {lastError && (
        <p className="text-xs text-red-400 bg-red-950 border border-red-900 rounded px-3 py-2">
          {lastError}
        </p>
      )}

      {/* Log list */}
      {logs.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-8">
          Nenhum log carregado.<br />
          Arraste ou selecione arquivos CSV acima para começar.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {logs.map((log, index) => (
            <LogItem
              key={log.hash}
              log={log}
              index={index}
              isDraggingOver={overIndex.current === index && dragIndex.current !== null && dragIndex.current !== index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onToggle={toggleLog}
              onRemove={removeLog}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      {logs.length > 0 && (
        <p className="text-xs text-gray-500 text-right">
          Total ativo: <span className="text-gray-300">{fmtDuration(totalActive)}</span>
        </p>
      )}
    </div>
  )
}
