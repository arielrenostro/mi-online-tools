import { useEffect } from 'react'
import { useBusyStore, busyMessage } from '@/store/busyStore'
import { useLogStore } from '@/store/logStore'

/** Abaixo disso o trabalho é rápido demais para valer um bloqueio (que só piscaria). */
export const BLOCK_MIN_ROWS = 5000
/** Rede de segurança: se algo nunca terminar, o bloqueio é liberado depois disso. */
const WATCHDOG_MS = 60_000

/**
 * Modal sem botão de fechar, sobre a tela inteira, enquanto houver trabalho pesado em andamento
 * (gráficos redesenhando, filtro sendo aplicado...). Impede cliques e teclas: tudo o que o usuário
 * fizesse durante o travamento ficava na fila e rodava depois, bagunçando o estado.
 */
export function BusyHost() {
  const items = useBusyStore(s => s.items)
  const reset = useBusyStore(s => s.reset)
  const rows  = useLogStore(s => s.logs.reduce((n, l) => (l.enabled ? n + l.model.rows.length : n), 0))
  const blocking = items.length > 0 && rows >= BLOCK_MIN_ROWS

  // Sobra de um bloqueio anterior (ex.: recarga de módulo em desenvolvimento) nunca pode deixar a tela inerte.
  useEffect(() => { document.getElementById('root')?.removeAttribute('inert') }, [])

  useEffect(() => {
    if (!blocking) return
    // `inert` tira o resto da tela do alcance de mouse e teclado; o foco sai de campos/botões.
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    const watchdog = setTimeout(() => {
      console.warn('BusyHost: bloqueio liberado após', WATCHDOG_MS, 'ms sem terminar')
      reset()
    }, WATCHDOG_MS)
    return () => { root?.removeAttribute('inert'); clearTimeout(watchdog) }
  }, [blocking, reset])

  if (!blocking) return null
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={busyMessage(items)}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 cursor-wait"
    >
      <div className="flex items-center gap-3 rounded-lg border border-gray-600 bg-gray-800 px-6 py-4 text-sm text-gray-100 shadow-2xl">
        <span className="w-5 h-5 rounded-full border-2 border-gray-500 border-t-blue-400 animate-spin" />
        {busyMessage(items)}
      </div>
    </div>
  )
}
