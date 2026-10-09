import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { createSerialQueue } from '@/utils/serialQueue'
import { useBusy } from '@/hooks/useBusy'

const nextFrame = (cb: () => void) => { requestAnimationFrame(() => cb()) }

/** Uma fila para todos os gráficos: aplicam um por vez, e o navegador atende cliques entre eles. */
export const applyQueue = createSerialQueue(nextFrame)

/**
 * Entrega `value` só depois de o navegador pintar dois quadros e de chegar a vez dele numa fila
 * compartilhada. Serve a trabalho pesado e síncrono disparado por esse valor (ex.: o ECharts
 * reprocessando dezenas de milhares de pontos): enquanto `pending` é true dá para mostrar um
 * "carregando" que de fato aparece; e como vários gráficos aplicam um por quadro, em vez de todos
 * numa tarefa longa, a tela segue respondendo (e os cliques não se acumulam para depois).
 * Mudanças em sequência são unificadas: só o último valor chega a ser aplicado.
 *
 * `shown` é `null` até a primeira entrega (a montagem também espera a pintura).
 */
export function useAfterPaint<T>(value: T): { shown: T | null; pending: boolean } {
  const [shown, setShown] = useState<{ v: T } | null>(null)

  useEffect(() => {
    if (shown && Object.is(shown.v, value)) return
    let cancelled = false
    let first = 0, second = 0
    first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        applyQueue.enqueue(() => {
          if (cancelled) return false
          // flushSync: o trabalho pesado do gráfico acontece aqui, não numa tarefa agendada depois
          flushSync(() => setShown({ v: value }))
          return true
        })
      })
    })
    return () => { cancelled = true; cancelAnimationFrame(first); cancelAnimationFrame(second) }
  }, [value, shown])

  const pending = !shown || !Object.is(shown.v, value)
  useBusy(pending) // enquanto algum gráfico carrega, a tela fica bloqueada (ver `BusyHost`)
  return { shown: shown ? shown.v : null, pending }
}
