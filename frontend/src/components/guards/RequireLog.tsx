import { Navigate } from 'react-router-dom'
import { useLogStore } from '@/store/logStore'
import { useSessionStore } from '@/store/sessionStore'
import { SessionRestoringSpinner } from './SessionRestoringSpinner'

interface Props {
  children: React.ReactNode
}

export function RequireLog({ children }: Props) {
  const isRestoring = useSessionStore((s) => s.isRestoring)
  const activeLogs = useLogStore((s) => s.logs.filter((l) => l.enabled))

  if (isRestoring) return <SessionRestoringSpinner />
  if (activeLogs.length === 0) return <Navigate to="/" replace />
  return <>{children}</>
}
