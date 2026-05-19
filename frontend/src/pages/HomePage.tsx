import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMapStore } from '@/store/mapStore'
import { useLogStore, selectActiveLogs } from '@/store/logStore'
import { useSessionStore } from '@/store/sessionStore'
import { SessionRestoringSpinner } from '@/components/guards/SessionRestoringSpinner'

function MapIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  )
}

function DatalogIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

interface StatusRowProps {
  ok: boolean
  label: string
}

function StatusRow({ ok, label }: StatusRowProps) {
  return (
    <div className={`flex items-center gap-2 text-sm ${ok ? 'text-green-400' : 'text-gray-500'}`}>
      <span className={`flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 ${ok ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-600'}`}>
        {ok ? <CheckIcon /> : <XIcon />}
      </span>
      {label}
    </div>
  )
}

interface CardProps {
  icon: React.ReactNode
  title: string
  description: string
  statuses: { ok: boolean; label: string }[]
  canOpen: boolean
  hint: string
  onClick: () => void
  onDrop?: (files: FileList) => void
}

function FeatureCard({ icon, title, description, statuses, canOpen, hint, onClick, onDrop }: CardProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (onDrop) onDrop(e.dataTransfer.files)
  }

  return (
    <div
      className={`relative flex flex-col gap-5 rounded-2xl border p-6 transition-colors ${
        canOpen
          ? 'bg-gray-900 border-gray-700 hover:border-gray-600'
          : 'bg-gray-900/60 border-gray-800'
      }`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-xl ${canOpen ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-800 text-gray-600'}`}>
          {icon}
        </div>
        <div>
          <h2 className={`text-lg font-semibold ${canOpen ? 'text-gray-100' : 'text-gray-500'}`}>{title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {statuses.map((s) => (
          <StatusRow key={s.label} ok={s.ok} label={s.label} />
        ))}
      </div>

      {canOpen ? (
        <button
          onClick={onClick}
          className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          Abrir {title}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      ) : (
        <div className="mt-auto">
          {onDrop && (
            <>
              <input ref={fileRef} type="file" accept=".csv" multiple className="hidden" onChange={(e) => { if (e.target.files && onDrop) onDrop(e.target.files) }} />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-dashed border-gray-700 hover:border-gray-500 text-gray-500 hover:text-gray-300 text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {hint}
              </button>
            </>
          )}
          {!onDrop && (
            <p className="text-center text-xs text-gray-600 py-2.5">{hint}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function HomePage() {
  const navigate   = useNavigate()
  const isRestoring = useSessionStore((s) => s.isRestoring)

  const originalMap  = useMapStore((s) => s.originalMap)
  const loadMap      = useMapStore((s) => s.loadMap)
  const activeLogs   = useLogStore(selectActiveLogs)
  const totalLogs    = useLogStore((s) => s.logs.length)
  const addLog       = useLogStore((s) => s.addLog)

  const hasMap  = originalMap !== null
  const hasLogs = activeLogs.length > 0

  async function handleMapDrop(files: FileList) {
    const csv = Array.from(files).find((f) => f.name.endsWith('.csv'))
    if (csv) await loadMap(csv)
  }

  async function handleLogsDrop(files: FileList) {
    for (const f of Array.from(files)) {
      if (f.name.endsWith('.csv')) await addLog(f)
    }
  }

  if (isRestoring) return <SessionRestoringSpinner />

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-100 tracking-tight">Bem-vindo ao Master Injection Online Tools</h1>
        <p className="text-gray-500 mt-2 text-base">
          Importe o mapa da ECU MasterInjection e datalogs de estrada para analisar desvios de lambda e corrigir o mapa de combustível.
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FeatureCard
          icon={<MapIcon />}
          title="Tuning"
          description="Analise e corrija o mapa de combustível (VE) com base em datalogs de estrada."
          statuses={[
            {
              ok: hasMap,
              label: hasMap ? `Mapa: ${originalMap!.name}` : 'Nenhum mapa carregado',
            },
          ]}
          canOpen={hasMap}
          hint="Importar mapa CSV"
          onClick={() => navigate('/tuning')}
          onDrop={handleMapDrop}
        />

        <FeatureCard
          icon={<DatalogIcon />}
          title="Datalog"
          description="Visualize e explore os dados capturados durante as rodadas de estrada."
          statuses={[
            {
              ok: hasLogs,
              label: hasLogs
                ? `${activeLogs.length} datalog${activeLogs.length > 1 ? 's' : ''} ativo${activeLogs.length > 1 ? 's' : ''}`
                : totalLogs > 0
                ? `${totalLogs} log${totalLogs > 1 ? 's' : ''} carregado${totalLogs > 1 ? 's' : ''}, nenhum ativo`
                : 'Nenhum datalog carregado',
            },
          ]}
          canOpen={hasLogs}
          hint="Importar datalogs CSV"
          onClick={() => navigate('/datalog')}
          onDrop={handleLogsDrop}
        />
      </div>

    </div>
  )
}
