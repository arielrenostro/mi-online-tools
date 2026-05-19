from __future__ import annotations
from app.engines.ve_lambda.pipeline.confidence import CellStats


class CFCalculator:

    def compute(
        self,
        stats:       dict[tuple[int, int], CellStats],
        current_map: list[list[int]],
    ) -> dict[tuple[int, int], float]:
        cf: dict[tuple[int, int], float] = {}

        for (row_i, col_j), cs in stats.items():
            current = current_map[row_i][col_j]
            if current == 0:
                continue
            cf_raw = cs.cell.ve_lambda_avg / current
            cf[(row_i, col_j)] = 1.0 + cs.count_score * (cf_raw - 1.0)

        return cf
