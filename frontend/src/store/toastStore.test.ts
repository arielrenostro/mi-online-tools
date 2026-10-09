import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useToastStore, TOAST_DURATION_MS } from './toastStore'

beforeEach(() => {
  vi.useFakeTimers()
  useToastStore.setState({ toasts: [] })
})
afterEach(() => vi.useRealTimers())

describe('toastStore', () => {
  it('shows a toast and removes it by itself after the duration', () => {
    useToastStore.getState().show({ message: 'Run gerado' })
    expect(useToastStore.getState().toasts.map(t => t.message)).toEqual(['Run gerado'])
    vi.advanceTimersByTime(TOAST_DURATION_MS - 1)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('dismiss removes only the given toast', () => {
    const a = useToastStore.getState().show({ message: 'a' })
    useToastStore.getState().show({ message: 'b' })
    useToastStore.getState().dismiss(a)
    expect(useToastStore.getState().toasts.map(t => t.message)).toEqual(['b'])
  })

  it('never runs the action by itself, not even when the toast expires', () => {
    const onAction = vi.fn()
    useToastStore.getState().show({ message: 'x', actionLabel: 'Ver', onAction })
    vi.advanceTimersByTime(TOAST_DURATION_MS * 2)
    expect(onAction).not.toHaveBeenCalled()
  })
})
