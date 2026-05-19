from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class DatalogRow:
    timestamp_ms:    int
    rpm:             float
    map_kpa:         float
    lambda1:         float
    lambda_correcao: float   # multiplier: 1.000 = no trim, 1.020 = +2%
    lambda_target:   float
    ve_value_raw:    int     # VE% × 10 (ex: 59.2% → 592)
    clt:             float   # °C
    lambda_loop:     int     # 0 = open loop, 1 = closed loop
    pedal:           float | None  # 0–100%; None if column absent


@dataclass
class TuningConfig:
    # Data filters
    min_clt:                   float        = 80.0
    lambda_loop_closed_only:   bool         = True
    skip_first_closed_loop:    int          = 10
    skip_first_rpm_bucket:     int          = 0
    skip_first_map_bucket:     int          = 0
    max_delta_rpm:             float        = 99999.0
    max_delta_map:             float        = 99999.0
    max_delta_lambda_target:   float        = 0.200
    max_lambda:                float        = 1.090
    max_delta_pedal:           float | None = None

    # Cell quality
    outlier_sigma:             float        = 2.0
    cv_threshold:              float        = 0.15

    # Correction
    weight_sample_base:        int          = 40
    max_correction_pct:        float        = 15.0

    # Convergence
    convergence_threshold:     float        = 5.0

    # Post-processing
    rpm400_rule_enabled:       bool         = True
    rpm400_discount:           float        = 0.045
    low_map_rule_enabled:      bool         = True
    low_map_threshold:         int          = 20
    low_map_discount:          float        = 0.025
    max_adjacent_gradient_pct: float        = 20.0


@dataclass
class TuningInput:
    current_map:     list[list[int]]   # (n_map × n_rpm), raw values 100–9999
    rpm_breakpoints: list[int]
    map_breakpoints: list[int]
    datalog_rows:    list[DatalogRow]
    config:          TuningConfig
