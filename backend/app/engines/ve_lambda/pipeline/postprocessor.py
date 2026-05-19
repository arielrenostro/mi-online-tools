from __future__ import annotations
from app.core.contracts.tuning_input import TuningConfig
from app.core.contracts.tuning_output import (
    TuningOutput, CellExtrapolation, GradientWarning, FilterStats,
)
from app.engines.ve_lambda.pipeline.applicator import ApplicatorResult


class Postprocessor:

    def __init__(
        self,
        config:          TuningConfig,
        map_breakpoints: list[int],
        rpm_breakpoints: list[int],
    ) -> None:
        self._cfg  = config
        self._maps = map_breakpoints
        self._rpms = rpm_breakpoints

    def run(
        self,
        applied:      ApplicatorResult,
        filter_stats: FilterStats,
        cells_extrapolated_interp: list[CellExtrapolation],
    ) -> TuningOutput:
        cfg     = self._cfg
        maps    = self._maps
        rpms    = self._rpms
        n_map   = len(maps)
        n_rpm   = len(rpms)
        result  = [row[:] for row in applied.suggested_map]
        cells_extrapolated = list(cells_extrapolated_interp)

        # 10.1 RPM 400 rule
        if cfg.rpm400_rule_enabled and 400 in rpms and 800 in rpms:
            idx_400 = rpms.index(400)
            idx_800 = rpms.index(800)
            for row_i in range(n_map):
                val_800 = result[row_i][idx_800]
                result[row_i][idx_400] = int(round(val_800 * (1.0 - cfg.rpm400_discount)))
                cells_extrapolated.append(CellExtrapolation(row_i=row_i, col_j=idx_400, rule="rpm400"))

        # 10.2 Low MAP rule (only rows with zero sample count across all columns)
        sample_count = applied.sample_count_map
        if cfg.low_map_rule_enabled:
            for row_i, map_kpa in enumerate(maps):
                if map_kpa <= cfg.low_map_threshold:
                    row_total = sum(sample_count[row_i])
                    if row_total == 0 and row_i + 1 < n_map:
                        for col_j in range(n_rpm):
                            result[row_i][col_j] = int(
                                round(result[row_i + 1][col_j] * (1.0 - cfg.low_map_discount))
                            )
                        cells_extrapolated.extend(
                            CellExtrapolation(row_i=row_i, col_j=col_j, rule="low_map")
                            for col_j in range(n_rpm)
                        )

        # 10.3 Monotonicity check (MAP axis, per column)
        monotonicity_warnings: list[tuple[int, int]] = []
        for col_j in range(n_rpm):
            for row_i in range(1, n_map):
                if maps[row_i] < 40:
                    continue
                if result[row_i][col_j] < result[row_i - 1][col_j]:
                    monotonicity_warnings.append((row_i, col_j))

        # 10.4 Gradient check between adjacent cells
        gradient_warnings: list[GradientWarning] = []
        neighbors = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        for row_i in range(n_map):
            for col_j in range(n_rpm):
                current_val = result[row_i][col_j]
                for ni, nj in neighbors:
                    ri, cj = row_i + ni, col_j + nj
                    if 0 <= ri < n_map and 0 <= cj < n_rpm:
                        neighbor_val = result[ri][cj]
                        if neighbor_val == 0:
                            continue
                        grad_pct = abs(current_val - neighbor_val) / neighbor_val * 100.0
                        if grad_pct > cfg.max_adjacent_gradient_pct:
                            gradient_warnings.append(GradientWarning(
                                row_i        = row_i,
                                col_j        = col_j,
                                neighbor_i   = ri,
                                neighbor_j   = cj,
                                gradient_pct = round(grad_pct, 2),
                            ))

        return TuningOutput(
            suggested_map         = result,
            ve_lambda_map         = applied.ve_lambda_map,
            sample_count_map      = applied.sample_count_map,
            correction_pct_map    = applied.correction_pct_map,
            cf_map                = applied.cf_map,
            confidence_map        = applied.confidence_map,
            cv_map                = applied.cv_map,
            convergence_map       = applied.convergence_map,
            cells_no_data         = applied.cells_no_data,
            cells_extrapolated    = cells_extrapolated,
            monotonicity_warnings = monotonicity_warnings,
            gradient_warnings     = gradient_warnings,
            filter_stats          = filter_stats,
        )
