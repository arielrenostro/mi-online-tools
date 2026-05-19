from __future__ import annotations
from dataclasses import dataclass
from app.engines.ve_lambda.pipeline.snap import SnappedRow


@dataclass
class RowWithVE:
    snapped:   SnappedRow
    ve_lambda: float


class Formula:

    def apply(self, rows: list[SnappedRow]) -> list[RowWithVE]:
        out: list[RowWithVE] = []
        for s in rows:
            r = s.row
            # VE Lambda = (lambda1 + lambda_correcao - lambda_target) × ve_value_raw
            # (equivalent to the raw formula divided/multiplied by 1000 consistently)
            ve_lambda = (r.lambda1 + r.lambda_correcao - r.lambda_target) * r.ve_value_raw
            out.append(RowWithVE(snapped=s, ve_lambda=ve_lambda))
        return out
