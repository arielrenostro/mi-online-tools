import { describe, it, expect } from 'vitest'
import { computeVeLambda } from './veLambdaFormula'
import type { DatalogRow } from '@/types/datalog'

describe('computeVeLambda', () => {
  it('matches the backend raw-scale formula for a known example', () => {
    // Lambda1_raw=1018, LambdaCorr_raw=1020, LambdaTarget_raw=1000, VE_raw=592
    // raw VE Lambda = (1018+1020-1000)*592/1000 = 614.496 -> real % = /10 = 61.4496
    const row: DatalogRow = {
      timestamp_ms: 0,
      'Lambda 1':      1.018,
      'Lambda Target': 1.000,
      'Lambda Corr':   2.0,
      'VE':            59.2,
    }
    expect(computeVeLambda(row)).toBeCloseTo(61.4496, 3)
  })

  it('returns the current VE when lambda matches target and there is no trim', () => {
    const row: DatalogRow = {
      timestamp_ms: 0,
      'Lambda 1':      1.0,
      'Lambda Target': 1.0,
      'Lambda Corr':   0,
      'VE':            50,
    }
    expect(computeVeLambda(row)).toBeCloseTo(50, 6)
  })
})
