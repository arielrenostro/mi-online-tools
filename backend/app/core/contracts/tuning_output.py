from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class FilterStats:
    total_rows:             int
    passed:                 int
    discarded_clt:          int
    discarded_open_loop:    int
    discarded_skip_cl:      int
    discarded_skip_rpm_bkt: int
    discarded_skip_map_bkt: int
    discarded_delta_rpm:    int
    discarded_delta_map:    int
    discarded_delta_lambda: int
    discarded_max_lambda:   int
    discarded_delta_pedal:  int
    discarded_out_of_range: int
    discarded_outlier:      int


@dataclass
class CellExtrapolation:
    row_i: int
    col_j: int
    rule:  str  # "interpolation_2d" | "rpm400" | "low_map"


@dataclass
class GradientWarning:
    row_i:        int
    col_j:        int
    neighbor_i:   int
    neighbor_j:   int
    gradient_pct: float


@dataclass
class TuningOutput:
    suggested_map:         list[list[int]]
    ve_lambda_map:         list[list[float | None]]
    sample_count_map:      list[list[int]]
    correction_pct_map:    list[list[float]]
    cf_map:                list[list[float]]
    confidence_map:        list[list[float | None]]
    cv_map:                list[list[float | None]]
    convergence_map:       list[list[bool | None]]
    cells_no_data:         list[tuple[int, int]]
    cells_extrapolated:    list[CellExtrapolation]
    monotonicity_warnings: list[tuple[int, int]]
    gradient_warnings:     list[GradientWarning]
    filter_stats:          FilterStats
