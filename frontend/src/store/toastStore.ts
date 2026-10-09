import { create } from 'zustand'

export const TOAST_DURATION_MS = 6000

export interface Toast {
  id:           number
  message:      string
  actionLabel?: string
  /** Roda só quando o usuário clica na ação — um toast nunca navega sozinho. */
  onAction?:    () => void
}

interface ToastState {
  toasts: Toast[]
}
interface ToastActions {
  show(toast: Omit<Toast, 'id'>): number
  dismiss(id: number): void
}

let nextId = 1

export const useToastStore = create<ToastState & ToastActions>()((set, get) => ({
  toasts: [],

  show(toast) {
    const id = nextId++
    set({ toasts: [...get().toasts, { ...toast, id }] })
    setTimeout(() => get().dismiss(id), TOAST_DURATION_MS)
    return id
  },

  dismiss(id) {
    set({ toasts: get().toasts.filter(t => t.id !== id) })
  },
}))
