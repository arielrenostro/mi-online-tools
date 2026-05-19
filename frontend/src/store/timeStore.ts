import { create } from 'zustand'
import type { TimeSelection } from '@/types/datalog'

// Minimal time store — selection is always null (use all data) in the tuning-only UI.
// The logStore calls onTotalDurationChanged on toggle/remove; we just no-op it.
interface TimeState {
  selection: TimeSelection | null
}
interface TimeActions {
  clearSelection(): void
  onTotalDurationChanged(_newTotal: number): void
}

export const useTimeStore = create<TimeState & TimeActions>()((set) => ({
  selection: null,
  clearSelection:           () => set({ selection: null }),
  onTotalDurationChanged:   () => { /* no-op — no TimeRail in this UI */ },
}))
