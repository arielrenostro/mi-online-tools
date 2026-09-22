from __future__ import annotations
from app.core.contracts.tuning_input import TuningConfig
from app.engines.ve_lambda.pipeline.confidence import CellStats


class CFCalculator:

    def __init__(self, config: TuningConfig) -> None:
        self._cfg = config

    def compute(
        self,
        stats:       dict[tuple[int, int], CellStats],
        current_map: list[list[int]],
    ) -> dict[tuple[int, int], float]:
        cf: dict[tuple[int, int], float] = {}

        max_pct = self._cfg.max_correction_pct / 100.0
        lo, hi  = 1.0 - max_pct, 1.0 + max_pct

        for (row_i, col_j), cs in stats.items():
            current = current_map[row_i][col_j]
            if current == 0:
                continue
            cf_raw = cs.cell.ve_lambda_avg / current
            cf_val = 1.0 + cs.count_score * (cf_raw - 1.0)
            # Clamp the anchor so the field solver never pulls a cell
            # beyond the per-round correction limit.
            cf[(row_i, col_j)] = max(lo, min(hi, cf_val))

        return cf
