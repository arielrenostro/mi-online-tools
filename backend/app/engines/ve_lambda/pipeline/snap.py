from __future__ import annotations
from dataclasses import dataclass
from app.core.contracts.tuning_input import DatalogRow


@dataclass
class SnappedRow:
    row:         DatalogRow
    row_i:       int    # MAP index
    col_j:       int    # RPM index
    rpm_snapped: int
    map_snapped: int


class Snap:

    def __init__(self, rpm_breakpoints: list[int], map_breakpoints: list[int]) -> None:
        self._rpms = rpm_breakpoints
        self._maps = map_breakpoints

    def apply(self, rows: list[DatalogRow]) -> tuple[list[SnappedRow], int]:
        out: list[SnappedRow] = []
        out_of_range = 0

        for row in rows:
            rpm_bp = _snap(row.rpm, self._rpms)
            map_bp = _snap(row.map_kpa, self._maps)

            if rpm_bp is None or map_bp is None:
                out_of_range += 1
                continue

            out.append(SnappedRow(
                row         = row,
                row_i       = self._maps.index(map_bp),
                col_j       = self._rpms.index(rpm_bp),
                rpm_snapped = rpm_bp,
                map_snapped = map_bp,
            ))

        return out, out_of_range


def _snap(value: float, breakpoints: list[int]) -> int | None:
    if value < breakpoints[0] or value > breakpoints[-1]:
        return None
    return min(breakpoints, key=lambda bp: abs(bp - value))
