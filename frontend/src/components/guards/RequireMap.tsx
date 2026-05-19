import { useRef } from 'react'
import { useMapStore } from '@/store/mapStore'
import { useSessionStore } from '@/store/sessionStore'
import { SessionRestoringSpinner } from './SessionRestoringSpinner'

interface Props {
  children: React.ReactNode
}

function UploadIcon() {
  return (
    <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

function MapUploadScreen() {
  const fileRef = useRef<HTMLInputElement>(null)
  const loadMap = useMapStore((s) => s.loadMap)
  const isLoading = useMapStore((s) => s.isLoading)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) await loadMap(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-6">
      <UploadIcon />
      <div>
        <h2 className="text-xl font-semibold text-gray-300">Nenhum mapa carregado</h2>
        <p className="text-sm text-gray-500 mt-1">Importe um arquivo CSV da MasterInjection para acessar o Tuning.</p>
      </div>
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={isLoading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        {isLoading ? 'Importando…' : 'Importar Mapa CSV'}
      </button>
    </div>
  )
}

export function RequireMap({ children }: Props) {
  const isRestoring = useSessionStore((s) => s.isRestoring)
  const originalMap = useMapStore((s) => s.originalMap)

  if (isRestoring) return <SessionRestoringSpinner />
  if (originalMap === null) return <MapUploadScreen />
  return <>{children}</>
}
