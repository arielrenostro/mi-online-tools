from __future__ import annotations
import numpy as np
from app.core.contracts.tuning_input import TuningConfig
from app.engines.ve_lambda.pipeline.confidence import CellStats


class ShapePropagation:
    """
    Steps 8+9 — structural tendency extraction and cf_final composition.

    Step 8 decomposes the sparse correction signal into three components:
      - rpm_cf:      per-column weighted mean (RPM tendency)
      - map_cf:      per-row weighted mean with gradient extrapolation for empty rows
      - gradient_cf: per-cell MAP-gradient prediction per RPM column

    Step 9 composes the final correction factor:
      w = 1 - global_shape_weight   (= 0.90 by default)
      cf_final = 1
                 + confidence * w              * (cf_interp    - 1)
                 + (1-confidence) * w          * (cf_structural - 1)
                 + global_shape_weight         * (cf_global     - 1)

    Weights sum to 1.0 by construction: confidence*w + (1-confidence)*w + gw = 1.
    """

    def __init__(
        self,
        config: TuningConfig,
        map_breakpoints: list[int],
        rpm_breakpoints: list[int],
    ) -> None:
        self._cfg  = config
        self._maps = map_breakpoints
        self._rpms = rpm_breakpoints

    def compose(
        self,
        cf_interp: np.ndarray,
        cf_sparse: dict[tuple[int, int], float],
        stats:     dict[tuple[int, int], CellStats],
    ) -> np.ndarray:
        if not self._cfg.shape_propagation_enabled or not cf_sparse:
            return cf_interp

        n_map = len(self._maps)
        n_rpm = len(self._rpms)

        # --- Step 8 ---
        rpm_cf      = self._compute_rpm_cf(cf_sparse, stats, n_map, n_rpm)
        map_cf      = self._compute_map_cf(cf_sparse, stats, n_map, n_rpm)
        gradient_cf = self._compute_gradient_cf(cf_sparse, stats, n_map, n_rpm)

        w_rpm  = self._cfg.shape_rpm_weight       # 0.50
        w_map  = self._cfg.shape_map_weight       # 0.30
        w_grad = self._cfg.shape_gradient_weight  # 0.20

        rpm_cf_2d = np.tile(rpm_cf, (n_map, 1))    # (n_map, n_rpm)
        map_cf_2d = np.tile(map_cf, (n_rpm, 1)).T  # (n_map, n_rpm)

        cf_structural = (
            rpm_cf_2d ** w_rpm
            * map_cf_2d ** w_map
            * gradient_cf ** w_grad
        )

        cf_global = self._compute_global(cf_sparse, stats)

        # --- Step 9 ---
        gw = self._cfg.global_shape_weight   # 0.10
        w  = 1.0 - gw                        # 0.90

        # Build confidence matrix (0.0 for cells without data)
        conf_mat = np.zeros((n_map, n_rpm))
        for (row_i, col_j), cs in stats.items():
            conf_mat[row_i, col_j] = cs.confidence

        cf_final = (
            1.0
            + conf_mat * w * (cf_interp - 1.0)
            + (1.0 - conf_mat) * w * (cf_structural - 1.0)
            + gw * (cf_global - 1.0)
        )

        return cf_final

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _compute_rpm_cf(
        self,
        cf_sparse: dict[tuple[int, int], float],
        stats:     dict[tuple[int, int], CellStats],
        n_map:     int,
        n_rpm:     int,
    ) -> np.ndarray:
        """Weighted mean of cf per RPM column."""
        rpm_cf = np.ones(n_rpm)
        for col_j in range(n_rpm):
            vals, wts = [], []
            for row_i in range(n_map):
                key = (row_i, col_j)
                if key in cf_sparse:
                    cs = stats[key]
                    vals.append(cf_sparse[key])
                    wts.append(cs.cell.count * cs.confidence)
            total_w = sum(wts)
            if vals and total_w > 0:
                rpm_cf[col_j] = float(np.average(vals, weights=wts))
        return rpm_cf

    def _compute_map_cf(
        self,
        cf_sparse: dict[tuple[int, int], float],
        stats:     dict[tuple[int, int], CellStats],
        n_map:     int,
        n_rpm:     int,
    ) -> np.ndarray:
        """Weighted mean of cf per MAP row, with gradient extrapolation for empty rows."""
        # (row_i) -> (weighted_mean, total_weight)
        row_data: dict[int, tuple[float, float]] = {}
        for row_i in range(n_map):
            vals, wts = [], []
            for col_j in range(n_rpm):
                key = (row_i, col_j)
                if key in cf_sparse:
                    cs = stats[key]
                    vals.append(cf_sparse[key])
                    wts.append(cs.cell.count * cs.confidence)
            total_w = sum(wts)
            if vals and total_w > 0:
                row_data[row_i] = (float(np.average(vals, weights=wts)), total_w)

        map_cf = np.ones(n_map)
        if not row_data:
            return map_cf

        sorted_rows = sorted(row_data.items())  # [(row_i, (cf, w)), ...]
        for row_i, (cf, _) in sorted_rows:
            map_cf[row_i] = cf

        if len(sorted_rows) < self._cfg.gradient_min_samples:
            # Not enough rows for a gradient — propagate nearest observed value
            for row_i in range(n_map):
                if row_i not in row_data:
                    nearest = min(sorted_rows, key=lambda x: abs(self._maps[x[0]] - self._maps[row_i]))
                    map_cf[row_i] = nearest[1][0]
            return map_cf

        # Weighted gradient between consecutive observed rows
        gradient = self._axis_gradient(
            [(self._maps[ri], cf, w) for ri, (cf, w) in sorted_rows]
        )

        for row_i in range(n_map):
            if row_i in row_data:
                continue
            anchor_i = min(sorted_rows, key=lambda x: abs(self._maps[x[0]] - self._maps[row_i]))[0]
            anchor_cf = row_data[anchor_i][0]
            extrapolated = anchor_cf + gradient * (self._maps[row_i] - self._maps[anchor_i])
            map_cf[row_i] = max(0.5, min(2.0, extrapolated))

        return map_cf

    def _compute_gradient_cf(
        self,
        cf_sparse: dict[tuple[int, int], float],
        stats:     dict[tuple[int, int], CellStats],
        n_map:     int,
        n_rpm:     int,
    ) -> np.ndarray:
        """Per-cell MAP-gradient prediction, computed per RPM column."""
        gradient_cf = np.ones((n_map, n_rpm))

        for col_j in range(n_rpm):
            col_data = sorted(
                [
                    (row_i, cf_sparse[(row_i, col_j)], stats[(row_i, col_j)])
                    for row_i in range(n_map)
                    if (row_i, col_j) in cf_sparse
                ],
                key=lambda x: self._maps[x[0]],
            )

            if not col_data:
                continue

            if len(col_data) < self._cfg.gradient_min_samples:
                # Single observation: use constant for all MAP levels
                const_cf = col_data[0][1]
                gradient_cf[:, col_j] = const_cf
                continue

            # Weighted gradient between consecutive pairs
            pairs = []
            for k in range(len(col_data) - 1):
                ri1, cf1, cs1 = col_data[k]
                ri2, cf2, cs2 = col_data[k + 1]
                g = (cf2 - cf1) / (self._maps[ri2] - self._maps[ri1])
                weight = min(cs1.cell.count, cs2.cell.count)
                pairs.append((g, weight))

            total_w = sum(w for _, w in pairs)
            gradient = (sum(g * w for g, w in pairs) / total_w) if total_w > 0 else 0.0

            # Anchor at centroid of observations (equal weight for stability)
            anchor_map = float(np.mean([self._maps[d[0]] for d in col_data]))
            anchor_cf  = float(np.mean([d[1] for d in col_data]))

            for row_i in range(n_map):
                pred = anchor_cf + gradient * (self._maps[row_i] - anchor_map)
                gradient_cf[row_i, col_j] = max(0.5, min(2.0, pred))

        return gradient_cf

    def _compute_global(
        self,
        cf_sparse: dict[tuple[int, int], float],
        stats:     dict[tuple[int, int], CellStats],
    ) -> float:
        """Global weighted mean of all observed correction factors."""
        vals, wts = [], []
        for key, cf in cf_sparse.items():
            cs = stats[key]
            vals.append(cf)
            wts.append(cs.cell.count * cs.confidence)
        total_w = sum(wts)
        if not vals or total_w == 0:
            return 1.0
        return float(np.average(vals, weights=wts))

    @staticmethod
    def _axis_gradient(
        sorted_points: list[tuple[float, float, float]],  # (axis_value, cf, weight)
    ) -> float:
        """Weighted mean gradient between consecutive (axis, cf) pairs."""
        pairs = []
        for i in range(len(sorted_points) - 1):
            ax1, v1, w1 = sorted_points[i]
            ax2, v2, w2 = sorted_points[i + 1]
            if ax2 == ax1:
                continue
            g = (v2 - v1) / (ax2 - ax1)
            weight = min(w1, w2)
            pairs.append((g, weight))
        if not pairs:
            return 0.0
        total_w = sum(w for _, w in pairs)
        return sum(g * w for g, w in pairs) / total_w if total_w > 0 else 0.0
