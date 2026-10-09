## Why

A 2h datalog (~72k rows) makes the Gráficos tab unusable: adding a signal, zooming, panning, and
even leaving and returning to the tab all freeze the UI for a noticeable time. `SyncedChart.tsx`
feeds ECharts the entire flattened row set as raw, unsampled line-series data on every interaction,
with the timeline's zoom applied only visually (`filterMode: 'none'`) — the full dataset is always
resident and reprocessed. Aggregated downsampling (ECharts `sampling`, e.g. LTTB) was ruled out: it
loses chart resolution (hides fast transients) and breaks the per-run pass/fail dimming used to
visualize the applied filter, since a sampled bucket can straddle a filter boundary.

## What Changes

- Measure first: profile where the time actually goes (`buildOption`, `setOption`, canvas draw, tab
  re-entry) on a ~72k-row log, so the optimizations below are kept only if they pay off.
- Feed each chart panel only the rows (and the matching mask entries) inside the currently visible
  time window (the zoom/selection range) plus a margin, instead of the entire concatenated log — no
  fidelity loss inside the visible range. The time axis keeps spanning the whole log, so zoom and
  selection keep their meaning.
- Cut per-point overhead without dropping or merging any point, kept only if the measurement shows
  a gain: first cheap series flags (e.g. ignore hover hit-testing), then, if the canvas draw is
  still the bottleneck, drawing the series as ECharts `lines` with `large` mode (ECharts 5.6 has no
  `large` for `line` series) while keeping gaps, tooltip and cursor.
- Stop discarding the chart's ECharts instances when switching between Datalog tabs, so returning
  to Gráficos doesn't repeat the full `buildOption` + first-render cost; while Gráficos is hidden it
  does not rebuild its charts.
- Apply a selection dragged on the TimeRail only when the drag ends (while dragging, only the rail's
  band and readout follow the pointer), so dragging doesn't recompute every view per mouse move.
- Show a "Carregando…" indicator on a panel while it redraws a large amount of data, painting it
  before the heavy ECharts work starts, instead of freezing the screen without feedback.
- Close the filter and generate-correction dialogs as soon as the user confirms and run the heavy
  recalculation afterwards behind a global "working" indicator, so a dialog never sits frozen on
  screen until the work ends; the same "Carregando…" overlay covers the XY and Dinamômetro charts.
- Document, as a rejected alternative, aggregated downsampling (`sampling`/LTTB/bucket averaging)
  and why it does not fit this app.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `datalog-filter`, `correction-runs`: applying the filter / generating a run closes the dialog
  first and shows a working indicator while the recalculation runs.
- `navigation-guards`, `session-persistence`: entering Mapa or Datalog from the TopBar reopens the
  tab last used in that section (also after a reload).
- `datalog-timeline`: a selection made by dragging on the rail reaches the rest of the app (charts,
  table, ...) when the drag ends, not on every pointer move.
- `datalog-charts`: adds a requirement that panels stay responsive on large logs (tens of
  thousands of points) across signal changes, zoom/pan, and re-entry from another Datalog tab,
  without reducing the data resolution shown at the current zoom level, and show a loading
  indicator while a heavy redraw runs.

## Impact

- `frontend/src/components/SyncedChart.tsx` — `buildOption`, the windowing of rows/mask, the fixed
  time-axis domain, the `dataZoom` wiring and the series options.
- `frontend/src/features/datalog/ChartsTab.tsx` (chart + signal sidebar), `TopBar` routes (`LastTabRedirect`, `uiStore.mapaTab`) and
  `frontend/src/pages/DatalogPage.tsx` / `frontend/src/App.tsx` — how the Gráficos tab's subtree is
  kept alive across switches between Datalog tabs (the `charts` route no longer renders it).
- `frontend/src/components/TimeRail.tsx` (+ pure drag helper `utils/railDrag.ts`) — draft selection
  while dragging, committed on release; `frontend/src/hooks/useAfterPaint.ts` — loading indicator.
- `frontend/CLAUDE.md` — the "Gráficos e zoom da seleção" and "Gráficos e pontos filtrados" notes.
- No change to the timeline's sparkline decimation, `datalog-table` (already virtualized), or
  the filter/mask pipeline (`useFilterMask`, `evaluateFilter`) — this change only affects how
  already-computed rows/mask are fed into the chart rendering layer.
