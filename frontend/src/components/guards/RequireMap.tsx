import { Link } from 'react-router-dom'
import { useMapStore } from '@/store/mapStore'
import { useSessionStore } from '@/store/sessionStore'
import { SessionRestoringSpinner } from './SessionRestoringSpinner'

interface Props {
  children: React.ReactNode
}

function NoMapNotice() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6 py-16">
      <div>
        <h2 className="text-xl font-semibold text-gray-300">Nenhum mapa carregado</h2>
        <p className="text-sm text-gray-500 mt-1">Importe um arquivo CSV da MasterInjection na aba Arquivo para usar esta aba.</p>
      </div>
      <Link
        to="/mapa/arquivo"
        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
      >
        Ir para Arquivo
      </Link>
    </div>
  )
}

export function RequireMap({ children }: Props) {
  const isRestoring = useSessionStore((s) => s.isRestoring)
  const originalMap = useMapStore((s) => s.originalMap)

  if (isRestoring) return <SessionRestoringSpinner />
  if (originalMap === null) return <NoMapNotice />
  return <>{children}</>
}
