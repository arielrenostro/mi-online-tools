import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { TimeSelection } from '@/types/datalog'
import { lsSet } from '@/persistence/localStorage'

interface TimeState {
  cursor_ms:       number | null
  selection:       TimeSelection | null
  sparklineSensor: string
  chartZoom:       TimeSelection | null
}

interface TimeActions {
  setCursor(ms: number | null): void
  setSelection(start: number, end: number): void
  clearSelection(): void
  setSparklineSensor(signal: string): void
  setChartZoom(start: number, end: number): void
  clearChartZoom(): void
  onTotalDurationChanged(newTotal_ms: number): void
  hydrate(data: { cursor_ms: number | null; selection: TimeSelection | null; sparklineSensor: string }): void
}

function persistTime(state: Partial<TimeState>): void {
  lsSet('miot:time', {
    cursor_ms:       state.cursor_ms ?? null,
    selection:       state.selection ?? null,
    sparklineSensor: state.sparklineSensor ?? 'RPM',
  })
}

export const useTimeStore = create<TimeState & TimeActions>()(
  subscribeWithSelector((set, get) => ({
    cursor_ms:       null,
    selection:       null,
    sparklineSensor: 'RPM',
    chartZoom:       null,

    setCursor(ms) {
      if (ms === null) {
        set({ cursor_ms: null })
        persistTime({ ...get(), cursor_ms: null })
        return
      }
      const clamped = Math.max(0, ms)
      set({ cursor_ms: clamped })
      persistTime({ ...get(), cursor_ms: clamped })
    },

    setSelection(start, end) {
      if (start >= end) return
      const s = Math.max(0, start)
      const e = Math.max(0, end)
      if (s >= e) return
      const selection: TimeSelection = { start_ms: s, end_ms: e }
      set({ selection })
      persistTime({ ...get(), selection })
    },

    clearSelection() {
      set({ selection: null })
      persistTime({ ...get(), selection: null })
    },

    setSparklineSensor(signal) {
      set({ sparklineSensor: signal })
      persistTime({ ...get(), sparklineSensor: signal })
    },

    setChartZoom(start, end) {
      if (start >= end) return
      set({ chartZoom: { start_ms: start, end_ms: end } })
    },

    clearChartZoom() { set({ chartZoom: null }) },

    onTotalDurationChanged(newTotal_ms) {
      const { cursor_ms, selection } = get()
      const updates: Partial<TimeState> = {}

      if (cursor_ms !== null) {
        if (newTotal_ms === 0) updates.cursor_ms = null
        else if (cursor_ms > newTotal_ms) updates.cursor_ms = newTotal_ms
      }

      if (selection !== null) {
        if (newTotal_ms === 0 || selection.start_ms >= newTotal_ms) {
          updates.selection = null
        } else if (selection.end_ms > newTotal_ms) {
          updates.selection = { start_ms: selection.start_ms, end_ms: newTotal_ms }
          if (updates.selection.start_ms >= updates.selection.end_ms) updates.selection = null
        }
      }

      if (Object.keys(updates).length > 0) {
        set(updates)
        persistTime({ ...get(), ...updates })
      }
    },

    hydrate({ cursor_ms, selection, sparklineSensor }) {
      set({ cursor_ms, selection, sparklineSensor })
    },
  }))
)
