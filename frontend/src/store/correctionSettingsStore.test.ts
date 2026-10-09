import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/persistence/localStorage', () => ({
  lsSet:   vi.fn(),
  lsGet:   vi.fn(() => null),
  lsClear: vi.fn(),
}))

import { useCorrectionSettingsStore, sanitizeCorrectionSettings, DEFAULT_CORRECTION_SETTINGS } from './correctionSettingsStore'
import { lsSet } from '@/persistence/localStorage'

beforeEach(() => {
  useCorrectionSettingsStore.setState({ values: DEFAULT_CORRECTION_SETTINGS })
  vi.mocked(lsSet).mockClear()
})

describe('correctionSettingsStore', () => {
  it('starts with k = 100', () => {
    expect(useCorrectionSettingsStore.getState().values.confidenceK).toBe(100)
  })

  it('set stores a valid k and persists it', () => {
    useCorrectionSettingsStore.getState().set({ confidenceK: 40 })
    expect(useCorrectionSettingsStore.getState().values.confidenceK).toBe(40)
    expect(lsSet).toHaveBeenCalledWith('miot:correction-settings', { confidenceK: 40 })
  })

  it('accepts zero (no damping) but ignores negative and non-finite values', () => {
    useCorrectionSettingsStore.getState().set({ confidenceK: 0 })
    expect(useCorrectionSettingsStore.getState().values.confidenceK).toBe(0)
    useCorrectionSettingsStore.getState().set({ confidenceK: -5 })
    useCorrectionSettingsStore.getState().set({ confidenceK: NaN })
    useCorrectionSettingsStore.getState().set({ confidenceK: Infinity })
    expect(useCorrectionSettingsStore.getState().values.confidenceK).toBe(0)
  })

  it('reset returns to 100 and persists', () => {
    useCorrectionSettingsStore.getState().set({ confidenceK: 7 })
    useCorrectionSettingsStore.getState().reset()
    expect(useCorrectionSettingsStore.getState().values.confidenceK).toBe(100)
    expect(lsSet).toHaveBeenLastCalledWith('miot:correction-settings', { confidenceK: 100 })
  })

  it('hydrate restores a saved value and falls back to the default for garbage', () => {
    useCorrectionSettingsStore.getState().hydrate({ confidenceK: 250 })
    expect(useCorrectionSettingsStore.getState().values.confidenceK).toBe(250)
    for (const bad of [null, 'x', 42, {}, { confidenceK: -1 }, { confidenceK: 'a' }]) {
      expect(sanitizeCorrectionSettings(bad)).toEqual({ confidenceK: 100 })
    }
  })
})
