import { useBusyStore } from '@/store/busyStore'

function afterFrames(n: number, cb: () => void): void {
  requestAnimationFrame(() => (n <= 1 ? cb() : afterFrames(n - 1, cb)))
}

/**
 * Roda `fn` (trabalho pesado e síncrono, ex.: aplicar um filtro que recalcula todas as telas) só
 * depois de o navegador pintar o bloqueio "trabalhando…" e o que o chamador acabou de fechar/mudar
 * (ex.: uma dialog). O bloqueio sai dois quadros depois de `fn` e do render que ela provocou.
 */
export function runWithBusy(message: string, fn: () => void): void {
  const { show, hide } = useBusyStore.getState()
  const id = show(message)
  afterFrames(2, () => {
    try { fn() } finally { afterFrames(2, () => hide(id)) }
  })
}
