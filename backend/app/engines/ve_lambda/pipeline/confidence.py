from __future__ import annotations
from dataclasses import dataclass
from app.core.contracts.tuning_input import TuningConfig
from app.engines.ve_lambda.pipeline.aggregator import AggregatorResult, CellData


@dataclass
class CellStats:
    cell:            CellData
    count_score:     float
    stability_score: float
    confidence:      float
    cv:              float


class Confidence:

    def __init__(self, config: TuningConfig) -> None:
        self._cfg = config

    def compute(self, agg: AggregatorResult) -> dict[tuple[int, int], CellStats]:
        K   = self._cfg.weight_sample_base
        cvt = self._cfg.cv_threshold
        out: dict[tuple[int, int], CellStats] = {}

        for key, cell in agg.cells.items():
            n = cell.count
            count_score = n / (n + K)

            cv = (cell.ve_lambda_std / cell.ve_lambda_avg
                  if cell.ve_lambda_avg > 0 else 0.0)
            stability_score = max(0.0, 1.0 - cv / cvt)

            confidence = count_score * 0.7 + stability_score * 0.3

            out[key] = CellStats(
                cell            = cell,
                count_score     = count_score,
                stability_score = stability_score,
                confidence      = confidence,
                cv              = cv,
            )

        return out
