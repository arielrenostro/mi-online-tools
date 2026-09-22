from __future__ import annotations
import numpy as np
from app.engines.ve_lambda.pipeline.confidence import CellStats


class FieldSolver:
    """
    Step 7 — anchored smooth correction field.

    Builds the full cf field by solving the linear system that minimises:

        E = Σ_cells  W·(cf - cf_sparse)²   +   μ·Σ_edges (cf_a - cf_b)²

    First term anchors the field on cells with data; the anchor weight W
    grows with the *effective number of trustworthy samples* so cells with
    many stable samples are the source of truth. Second term penalises the
    difference between neighbouring grid cells, so the field is smooth:
    spikes vanish, gaps are filled by a smooth ramp between anchors, and
    beyond the anchors the field flattens — the observed trend is held, not
    extrapolated to infinity.

        (diag(W) + μ·L)·cf = W·cf_sparse        L = grid Laplacian

    Anchor weight:

        eff = sample_count · stability_score      # trustworthy samples
        W   = min(eff / _W_SCALE, _W_CAP)

    Few samples (≈150) → W≈1: weak anchor, smoothed away. Many stable
    samples (thousands) → W saturates at _W_CAP: effectively immovable.
    A noisy cell (stability → 0) → W → 0: it does not anchor the field.
    """

    _W_SCALE = 120.0
    _W_CAP   = 100.0

    def __init__(self, smoothing_strength: float) -> None:
        # μ must stay strictly positive, otherwise no-data rows of the
        # linear system become singular.
        self._mu = max(float(smoothing_strength), 1e-6)

    def solve(
        self,
        cf_sparse: dict[tuple[int, int], float],
        stats:     dict[tuple[int, int], CellStats],
        n_map:     int,
        n_rpm:     int,
    ) -> np.ndarray:
        if not cf_sparse:
            return np.ones((n_map, n_rpm), dtype=float)

        mu = self._mu
        N  = n_map * n_rpm

        def idx(i: int, j: int) -> int:
            return i * n_rpm + j

        A = np.zeros((N, N), dtype=float)
        b = np.zeros(N, dtype=float)
        total_w = 0.0

        for i in range(n_map):
            for j in range(n_rpm):
                k = idx(i, j)
                neighbors = [
                    (ni, nj)
                    for ni, nj in ((i - 1, j), (i + 1, j), (i, j - 1), (i, j + 1))
                    if 0 <= ni < n_map and 0 <= nj < n_rpm
                ]

                key = (i, j)
                if key in cf_sparse:
                    cs  = stats[key]
                    eff = cs.cell.count * cs.stability_score
                    w   = min(eff / self._W_SCALE, self._W_CAP)
                    total_w += w
                    b[k] = w * cf_sparse[key]
                else:
                    w = 0.0

                A[k, k] = w + mu * len(neighbors)
                for ni, nj in neighbors:
                    A[k, idx(ni, nj)] = -mu

        if total_w == 0.0:
            # Every cell with data is too noisy to anchor anything.
            return np.ones((n_map, n_rpm), dtype=float)

        cf_flat = np.linalg.solve(A, b)
        return cf_flat.reshape(n_map, n_rpm)
