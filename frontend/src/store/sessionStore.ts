import { create } from 'zustand'

interface SessionState {
  isRestoring: boolean
}
interface SessionActions {
  setRestoringDone(): void
}

export const useSessionStore = create<SessionState & SessionActions>()((set) => ({
  isRestoring: true,
  setRestoringDone: () => set({ isRestoring: false }),
}))
