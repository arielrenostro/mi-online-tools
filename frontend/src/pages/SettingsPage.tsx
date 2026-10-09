import { ConstantsPanel } from '@/features/settings/ConstantsPanel'
import { WeightingPanel } from '@/features/settings/WeightingPanel'
import { useSessionStore } from '@/store/sessionStore'
import { SessionRestoringSpinner } from '@/components/guards/SessionRestoringSpinner'

/**
 * Configurações: destino de topo, sem guard (não exige mapa nem log). Hospeda as Constantes que
 * alimentam os sinais VE Lambda Corrigido, Potência e Torque e a constante k do Ponderado da correção.
 */
export default function SettingsPage() {
  const isRestoring = useSessionStore(s => s.isRestoring)
  if (isRestoring) return <SessionRestoringSpinner />

  return (
    <div className="max-w-2xl mx-auto px-6 py-6 flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-gray-100">Configurações</h1>
      <ConstantsPanel />
      <div className="border-t border-gray-800" />
      <WeightingPanel />
    </div>
  )
}
