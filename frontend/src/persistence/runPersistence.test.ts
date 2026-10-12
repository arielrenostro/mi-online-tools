import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CorrectionRun } from '@/types/correction'

const stored: unknown[] = []
vi.mock('./db', () => ({
  getDB: async () => ({
    // IndexedDB stores a structured clone: that is what a read after a write returns.
    put:    async (_store: string, v: unknown) => { stored.push(structuredClone(v)) },
    getAll: async () => stored.map(v => structuredClone(v)),
    delete: async () => {},
  }),
}))

import { saveRun, loadAllRuns } from './runPersistence'

const base = {
  breakpoints: { map: [90, 80], rpm: [3200, 3600] },
  recipe:      { logs: [], filter: null },
}

beforeEach(() => { stored.length = 0 })

describe('runPersistence', () => {
  it('a run with samples round-trips with the same samples', async () => {
    const run: CorrectionRun = { id: 'a', name: 'a', createdAt: 2, ...base, samples: new Float64Array([90, 3200, 55.5, 85, 3350, 61.25]) }
    await saveRun(run)
    const [loaded] = await loadAllRuns()
    expect(loaded.samples).toBeInstanceOf(Float64Array)
    expect(Array.from(loaded.samples!)).toEqual([90, 3200, 55.5, 85, 3350, 61.25])
    expect(loaded.cells).toBeUndefined()
  })

  it('a run saved before samples existed loads as a run without samples, keeping its old cells', async () => {
    const legacyCells = [[{ n: 3, mean: 55, median: 55 }]]
    stored.push({ id: 'old', name: 'old', createdAt: 1, ...base, cells: legacyCells })
    const [loaded] = await loadAllRuns()
    expect(loaded.samples).toBeNull()
    expect(loaded.cells).toEqual(legacyCells)
  })

  it('returns the newest run first', async () => {
    stored.push({ id: 'old', name: 'old', createdAt: 1, ...base, cells: [] })
    await saveRun({ id: 'new', name: 'new', createdAt: 2, ...base, samples: new Float64Array([1, 2, 3]) })
    expect((await loadAllRuns()).map(r => r.id)).toEqual(['new', 'old'])
  })
})
