## Context

See proposal.md. Today `generateCorrectionSnapshot` keeps per-cell values only transiently
(`valuesPerCell`) and stores `{ n, mean, median }`; `StatMode = 'mean' | 'median'` selects which
stored value feeds `computeDirectFactor`. The last snapshot is persisted in IndexedDB as-is and
restored without any schema version. A cell's factor is `stat ÷ map value` with the map value
constant per cell, so the mode of the factor equals the mode of VE Lambda divided by the map value:
computing the mode on VE Lambda and deriving the factor on read is equivalent, and keeps the
invariant that the snapshot never stores a factor.

## Goals / Non-Goals

**Goals:**
- Mode available as a third statistic with no regeneration when toggling.
- Deterministic result that does not depend on histogram bin edges.

**Non-Goals:**
- No UI control for the tolerance (fixed constant, like `CONFIDENCE_CONSTANT`).
- No histogram or distribution view; no storing of raw per-point values in the snapshot.
- No weighting of the mode by bilinear weight.

## Decisions

**Sliding window over fixed bins.** For the sorted values, for each value `v` as window start count
the points in `[v, v + 2·T]` (two-pointer scan, O(n log n) with the sort), `T = 0.5`. The winner is
the window with most points; the mode is the mean of the points inside it. Alternatives: fixed-width
bins (result changes with where bin edges fall — a cluster straddling an edge splits and loses);
kernel density (more robust but harder to explain and test, overkill for this data volume).

**Tie-break by proximity to the median.** Among equally full windows, pick the one whose mean is
closest to the cell's median; remaining ties pick the lower value, for determinism.

**Unweighted, like the median.** Bilinear weights encode how much a point belongs to a cell, which
is meaningful for an average but not for "which value repeats". Keeping it unweighted keeps mode and
median comparable.

**Mode stored, not derived.** Raw values are not persisted, so the mode must be computed at
generation and stored per cell. Cost is one extra number per cell.

**Optional field for old snapshots.** `CorrectionCell.mode` is optional/nullable in the type. A
snapshot "has mode" when every cell with `n > 0` has a numeric `mode`. The display layer treats a
missing mode as "unavailable" (factor null) rather than as no data, and the toggle disables Mode
when the snapshot lacks it. Alternatives: bump a schema version and discard old snapshots (loses the
user's work for a cosmetic gain); mark old snapshots stale (misleading, inputs did not change).

**Fallback of the selected statistic.** If Mode is selected and the displayed snapshot has no mode
(e.g. after a restore of an older one), the selection switches to Median.

## Risks / Trade-offs

- [Small n makes the mode noise] → With few points the densest window may hold 1–2 points; the
  Weighted factor already damps low-n cells toward 1.00, so no extra rule.
- [Fixed ±0.5 tolerance may not suit all logs] → Isolated as one named constant, easy to tune later.
- [Cells where the window edge is arbitrary] → Sliding window over actual values avoids the
  bin-edge artifact; ties are deterministic.

## Migration Plan

No data migration. Old snapshots load unchanged; Mode stays disabled for them until the next
"Gerar fator de correção". Rollback is removing the field and option; stored extra `mode` values are
ignored by older code.
