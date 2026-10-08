## Why

A 2h datalog (~72k rows) makes the Gráficos tab unusable: adding a signal, zooming, panning, and
even leaving and returning to the tab all freeze the UI for a noticeable time. `SyncedChart.tsx`
feeds ECharts the entire flattened row set as raw, unsampled line-series data on every interaction,
with the timeline's zoom applied only visually (`filterMode: 'none'`) — the full dataset is always
resident and reprocessed. Aggregated downsampling (e.g. LTTB) was ruled out during investigation:
it would hide fast transients and break the per-run pass/fail dimming used to visualize the VE
correction filters, since a sampled bucket can straddle a filter boundary.

## What Changes

- Feed each chart panel only the rows inside the currently visible time window (the zoom/selection
  range) plus a small margin, instead of the entire concatenated log — no fidelity loss inside the
  visible range, but the overview (full 2h) is only ever built once instead of on every interaction.
- Enable ECharts' `large` render mode on the line series so 72k+ raw points render through its
  faster canvas path, with no point dropped and no change to the per-run dimming behavior.
- Stop discarding the chart's ECharts instances when navigating away from and back to the Gráficos
  tab, so returning to the tab doesn't repeat the full `buildOption` + first-render cost.
- Document, as a rejected alternative, aggregated downsampling (LTTB/bucket averaging) and why it
  does not fit this app's needs (transient visibility, per-run filter dimming).

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `datalog-charts`: adds a requirement that panels stay responsive on large logs (tens of
  thousands of points) across signal changes, zoom/pan, and tab re-entry, without reducing the
  data resolution shown at the current zoom level.

## Impact

- `frontend/src/components/SyncedChart.tsx` — `buildOption`, the `dataZoom` wiring, and the
  `ReactECharts` series options (windowing + `large` mode).
- `frontend/src/pages/DatalogPage.tsx` and/or its routing — how the Gráficos tab's subtree is kept
  alive across tab switches.
- No change to `datalog-timeline` (sparkline decimation), `datalog-table` (already virtualized), or
  the VE correction filter/mask pipeline (`useCorrectionMask`, `evaluateCorrectionFilters`) — this
  change only affects how already-computed rows/mask are fed into the chart rendering layer.
