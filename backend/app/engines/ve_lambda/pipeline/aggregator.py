from __future__ import annotations
from dataclasses import dataclass, field
import statistics
from app.core.contracts.tuning_input import TuningConfig
from app.engines.ve_lambda.pipeline.formula import RowWithVE


@dataclass
class CellData:
    ve_lambda_avg:    float
    ve_lambda_std:    float
    count:            int          # post-outlier sample count
    outliers_removed: int


@dataclass
class AggregatorResult:
    cells:           dict[tuple[int, int], CellData]
    outlier_count:   int


class Aggregator:

    def __init__(self, config: TuningConfig) -> None:
        self._cfg = config

    def aggregate(self, rows: list[RowWithVE]) -> AggregatorResult:
        # Collect raw ve_lambda per cell
        buckets: dict[tuple[int, int], list[float]] = {}
        for rve in rows:
            key = (rve.snapped.row_i, rve.snapped.col_j)
            buckets.setdefault(key, []).append(rve.ve_lambda)

        cells: dict[tuple[int, int], CellData] = {}
        outlier_count = 0
        sigma = self._cfg.outlier_sigma

        for key, values in buckets.items():
            n_raw = len(values)
            if n_raw >= 5:
                mean_v = statistics.mean(values)
                std_v  = statistics.stdev(values)
                kept   = [v for v in values if abs(v - mean_v) <= sigma * std_v]
            else:
                kept = values

            removed = n_raw - len(kept)
            outlier_count += removed

            n = len(kept)
            if n == 0:
                continue

            avg = statistics.mean(kept)
            std = statistics.stdev(kept) if n >= 2 else 0.0

            cells[key] = CellData(
                ve_lambda_avg    = avg,
                ve_lambda_std    = std,
                count            = n,
                outliers_removed = removed,
            )

        return AggregatorResult(cells=cells, outlier_count=outlier_count)
