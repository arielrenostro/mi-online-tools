import type { TimeSelection } from './datalog'

export interface TuningConfig {
  min_clt:                   number
  lambda_loop_closed_only:   boolean
  skip_first_closed_loop:    number
  skip_first_rpm_bucket:     number
  skip_first_map_bucket:     number
  max_delta_rpm:             number
  max_delta_map:             number
  max_delta_lambda_target:   number
  max_lambda:                number
  max_delta_pedal:           number | null
  outlier_sigma:             number
  cv_threshold:              number
  weight_sample_base:        number
  max_correction_pct:        number
  convergence_threshold:     number
  rpm400_rule_enabled:       boolean
  rpm400_discount:           number
  low_map_rule_enabled:      boolean
  low_map_threshold:         number
  low_map_discount:          number
  max_adjacent_gradient_pct: number

  // Shape propagation (steps 8+9)
  shape_propagation_enabled: boolean
  shape_rpm_weight:          number
  shape_map_weight:          number
  shape_gradient_weight:     number
  global_shape_weight:       number
  gradient_min_samples:      number
}

export const DEFAULT_TUNING_CONFIG: TuningConfig = {
  min_clt:                   80,
  lambda_loop_closed_only:   true,
  skip_first_closed_loop:    10,
  skip_first_rpm_bucket:     0,
  skip_first_map_bucket:     0,
  max_delta_rpm:             99999,
  max_delta_map:             99999,
  max_delta_lambda_target:   0.200,
  max_lambda:                1.090,
  max_delta_pedal:           null,
  outlier_sigma:             2.0,
  cv_threshold:              0.15,
  weight_sample_base:        40,
  max_correction_pct:        15.0,
  convergence_threshold:     5.0,
  rpm400_rule_enabled:       true,
  rpm400_discount:           0.045,
  low_map_rule_enabled:      true,
  low_map_threshold:         20,
  low_map_discount:          0.025,
  max_adjacent_gradient_pct: 20.0,

  shape_propagation_enabled: true,
  shape_rpm_weight:          0.50,
  shape_map_weight:          0.30,
  shape_gradient_weight:     0.20,
  global_shape_weight:       0.10,
  gradient_min_samples:      2,
}

export interface TuningRunRequest {
  engineId:       string
  rpmBreakpoints: number[]
  mapBreakpoints: number[]
  cells:          number[][]
  logHashes:      string[]
  timeRange:      TimeSelection | null
  config:         TuningConfig
}

export interface CellExtrapolation { rowI: number; colJ: number; rule: string }
export interface GradientWarning   { rowI: number; colJ: number; neighborI: number; neighborJ: number; gradientPct: number }

export interface FilterStats {
  totalRows:            number
  passed:               number
  discardedClt:         number
  discardedOpenLoop:    number
  discardedSkipCl:      number
  discardedSkipRpmBkt:  number
  discardedSkipMapBkt:  number
  discardedDeltaRpm:    number
  discardedDeltaMap:    number
  discardedDeltaLambda: number
  discardedMaxLambda:   number
  discardedDeltaPedal:  number
  discardedOutOfRange:  number
  discardedOutlier:     number
}

export interface TuningOutput {
  suggestedMap:         number[][]
  veLambdaMap:          (number | null)[][]
  sampleCountMap:       number[][]
  correctionPctMap:     number[][]
  cfMap:                number[][]
  confidenceMap:        (number | null)[][]
  cvMap:                (number | null)[][]
  convergenceMap:       (boolean | null)[][]
  cellsNoData:          [number, number][]
  cellsExtrapolated:    CellExtrapolation[]
  monotonicityWarnings: [number, number][]
  gradientWarnings:     GradientWarning[]
  filterStats:          FilterStats
}
