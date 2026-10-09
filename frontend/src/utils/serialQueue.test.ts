import { describe, it, expect } from 'vitest'
import { createSerialQueue } from './serialQueue'

function fakeFrames() {
  const pending: (() => void)[] = []
  return { nextFrame: (cb: () => void) => { pending.push(cb) }, tick: () => pending.shift()?.(), size: () => pending.length }
}

describe('createSerialQueue', () => {
  it('runs the first job at once and the next ones one per frame, in order', () => {
    const f = fakeFrames()
    const q = createSerialQueue(f.nextFrame)
    const ran: number[] = []
    for (const n of [1, 2, 3]) q.enqueue(() => { ran.push(n); return true })
    expect(ran).toEqual([1])
    f.tick()
    expect(ran).toEqual([1, 2])
    f.tick()
    expect(ran).toEqual([1, 2, 3])
  })

  it('does not spend a frame on a discarded job', () => {
    const f = fakeFrames()
    const q = createSerialQueue(f.nextFrame)
    const ran: string[] = []
    q.enqueue(() => { ran.push('a'); return true })
    q.enqueue(() => { ran.push('stale'); return false })
    q.enqueue(() => { ran.push('b'); return true })
    f.tick()
    expect(ran).toEqual(['a', 'stale', 'b'])
  })

  it('keeps going when a job throws', () => {
    const f = fakeFrames()
    const q = createSerialQueue(f.nextFrame)
    const ran: string[] = []
    const err = console.error
    console.error = () => {}
    try {
      q.enqueue(() => { throw new Error('boom') })
      q.enqueue(() => { ran.push('after'); return true })
    } finally { console.error = err }
    expect(ran).toEqual(['after'])
  })

  it('goes idle when empty and restarts on the next job', () => {
    const f = fakeFrames()
    const q = createSerialQueue(f.nextFrame)
    const ran: number[] = []
    q.enqueue(() => { ran.push(1); return true })
    f.tick()
    expect(f.size()).toBe(0)
    q.enqueue(() => { ran.push(2); return true })
    expect(ran).toEqual([1, 2])
  })
})
