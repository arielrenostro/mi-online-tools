## 1. Window chart series data by visible range

- [ ] 1.1 In `SyncedChart.tsx`, derive the panel's effective visible range from the shared
      `selection`/chart-zoom value (falling back to the full log range when there is no
      selection), and slice `rows` to `[visibleStart - margin, visibleEnd + margin]` before
      passing them into `buildOption`. Verify with a unit test that `buildOption` receives a
      row slice matching the visible range plus margin, not the full row set, when a selection
      is active.
- [ ] 1.2 Debounce recomputation of the windowed slice to the tail of a pan/zoom gesture (not
      every intermediate `dataZoom` event), and pick a margin width. Verify by dragging a
      dataZoom on a synthetic large dataset in a test/dev session and confirming the slice
      only recomputes once the gesture settles.
- [ ] 1.3 Confirm the no-selection (full overview) path still renders every point unchanged.
      Verify via `SyncedChart.test.ts` (existing behavior for the default/no-zoom case must
      keep passing).

## 2. Enable ECharts large-mode rendering

- [ ] 2.1 Add `large: true` (and a `largeThreshold` tuned below a typical log's point count) to
      the line series built in `buildOption`. Verify existing chart tests still pass and that no
      points are dropped (series `data.length` unchanged for a given input).
- [ ] 2.2 Manually verify, with a real or synthetic ~2h (≈72k-row) log, that adding a signal,
      zooming, and panning in Gráficos feel responsive (no multi-second freeze) with (1) and (2)
      combined.

## 3. Keep the Gráficos tab mounted across Datalog tab switches

- [ ] 3.1 Move `SyncedChart` out of the router-driven `<Outlet/>` subtree in `DatalogPage.tsx` (or
      restructure the Datalog routes) so it renders once and toggles visibility via CSS based on
      `datalogTab` (`useUIStore`), instead of being unmounted/remounted on tab switch. Verify the
      other Datalog tabs (Logs, Dashboard, Dados) still mount/unmount via the router as before.
- [ ] 3.2 Verify manually that switching from Gráficos to another Datalog tab and back does not
      recreate the ECharts instances or repeat the first-render cost (e.g. by confirming the
      panels' `onChartReady` callback does not fire again on return).
- [ ] 3.3 Verify the chart sync context (`ChartSyncContext`, `registerChart`/`unregisterChart`,
      `echarts.connect(GROUP_ID)`) still behaves correctly with the chart tree staying mounted
      while other tabs mount/unmount around it - existing `SyncedChart.test.ts` coverage plus a
      manual check that cross-panel hover/zoom sync still works after switching tabs.

## 4. Spec and docs sync

- [ ] 4.1 Confirm `openspec/specs/datalog-charts/spec.md` reflects the new large-log
      responsiveness requirement after this change is archived (handled by `openspec archive`,
      not a manual edit).
- [ ] 4.2 Update `frontend/CLAUDE.md`'s note on chart series-per-run if the windowing/large-mode
      changes affect the described trade-off (e.g. if series count per visible window is now
      small enough that the caveat should be qualified as "only at full-overview zoom").
