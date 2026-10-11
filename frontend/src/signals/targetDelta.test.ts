import { describe, it, expect } from 'vitest'
import { computeDeltaLambdaTarget, computeDeltaBoostTarget } from './targetDelta'
import type { DatalogRow } from '@/types/datalog'

const row = (o: Record<string, number>) => ({ timestamp_ms: 0, ...o }) as DatalogRow

describe('computeDeltaLambdaTarget', () => {
  it('mais pobre que o alvo é positivo', () => {
    expect(computeDeltaLambdaTarget(row({ 'Lambda 1': 0.985, 'Lambda Target': 0.95 }))).toBeCloseTo(0.035, 6)
  })
  it('mais rico que o alvo é negativo', () => {
    expect(computeDeltaLambdaTarget(row({ 'Lambda 1': 0.9, 'Lambda Target': 0.95 }))).toBeCloseTo(-0.05, 6)
  })
  it('no alvo é zero', () => {
    expect(computeDeltaLambdaTarget(row({ 'Lambda 1': 1, 'Lambda Target': 1 }))).toBe(0)
  })
})

describe('computeDeltaBoostTarget', () => {
  it('acima do alvo é positivo', () => {
    expect(computeDeltaBoostTarget(row({ Boost: 112, 'Boost Target': 100 }))).toBe(12)
  })
  it('abaixo do alvo é negativo', () => {
    expect(computeDeltaBoostTarget(row({ Boost: 80, 'Boost Target': 100 }))).toBe(-20)
  })
})
