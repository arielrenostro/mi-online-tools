import { describe, it, expect } from 'vitest'
import { isLegacyCorrectionFilters, migrateLegacyCorrectionFilters, type LegacyCorrectionFilters } from './filterMigration'
import { DEFAULT_FILTER, filtersEqual } from '@/types/filter'

const OLD_DEFAULTS: LegacyCorrectionFilters = {
  lambdaLoop: [1, 2], minClt: 85, minLambda: 0.6, maxLambda: 1.1,
  maxDeltaTps: 5, maxDeltaMap: 5, maxDeltaLambdaTarget: 0.03,
  skipFirstClosedLoop: 5, skipFirstOpenLoop: 10,
}

describe('migrateLegacyCorrectionFilters', () => {
  it('maps the old defaults to exactly the new default filter', () => {
    expect(filtersEqual(migrateLegacyCorrectionFilters(OLD_DEFAULTS), DEFAULT_FILTER)).toBe(true)
  })

  it('leaves the "before" skips off', () => {
    const f = migrateLegacyCorrectionFilters(OLD_DEFAULTS)
    expect(f.skipBeforeClosed.enabled).toBe(false)
    expect(f.skipBeforeOpen.enabled).toBe(false)
  })

  it('turns minClt and the lambda limits into enabled ranges', () => {
    const f = migrateLegacyCorrectionFilters({ ...OLD_DEFAULTS, minClt: 70, minLambda: 0.7, maxLambda: 1.2 })
    expect(f.ranges['CLT']).toEqual({ enabled: true, min: 70, max: null })
    expect(f.ranges['Lambda 1']).toEqual({ enabled: true, min: 0.7, max: 1.2 })
  })

  it('disables the loop criterion when all three states were selected (= no filtering)', () => {
    const f = migrateLegacyCorrectionFilters({ ...OLD_DEFAULTS, lambdaLoop: [0, 1, 2] })
    expect(f.lambdaLoop.enabled).toBe(false)
  })

  it('keeps a partial loop selection enabled', () => {
    const f = migrateLegacyCorrectionFilters({ ...OLD_DEFAULTS, lambdaLoop: [1] })
    expect(f.lambdaLoop).toEqual({ enabled: true, states: [1] })
  })

  it('disables a skip whose count was 0', () => {
    const f = migrateLegacyCorrectionFilters({ ...OLD_DEFAULTS, skipFirstClosedLoop: 0, skipFirstOpenLoop: 3 })
    expect(f.skipClosed.enabled).toBe(false)
    expect(f.skipOpen).toEqual({ enabled: true, n: 3 })
  })

  it('leaves MAP, RPM, Pedal and Lambda Corr disabled', () => {
    const f = migrateLegacyCorrectionFilters(OLD_DEFAULTS)
    for (const sig of ['MAP', 'RPM', 'Pedal', 'Lambda Corr'] as const) expect(f.ranges[sig].enabled).toBe(false)
  })
})

describe('isLegacyCorrectionFilters', () => {
  it('recognises the old shape and rejects the new one and garbage', () => {
    expect(isLegacyCorrectionFilters(OLD_DEFAULTS)).toBe(true)
    expect(isLegacyCorrectionFilters(DEFAULT_FILTER)).toBe(false)
    expect(isLegacyCorrectionFilters(null)).toBe(false)
    expect(isLegacyCorrectionFilters('x')).toBe(false)
  })
})
