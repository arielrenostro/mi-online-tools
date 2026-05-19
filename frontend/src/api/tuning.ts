import { apiFetch } from './client'
import type { TuningRunRequest, TuningOutput, CellExtrapolation, GradientWarning, FilterStats } from '@/types/tuning'

interface RawOutput {
  suggested_map:         number[][]
  ve_lambda_map:         (number | null)[][]
  sample_count_map:      number[][]
  correction_pct_map:    number[][]
  cf_map:                number[][]
  confidence_map:        (number | null)[][]
  cv_map:                (number | null)[][]
  convergence_map:       (boolean | null)[][]
  cells_no_data:         [number, number][]
  cells_extrapolated:    { row_i: number; col_j: number; rule: string }[]
  monotonicity_warnings: [number, number][]
  gradient_warnings:     { row_i: number; col_j: number; neighbor_i: number; neighbor_j: number; gradient_pct: number }[]
  filter_stats: {
    total_rows: number; passed: number
    discarded_clt: number; discarded_open_loop: number; discarded_skip_cl: number
    discarded_skip_rpm_bkt: number; discarded_skip_map_bkt: number
    discarded_delta_rpm: number; discarded_delta_map: number
    discarded_delta_lambda: number; discarded_max_lambda: number
    discarded_delta_pedal: number; discarded_out_of_range: number
    discarded_outlier: number
  }
}

function mapOutput(r: RawOutput): TuningOutput {
  const fs = r.filter_stats
  const filterStats: FilterStats = {
    totalRows:            fs.total_rows,
    passed:               fs.passed,
    discardedClt:         fs.discarded_clt,
    discardedOpenLoop:    fs.discarded_open_loop,
    discardedSkipCl:      fs.discarded_skip_cl,
    discardedSkipRpmBkt:  fs.discarded_skip_rpm_bkt,
    discardedSkipMapBkt:  fs.discarded_skip_map_bkt,
    discardedDeltaRpm:    fs.discarded_delta_rpm,
    discardedDeltaMap:    fs.discarded_delta_map,
    discardedDeltaLambda: fs.discarded_delta_lambda,
    discardedMaxLambda:   fs.discarded_max_lambda,
    discardedDeltaPedal:  fs.discarded_delta_pedal,
    discardedOutOfRange:  fs.discarded_out_of_range,
    discardedOutlier:     fs.discarded_outlier,
  }
  return {
    suggestedMap:         r.suggested_map,
    veLambdaMap:          r.ve_lambda_map,
    sampleCountMap:       r.sample_count_map,
    correctionPctMap:     r.correction_pct_map,
    cfMap:                r.cf_map,
    confidenceMap:        r.confidence_map,
    cvMap:                r.cv_map,
    convergenceMap:       r.convergence_map,
    cellsNoData:          r.cells_no_data,
    cellsExtrapolated:    r.cells_extrapolated.map(c => ({ rowI: c.row_i, colJ: c.col_j, rule: c.rule })),
    monotonicityWarnings: r.monotonicity_warnings,
    gradientWarnings:     r.gradient_warnings.map(g => ({
      rowI: g.row_i, colJ: g.col_j,
      neighborI: g.neighbor_i, neighborJ: g.neighbor_j,
      gradientPct: g.gradient_pct,
    })),
    filterStats,
  }
}

export async function runTuning(req: TuningRunRequest): Promise<TuningOutput> {
  const body = {
    engine_id:        req.engineId,
    rpm_breakpoints:  req.rpmBreakpoints,
    map_breakpoints:  req.mapBreakpoints,
    cells:            req.cells,
    log_hashes:       req.logHashes,
    time_range:       req.timeRange,
    config:           req.config,
  }
  const raw = await apiFetch<RawOutput>('/api/tuning/run', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    timeoutMs: 120_000,
  })
  return mapOutput(raw)
}
