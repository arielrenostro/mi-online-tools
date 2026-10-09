import { useEffect } from 'react'
import { useBusyStore } from '@/store/busyStore'

/** Mantém a tela bloqueada ("Carregando…") enquanto `active` for true. */
export function useBusy(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const id = useBusyStore.getState().show()
    return () => useBusyStore.getState().hide(id)
  }, [active])
}
