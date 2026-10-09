import { describe, it, expect } from 'vitest'
import { dragSelection } from './railDrag'

const total = 10_000

describe('dragSelection', () => {
  it('creates a selection only after the drag passes the minimum, normalized left to right', () => {
    const drag = { type: 'selection', startMs: 5000 } as const
    expect(dragSelection(drag, 5100, null, total)).toBeNull()
    expect(dragSelection(drag, 6000, null, total)).toEqual({ start_ms: 5000, end_ms: 6000 })
    expect(dragSelection(drag, 4000, null, total)).toEqual({ start_ms: 4000, end_ms: 5000 })
  })

  it('moves the left handle without crossing the right end', () => {
    const base = { start_ms: 2000, end_ms: 6000 }
    const drag = { type: 'handle', side: 'left' } as const
    expect(dragSelection(drag, 1000, base, total)).toEqual({ start_ms: 1000, end_ms: 6000 })
    expect(dragSelection(drag, 9000, base, total)).toEqual({ start_ms: 5800, end_ms: 6000 })
  })

  it('moves the right handle without crossing the left end', () => {
    const base = { start_ms: 2000, end_ms: 6000 }
    const drag = { type: 'handle', side: 'right' } as const
    expect(dragSelection(drag, 8000, base, total)).toEqual({ start_ms: 2000, end_ms: 8000 })
    expect(dragSelection(drag, 0, base, total)).toEqual({ start_ms: 2000, end_ms: 2200 })
  })

  it('has nothing to drag a handle of without a selection', () => {
    expect(dragSelection({ type: 'handle', side: 'left' }, 100, null, total)).toBeNull()
  })

  it('moves the whole selection keeping its width, within the timeline', () => {
    const drag = { type: 'move', startMs: 3000, selStart: 2000, selEnd: 4000 } as const
    expect(dragSelection(drag, 4000, null, total)).toEqual({ start_ms: 3000, end_ms: 5000 })
    expect(dragSelection(drag, 0, null, total)).toEqual({ start_ms: 0, end_ms: 2000 })
    expect(dragSelection(drag, 20_000, null, total)).toEqual({ start_ms: 8000, end_ms: 10_000 })
  })
})
