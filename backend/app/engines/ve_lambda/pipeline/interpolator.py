from __future__ import annotations
import numpy as np
from scipy.interpolate import griddata


class Interpolator:

    def __init__(self, map_breakpoints: list[int], rpm_breakpoints: list[int]) -> None:
        self._maps = map_breakpoints
        self._rpms = rpm_breakpoints

    def interpolate(
        self,
        cf_sparse: dict[tuple[int, int], float],
        fill_value: float = 1.0,
    ) -> np.ndarray:
        n_map = len(self._maps)
        n_rpm = len(self._rpms)

        if not cf_sparse:
            return np.ones((n_map, n_rpm), dtype=float)

        map_coords = [self._maps[row_i] for (row_i, _) in cf_sparse]
        rpm_coords = [self._rpms[col_j] for (_, col_j) in cf_sparse]
        values     = list(cf_sparse.values())

        points = np.column_stack([map_coords, rpm_coords])

        grid_map, grid_rpm = np.meshgrid(self._maps, self._rpms, indexing="ij")

        cf_full = griddata(
            points, values, (grid_map, grid_rpm),
            method="linear", fill_value=fill_value,
        )
        return cf_full  # shape: (n_map, n_rpm)
