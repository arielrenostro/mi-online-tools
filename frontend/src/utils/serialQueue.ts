/**
 * Fila que roda um trabalho por vez, esperando um quadro entre dois trabalhos que de fato rodaram.
 * Serve a trabalho pesado e síncrono (ex.: aplicar o `option` de cada gráfico): em vez de tudo de
 * uma vez numa tarefa longa, cada trabalho é uma tarefa curta e o navegador atende cliques e pinta
 * entre elas. `nextFrame` é injetado para testar sem navegador.
 *
 * Um trabalho devolve `true` se fez algo (então o próximo espera um quadro) ou `false` se foi
 * descartado (ex.: ficou obsoleto) — descartados não gastam quadro.
 */
export function createSerialQueue(nextFrame: (cb: () => void) => void) {
  const queue: (() => boolean)[] = []
  let running = false

  function step() {
    const job = queue.shift()
    if (!job) { running = false; return }
    let worked = false
    try {
      worked = job()
    } catch (e) {
      // um trabalho que quebra não pode travar a fila (nem, com ela, a tela bloqueada)
      console.error('serialQueue: trabalho falhou', e)
    }
    if (worked) nextFrame(step)
    else step()
  }

  return {
    enqueue(job: () => boolean): void {
      queue.push(job)
      if (running) return
      running = true
      step()
    },
  }
}
