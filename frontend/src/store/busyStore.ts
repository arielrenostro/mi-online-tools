import { create } from 'zustand'

export const DEFAULT_BUSY_MESSAGE = 'Carregando…'

interface BusyItem { id: number; message?: string }

interface BusyState {
  /** Operações pesadas em andamento (a tela fica bloqueada enquanto houver alguma — ver `BusyHost`). */
  items: BusyItem[]
  /** Registra uma operação; devolve o id para `hide`. Sem `message`, vale o texto padrão. */
  show(message?: string): number
  hide(id: number): void
  /** Descarta tudo (rede de segurança contra operação que nunca terminou). */
  reset(): void
}

let nextId = 1

/** Estado global "trabalhando…". Efêmero, nada é persistido. */
export const useBusyStore = create<BusyState>()((set) => ({
  items: [],
  show: message => {
    const id = nextId++
    set(s => ({ items: [...s.items, { id, message }] }))
    return id
  },
  hide: id => set(s => (s.items.some(i => i.id === id) ? { items: s.items.filter(i => i.id !== id) } : s)),
  reset: () => set({ items: [] }),
}))

/** Texto a mostrar: o da operação explícita mais recente, ou o padrão. */
export function busyMessage(items: BusyItem[]): string {
  for (let i = items.length - 1; i >= 0; i--) if (items[i].message) return items[i].message!
  return DEFAULT_BUSY_MESSAGE
}
