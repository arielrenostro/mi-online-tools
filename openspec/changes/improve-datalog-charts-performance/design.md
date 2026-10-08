## Context

See `proposal.md` - Why. Today `SyncedChart.tsx`'s `buildOption` (called from `PanelView`'s
`option` `useMemo`, keyed on `[panel.signals, rows, mask, showFilteredPoints]`) always receives
`rows = allRows`, the full flattened active-log row set. The `dataZoom` config uses
`filterMode: 'none'` (visual-only zoom), so ECharts keeps processing every point regardless of the
visible range. Each signal is split into one line series per contiguous filter pass/fail run
(`computeRuns`) so the dimming has no gaps - this is unrelated to point count but multiplies series
count when the filter toggles state often. Switching Datalog tabs goes through nested react-router
routes (`DatalogPage.tsx`'s `<Outlet/>`), so leaving Gráficos unmounts `SyncedChart` and all its
`ReactECharts` instances; returning remounts everything and re-runs `buildOption` from scratch.

## Goals / Non-Goals

**Goals:**
- Keep every rendered point at full, per-sample resolution - no aggregation/averaging of raw
  values, at any zoom level.
- Keep the per-run pass/fail dimming exactly as precise as it is today (still per-point, no
  blending at run boundaries).
- Make signal add/remove, zoom, and pan cost roughly proportional to what's currently visible, not
  to the total log length.
- Avoid repeating the full one-time processing cost when the user just switches tabs and back.

**Non-Goals:**
- Not changing the VE correction filter/mask pipeline (`evaluateCorrectionFilters`,
  `useCorrectionMask`) - only how its output is consumed by the chart.
- Not changing what a "run" is or how dimming looks visually (color/opacity) - see Open Questions
  for a follow-up idea (markArea) that would change that and is explicitly deferred.
- Not addressing `parseDatalogText`'s synchronous main-thread parsing (import-time cost, not
  navigation) - out of scope for this change.

## Decisions

### 1. Window the rows fed into `buildOption` by the visible time range, not the whole log
Compute the panel's series data from `rows` sliced to `[visibleStart - margin, visibleEnd +
margin]` (margin so panning slightly outside the current view doesn't need an immediate
recompute), instead of always the full concatenated log. The "visible range" is the shared
`selection`/chart-zoom value that already drives `dataZoom` (`datalog-timeline`'s bidirectional
zoom contract) - no new state needed, just narrowing what `buildOption` consumes to match it.
Recompute on zoom/pan changes, debounced to the tail of a drag/scroll gesture rather than every
intermediate frame.

When there is no selection (full-log overview), the panel legitimately needs every point - that
case keeps today's cost, but it now happens once per overview render instead of on every
interaction.

**Alternative considered:** aggregated downsampling (LTTB or bucket-average) so the overview is
always cheap, sampled to the panel's pixel width. Rejected: a bucket can straddle a filter
pass/fail boundary, corrupting the dimming, and can hide a fast transient inside an averaged
bucket - both explicitly called out as unacceptable during exploration.

### 2. Enable ECharts `large: true` (and `largeThreshold` tuned below the log's typical point count) on line series
This switches ECharts to its bulk-rendering path (fewes per-point overhead: no per-point hover
dirty-checking) without dropping or averaging any point. Combined with (1), the "full overview"
case (which still has ~tens of thousands of points across possibly several run-segments) also
benefits from this, independent of windowing.

**Alternative considered:** switching to `dataset` + typed arrays (`Float64Array`) for series
`data`. Complementary, not exclusive, to `large: true`; can be added later without a spec change if
`large: true` alone isn't sufficient - noted as an implementation-time judgment call, not a
behavior change.

### 3. Keep the Gráficos tab's chart tree mounted across Datalog tab switches
Move `SyncedChart` out of the router-driven `<Outlet/>` subtree for the Datalog tabs and render it
once, always mounted, inside `DatalogPage`, toggling visibility (CSS, not unmount) based on
`datalogTab` from `useUIStore`. The other tabs (Logs, Dashboard, Dados) keep going through the
router/`Outlet` as today - only Gráficos needs this treatment since it's the only one with expensive
mount-time setup (ECharts instance creation + first `buildOption`).

**Alternative considered:** cache the last computed `option` per panel across unmounts (e.g. in a
module-level or store-held cache) and skip `buildOption` on remount if inputs haven't changed.
Rejected as primary approach: it still pays the cost of recreating the ECharts instances and their
first paint, which is most of what makes re-entering the tab feel like a freeze; keeping the
subtree mounted avoids that entirely. May still be worth adding later as a defense-in-depth cache,
but isn't required to meet the spec's re-entry scenario.

## Risks / Trade-offs

- **[Windowing adds a debounce delay before the visible range fully updates after a fast
  pan/zoom]** → Keep a margin wide enough that a single pan gesture rarely exhausts it before the
  debounce fires; tune empirically against a real 2h log during implementation.
- **[Keeping Gráficos always mounted holds ECharts instances and their data in memory even when
  the user is on another Datalog tab]** → Acceptable: the data (`allRows`, `mask`) is already held
  in the stores regardless of which tab is active: no additional data is retained, only the
  already-built ECharts DOM/canvas instances.
- **[`large: true` changes some ECharts interaction defaults (e.g. certain per-point hover
  effects)]** → The app's tooltip/cursor sync (`PanelView`'s `applyMarkLine`, `SyncedChart`'s
  `handlePointerMove`/`showTip` dispatch) is driven by explicit `dispatchAction` calls, not by
  ECharts' default hover behavior, so this is expected to be unaffected; verify during
  implementation against the existing `SyncedChart.test.ts`.

## Open Questions

- If, after (1) and (2), a panel with a very noisy correction filter (many short pass/fail runs)
  is still slow because of the resulting series count, should dimming switch from "one series per
  run" to "one series per signal + `markArea` overlays for filtered-out stretches"? This changes
  the dimming's visual granularity (a shaded band instead of a per-point-colored line) and needs
  visual sign-off, so it's deferred rather than decided here - can be answered after measuring (1)
  and (2) against a real 2h log.
