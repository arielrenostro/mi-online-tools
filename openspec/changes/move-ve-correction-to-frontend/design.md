## Context

See `proposal.md` for motivation. Relevant current state:

- `signalRegistry.ts` defines signals purely as `{ column, convert(raw: string), format }` — every
  signal today is a 1:1 mapping from one CSV column. `DatalogRow` stores only already-converted
  real-unit values; raw values are discarded after parsing.
- `logStore` owns active/enabled logs and their parsed rows; `timeStore` owns the cursor and time
  selection; `mapStore` owns the original/editable VE map cells and undo history; `uiStore` owns
  layout/visibility prefs. All four persist through the existing `persistence/` modules
  (IndexedDB for large blobs/models, localStorage for small preferences) — see
  `specs/architecture/overview.md`'s persistence table (itself being rewritten by this change to
  drop backend-related rows).
- `HeatmapTable` already renders an arbitrary numeric/boolean grid read-only (`AnalysisSection` uses
  it this way today) — the new correction heatmap reuses it as-is, no changes needed to that
  component.

## Goals / Non-Goals

**Goals:**
- One shared filter-evaluation pass that Dashboard, Charts, Data, and the correction-generation
  step all consume, so "which points qualify" is never defined twice.
- Keep the expensive step (bilinear attribution + per-cell aggregation) strictly behind the
  explicit "Gerar" action; keep everything else (filtering, factor display, mean/median/direct/
  weighted toggling) cheap enough to be live.
- No duplicated business logic between a "preview" path and a "generate" path — both must reduce to
  the same qualifying-point definition.

**Non-Goals:**
- Reproducing the old backend pipeline's outlier rejection, smoothing-field solve, or
  post-processing (monotonicity/gradient warnings). None of that carries over (see proposal).
- A general-purpose "derived signal" expression language. The VE Lambda signal's formula is
  hardcoded; the signal registry only needs to support a signal computed from other converted
  signals on the same row, not user-defined formulas.

## Decisions

### Filter evaluation lives in one selector, consumed everywhere
A single function `evaluateCorrectionFilters(rows, filterConfig) -> boolean[]` (or an equivalent
memoized selector keyed on the active log set + filter config + time selection) is the only place
that decides whether a point qualifies. The Data table, Charts, and the generation step all call
into it; Dashboard's per-instant flag looks up the same result for the row nearest the cursor.
**Alternative considered**: each consumer (table/chart/dashboard) filtering independently. Rejected
— that's exactly the "two implementations of the same rule drifting apart" risk the project is
trying to get away from by removing the backend duplicate in the first place.

This pass is O(n) over the active rows (plus the TPS-delta sub-computation below) and cheap even
for tens of thousands of rows, so it can safely re-run on every filter/log/selection change with no
debounce.

