import { useState, useEffect, useRef } from 'react'
import { useMapStore } from '@/store/mapStore'
import { useTuningStore } from '@/store/tuningStore'
import { useLogStore } from '@/store/logStore'
import { listEngines } from '@/api/engines'
import {
  loadHistoryForMap,
  deleteHistoryEntry,
  saveHistoryEntry,
} from '@/persistence/tuningHistoryPersistence'
import type { TuningHistoryEntry } from '@/types/tuningHistory'
import type { TuningConfig } from '@/types/tuning'
import type { EngineInfo } from '@/types/engine'
import AnalysisSection from './AnalysisSection'
import TuningConfigForm from './TuningConfigForm'

type Mode = 'history' | 'wizard-logs' | 'wizard-config' | 'wizard-running' | 'wizard-error'

interface Props {
  open:    boolean
  onClose: () => void
}

export default function AutoTuningModal({ open, onClose }: Props) {
  const originalMap       = useMapStore(s => s.originalMap)
  const applyTuningOutput = useMapStore(s => s.applyTuningOutput)
  const storedConfig      = useTuningStore(s => s.config)
  const runTuning         = useTuningStore(s => s.runTuning)
  const selectedEngineId  = useTuningStore(s => s.selectedEngineId)
  const logs              = useLogStore(s => s.logs)
  const addLog            = useLogStore(s => s.addLog)
  const isUploading       = useLogStore(s => s.isUploading)
  const lastError         = useLogStore(s => s.lastError)

  const fileRef = useRef<HTMLInputElement>(null)

  const [mode, setMode]             = useState<Mode>('history')
  const [history, setHistory]       = useState<TuningHistoryEntry[]>([])
  const [selectedEntry, setSelected] = useState<TuningHistoryEntry | null>(null)
  const [engines, setEngines]       = useState<EngineInfo[]>([])

  const [selectedHashes, setSelectedHashes] = useState<string[]>([])
  const [localConfig, setLocalConfig]       = useState<TuningConfig>(storedConfig)
  const [runError, setRunError]             = useState<string | null>(null)

  useEffect(() => {
    if (!open || !originalMap) return
    setMode('history')
    loadHistoryForMap(originalMap.name).then(entries => {
      setHistory(entries)
      setSelected(entries[0] ?? null)
    })
    listEngines().then(setEngines).catch(() => {})
  }, [open, originalMap])

  // Auto-select any newly added log so the user doesn't need to check it manually
  useEffect(() => {
    setSelectedHashes(prev => {
      const newHashes = logs.map(l => l.hash).filter(h => !prev.includes(h))
      return newHashes.length > 0 ? [...prev, ...newHashes] : prev
    })
  }, [logs])

  if (!open || !originalMap) return null

  const schema = engines.find(e => e.engineId === selectedEngineId)?.configSchema

  async function handleFiles(files: FileList | null) {
    if (!files) return
    for (const f of Array.from(files)) {
      if (f.name.endsWith('.csv')) await addLog(f)
    }
  }

  function handleDelete(id: string) {
    deleteHistoryEntry(id).then(() => {
      setHistory(prev => {
        const next = prev.filter(e => e.id !== id)
        if (selectedEntry?.id === id) setSelected(next[0] ?? null)
        return next
      })
    })
  }

  function handleApplyMap() {
    if (!selectedEntry) return
    applyTuningOutput(selectedEntry.output.suggestedMap)
    onClose()
  }

  function startWizard() {
    setSelectedHashes(logs.map(l => l.hash))
    setLocalConfig({ ...storedConfig })
    setRunError(null)
    setMode('wizard-logs')
  }

  async function executeRun() {
    if (!originalMap) return
    setMode('wizard-running')
    setRunError(null)
    try {
      const output = await runTuning({ logHashes: selectedHashes, config: localConfig })
      const logFilenames = selectedHashes.map(h => logs.find(l => l.hash === h)?.filename ?? h)
      const entry: TuningHistoryEntry = {
        id:           crypto.randomUUID(),
        mapName:      originalMap.name,
        timestamp:    Date.now(),
        logHashes:    selectedHashes,
        logFilenames,
        config:       localConfig,
        output,
      }
      await saveHistoryEntry(entry)
      setHistory(prev => [entry, ...prev])
      setSelected(entry)
      setMode('history')
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Erro desconhecido.')
      setMode('wizard-error')
    }
  }

  function renderHistoryPanel() {
    return (
      <>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 border-r border-gray-700 flex flex-col overflow-y-auto flex-shrink-0">
            {history.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8 px-3">
                Nenhum tuning realizado ainda
              </p>
            ) : (
              history.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => setSelected(entry)}
                  className={`group text-left px-3 py-2.5 border-b border-gray-800 hover:bg-gray-800 transition-colors relative ${
                    selectedEntry?.id === entry.id ? 'bg-gray-800' : ''
                  }`}
                >
                  <p className="text-xs text-gray-200 font-medium">
                    {new Date(entry.timestamp).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {entry.logFilenames.length} log{entry.logFilenames.length !== 1 ? 's' : ''}
                  </p>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(entry.id) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity p-0.5"
                    title="Deletar"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </button>
              ))
            )}
          </div>

          <div className="flex-1 overflow-auto p-4">
            {selectedEntry ? (
              <AnalysisSection output={selectedEntry.output} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-500 text-center">
                  Selecione um tuning no histórico<br />ou execute um novo
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 transition-colors"
          >
            Sair
          </button>
          <div className="flex gap-3">
            <button
              onClick={startWizard}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 transition-colors"
            >
              Novo Tuning
            </button>
            <button
              onClick={handleApplyMap}
              disabled={!selectedEntry}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedEntry
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              Aplicar Mapa
            </button>
          </div>
        </div>
      </>
    )
  }

  function renderWizardLogs() {
    return (
      <>
        <div className="flex-1 overflow-auto p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Etapa 1 — Selecionar Logs</h3>

          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            multiple
            className="hidden"
            onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
          />

          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <div className="text-center">
                <p className="text-sm text-gray-400 font-medium">Nenhum datalog carregado</p>
                <p className="text-xs text-gray-600 mt-1">Adicione arquivos CSV para continuar</p>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-gray-600 hover:border-gray-400 text-gray-400 hover:text-gray-200 text-sm transition-colors disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Carregando…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0-12L8 8m4-4l4 4M4 20h16" />
                    </svg>
                    Adicionar Datalog
                  </>
                )}
              </button>
              {lastError && (
                <p className="text-xs text-red-400 text-center max-w-xs">{lastError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <label key={log.hash} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedHashes.includes(log.hash)}
                    onChange={e =>
                      setSelectedHashes(prev =>
                        e.target.checked ? [...prev, log.hash] : prev.filter(h => h !== log.hash)
                      )
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-gray-200">{log.filename}</span>
                </label>
              ))}

              <div className="pt-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Carregando…
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v8m0 0l-3-3m3 3l3-3M4 16h16" />
                      </svg>
                      Adicionar datalog
                    </>
                  )}
                </button>
                {lastError && (
                  <p className="text-xs text-red-400 mt-1">{lastError}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={() => setMode('history')}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => setMode('wizard-config')}
            disabled={selectedHashes.length === 0}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedHashes.length > 0
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            Avançar →
          </button>
        </div>
      </>
    )
  }

  function renderWizardConfig() {
    return (
      <>
        <div className="flex-1 flex flex-col overflow-hidden">
          <h3 className="text-sm font-semibold text-gray-200 px-6 pt-5 pb-0 flex-shrink-0">
            Etapa 2 — Configurar Parâmetros
          </h3>
          <TuningConfigForm local={localConfig} schema={schema} setLocal={setLocalConfig} />
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={() => setMode('wizard-logs')}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 transition-colors"
          >
            ← Voltar
          </button>
          <button
            onClick={executeRun}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white font-medium transition-colors"
          >
            Executar Tuning
          </button>
        </div>
      </>
    )
  }

  function renderWizardRunning() {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="w-8 h-8 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-sm text-gray-300">Executando auto-tuning…</p>
        </div>
      </div>
    )
  }

  function renderWizardError() {
    return (
      <>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-3">
            <p className="text-red-400 text-sm font-semibold">Erro na execução</p>
            <p className="text-gray-400 text-xs max-w-md">{runError}</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={() => setMode('history')}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => setMode('wizard-config')}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white font-medium transition-colors"
          >
            ← Tentar Novamente
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-100">Auto Tuning</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100 text-xl leading-none">×</button>
        </div>

        {mode === 'history'        && renderHistoryPanel()}
        {mode === 'wizard-logs'    && renderWizardLogs()}
        {mode === 'wizard-config'  && renderWizardConfig()}
        {mode === 'wizard-running' && renderWizardRunning()}
        {mode === 'wizard-error'   && renderWizardError()}
      </div>
    </div>
  )
}
