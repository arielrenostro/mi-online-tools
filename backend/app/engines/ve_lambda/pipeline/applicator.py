from __future__ import annotations
from dataclasses import dataclass
import math
import numpy as np
from app.core.contracts.tuning_input import TuningConfig
from app.engines.ve_lambda.pipeline.aggregator import CellData
from app.engines.ve_lambda.pipeline.confidence import CellStats


@dataclass
class ApplicatorResult:
    suggested_map:      list[list[int]]
    ve_lambda_map:      list[list[float | None]]
    sample_count_map:   list[list[int]]
    correction_pct_map: list[list[float]]
    cf_map:             list[list[float]]
    confidence_map:     list[list[float | None]]
    cv_map:             list[list[float | None]]
    convergence_map:    list[list[bool | None]]
    cells_no_data:      list[tuple[int, int]]


class Applicator:

    def __init__(self, config: TuningConfig) -> None:
        self._cfg = config

    def apply(
        self,
        cf_full:     np.ndarray,
        current_map: list[list[int]],
        stats:       dict[tuple[int, int], CellStats],
    ) -> ApplicatorResult:
        cfg      = self._cfg
        n_map    = len(current_map)
        n_rpm    = len(current_map[0]) if n_map else 0

        suggested      = [[0] * n_rpm for _ in range(n_map)]
        ve_lambda_map  = [[None] * n_rpm for _ in range(n_map)]
        sample_count   = [[0] * n_rpm for _ in range(n_map)]
        corr_pct_map   = [[0.0] * n_rpm for _ in range(n_map)]
        cf_map_out     = [[1.0] * n_rpm for _ in range(n_map)]
        confidence_map = [[None] * n_rpm for _ in range(n_map)]
        cv_map         = [[None] * n_rpm for _ in range(n_map)]
        convergence    = [[None] * n_rpm for _ in range(n_map)]
        cells_no_data: list[tuple[int, int]] = []

        max_pct = cfg.max_correction_pct / 100.0

        for row_i in range(n_map):
            for col_j in range(n_rpm):
                current = current_map[row_i][col_j]
                cf      = float(cf_full[row_i, col_j])

                # Clamp correction
                correction = cf - 1.0
                if abs(correction) > max_pct:
                    cf = 1.0 + math.copysign(max_pct, correction)

                new_val = int(round(current * cf))
                new_val = max(100, min(9999, new_val))

                correction_pct = (cf - 1.0) * 100.0

                suggested[row_i][col_j]    = new_val
                corr_pct_map[row_i][col_j] = correction_pct
                cf_map_out[row_i][col_j]   = cf

                cs = stats.get((row_i, col_j))
                if cs is not None:
                    ve_lambda_map[row_i][col_j]  = cs.cell.ve_lambda_avg
                    sample_count[row_i][col_j]   = cs.cell.count
                    confidence_map[row_i][col_j] = cs.confidence
                    cv_map[row_i][col_j]         = cs.cv
                    # Convergence: residual between ve_lambda_avg and new_val
                    if new_val > 0:
                        residual_pct = abs(cs.cell.ve_lambda_avg - new_val) / new_val * 100.0
                        convergence[row_i][col_j] = residual_pct < cfg.convergence_threshold
                else:
                    cells_no_data.append((row_i, col_j))

        return ApplicatorResult(
            suggested_map      = suggested,
            ve_lambda_map      = ve_lambda_map,
            sample_count_map   = sample_count,
            correction_pct_map = corr_pct_map,
            cf_map             = cf_map_out,
            confidence_map     = confidence_map,
            cv_map             = cv_map,
            convergence_map    = convergence,
            cells_no_data      = cells_no_data,
        )