### TPS and MAP delta filters: shared two-pointer trailing-window amplitude
`computeDeltaAmplitude(rows, signal)` is generic over the signal (`'Pedal'` for TPS, `'MAP'` for
MAP) — same trailing window `[t - 200ms, t]`, computed independently per row using two monotonic
pointers as the outer loop advances by timestamp, tracking window min/max with small deques
(classic sliding-window min/max) rather than re-scanning the window per point. This keeps each pass
O(n) instead of O(n·window density), computed once per active row set (invalidated only when the
active log set changes, independent of filter values, since it doesn't depend on any filter's
threshold). Rows with less than 200ms of preceding data are never excluded by either filter (see
`tuning-ve-correction`'s "Insufficient history" scenario).

### Skip-first-N-after-loop-transition: per-log stateful pass, shared between both directions
Computed per log independently (not on the concatenated cross-log stream): a single forward pass
tracks the previous row's Lambda Loop value and a countdown; on a matching transition the countdown
resets to N and decrements on each subsequent row, excluding rows while it's still counting down.
The closed-loop and open-loop skip filters are the same mechanism with the transition predicate
flipped (open→closed vs. closed→open), factored into one shared `computeLoopTransitionSkipMask`
helper so the countdown logic isn't duplicated.

### Correction snapshot data shape
```ts
interface CorrectionCell {
  n: number              // effective sample count (sum of bilinear weights)
  mean: number | null    // weighted mean of per-point VE Lambda; null if n === 0
  median: number | null  // unweighted median of the same point set; null if n === 0
}
interface CorrectionSnapshot {
  cells: CorrectionCell[][]     // same shape as the map (rowI × colJ)
  generatedAt: number
  provenance: {
    logFilenames: string[]
    timeRange: { start_ms: number; end_ms: number } | null
    filters: CorrectionFilterConfig   // the exact config used
  }
}
```
The snapshot never stores a "factor" — Direct/Weighted factors are derived at render time from
`cell.mean`/`cell.median` and the *current* editable map value, per `tuning-ve-correction`'s
"Correction factor display modes" requirement. This is what makes map edits update the display
without regenerating: the snapshot is immutable input, the factor is a pure read-time computation
over it.

**Unit boundary, easy to get wrong**: `cell.mean`/`cell.median` are VE Lambda in real % (same scale
as the `VE` signal, e.g. `59.2`), but `editableMap`/`MapModel.cells` store raw VE (%×10, e.g. `592`
per the CSV/`HeatmapTable` convention). The factor computation must convert the map value with
`rawVeToReal()` before dividing — forgetting this once produced factors ~10x too small (e.g. 0.08
instead of ~1.0). `utils/correctionDisplay.ts`'s `computeFactor`/`computeFactorGrid` are the only
sanctioned way to compute a factor, specifically to keep this conversion in one place.

Bilinear attribution accumulates directly into this structure: for each qualifying point, compute
its (up to 4) `(rowI, colJ, weight)` contributions, and for each, add `weight` to that cell's
running weight-sum and `weight × point.veLambda` to a running weighted-value-sum (for the mean);
separately, append the point's raw `veLambda` to a per-cell list for the (unweighted) median. `n`
is the final weight-sum; `mean` is weighted-sum ÷ n; `median` is the middle value of the sorted
per-cell list.

### Where state lives
A new `useCorrectionStore` (Zustand), analogous to the removed `tuningStore`:
- `filters: CorrectionFilterConfig`, `showFilteredPoints: boolean` — persisted to localStorage
  (small, synchronous-on-init, same tier as `TuningConfig` used to be).
- `snapshot: CorrectionSnapshot | null`, `isStale: boolean` — persisted to IndexedDB (the snapshot
  can be tens of KB for a 16×16 grid with per-cell median arrays; same tier as the old
  `TuningOutput`).
- `generate()` reads `logStore` + `timeStore` + its own `filters`, runs the filter pass and
  bilinear-attribution/aggregation pass, and writes `snapshot`.

### Derived-signal mechanism
`SignalDef` gains an optional `compute?: (row: DatalogRow) => number` used instead of
`column`/`convert` when present; `DataTab`, `ChartsTab`, and `DashboardTab` already iterate
`SIGNAL_DEFS` to build their column/series/card lists, so a derived signal needs no special-casing
in those three — only the parser (which only touches `convert`-based signals) and the registry
itself change. VE Lambda is registered this way, `compute` implementing
`(Lambda1 − LambdaTarget + 1 + LambdaCorr/100) × VE`.

### Chart rendering of excluded points
When `showFilteredPoints` is true, excluded points stay in each series' data array but are tagged
so the chart renders them at reduced opacity (ECharts supports per-point `itemStyle` overrides via
a callback) — the series' x-domain and point count are unaffected, so time continuity is preserved
exactly as today. When false, excluded points are spliced out of the data array before it reaches
the chart, same mechanism `datalog-table` already uses for time-selection filtering today.

## Risks / Trade-offs

- **[Risk]** Filtering + bilinear attribution recomputing on every keystroke in a filter's numeric
  input could jank on very large concatenated logs (tens of thousands of rows) if not debounced. →
  **Mitigation**: filtering (Dashboard/Charts/Data live path) is O(n) and cheap regardless; only
  "Gerar" runs the heavier attribution pass, and it only runs on an explicit click, so there's no
  keystroke-triggered heavy work at all.
- **[Risk]** Storing the median's full per-cell point list in the snapshot (for switching
  mean/median without regenerating) grows snapshot size with sample density. → **Mitigation**:
  capped at 256 cells × however many points touch each cell; still small relative to the already-
  accepted ~200KB `TuningOutput` size mentioned in the old persistence table.
- **[Trade-off]** The snapshot approach means the VE tab can display a visibly "outdated" result
  after the user changes filters — a deliberate UX choice (see proposal.md's Why) over always-live,
  accepted for its traceability and simplicity benefits.

## Migration Plan

1. Add the new frontend pieces (signal registry change, filter panel + store, generation pipeline,
   VE tab correction section) behind no flag — this is a pre-1.0 tool with a single deploy target,
   not a gradual rollout.
2. Remove the old auto-tuning UI, `tuningStore`, `api/tuning.ts`, `api/engines.ts`, and the
   backend-upload path in the same change (no dual-running period — the two flows are mutually
   exclusive by construction, since the map has one editable-cells owner).
3. Delete `backend/` and update docs/env-var references.
4. No data migration needed: `IndexedDB`/`localStorage` keys for the removed `tuningStore` (last
   auto-tuning result, tuning config, engine id) are simply no longer read; stale keys left in a
   returning user's browser are harmless orphans (not cleaned up — same as any other removed
   localStorage key in this app's history).
**Rollback**: revert the commit(s); no server-side or data-format changes make rollback unusually
risky.
