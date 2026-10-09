## 0. Measure the baseline

- [x] 0.1 Prepare a ~72k-row fixture (real 2h log or a synthetic one) and record, for adding a
      signal, zoom/pan and switching Datalog tabs back to Gráficos, the time spent in `buildOption`,
      `setOption` and the canvas draw. Write the numbers into `design.md` (Decisions > 0). Verify
      the numbers identify which of sections 1-3 are needed.

## 1. Window chart series data by visible range

- [x] 1.1 Extract a pure, exported helper (e.g. `windowRows(rows, mask, range, margin)`) that slices
      `rows` and `mask` together to `[start - margin, end + margin]`. Verify with unit tests that the
      slices stay index-aligned, that the whole set is returned when there is no range, and that
      the edges are clamped.
- [x] 1.2 In `SyncedChart.tsx`, feed `buildOption` the windowed rows/mask derived from the shared
      `selection` (full set when none) and set the X axis `min/max` to the first/last timestamp of
      the full row set. Verify that the zoom percentage of a windowed chart still maps to the same
      time as before and that the `datazoom` handler still writes the right selection.
- [x] 1.3 Re-window only when the visible range leaves the loaded window or its width changes by a
      large factor; pick the margin (about one visible width per side). Verify on the fixture that
      a normal pan does not rebuild the panel and that no re-window loop happens.
- [x] 1.4 Verify the spec's selection scenarios with windowing active: adding/removing a signal,
      splitting/adding a panel, first signal in an empty panel and changing the filter while a
      selection exists all still show exactly the selected range. Confirm the no-selection
      overview still renders every point (`SyncedChart.test.ts` keeps passing).

## 2. Reduce per-point overhead (only what decision 0 justifies)

- [x] 2.1 (2a) Try `silent: true` and `emphasis.disabled` on the line series (and, if needed,
      building the per-run data once per `rows`/`mask`). Verify the series `data.length` is
      unchanged for a given input, and that tooltip, cursor line and cross-panel hover sync still
      work.
- [x] 2.2 Re-run the measurement of task 0.1 with sections 1 and 2.1 applied. Verify whether the
      canvas draw is still the bottleneck; if not, skip 2.3 and record "2b not needed" in
      `design.md`.
- [x] 2.3 (2b, only if 2.2 says so; SKIPPED - 2.2 showed the draw is not the bottleneck, see `design.md`) Spike drawing the series as `lines` (`cartesian2d`,
      `polyline`, `large`) behind a switch, covering the gaps listed in `design.md` Decision 2b: NaN
      splits, tooltip via helper series + `axisValue`, `markLine`
      cursor, and a cap on the number of large series. Verify with the 72k-row fixture that every
      point still renders, gaps and per-run dimming look the same as with `line`, the tooltip and
      cursor still work, and the draw time improves; otherwise drop 2b and record why.
- [x] 2.4 Re-run the measurement with everything adopted and keep only the changes that improved
      it (record the result in `design.md`). Verify that adding a signal, zooming and panning on
      the 72k-row fixture no longer freeze the UI for seconds.

## 3. Keep the Gráficos tab mounted across Datalog tab switches

- [x] 3.1 Render `ChartsTab` (chart + signal sidebar) once in `DatalogPage`, outside the
      `<Outlet/>`, hidden with CSS when the route is not `/datalog/charts`, only when there is an
      active log; make the `charts` route render nothing. Verify the other Datalog tabs (Logs,
      Dados, Dashboard, XY, Dinamômetro) still mount/unmount via the router and that without
      active logs Gráficos still shows the `RequireLog` behavior.
- [x] 3.2 While hidden, do not rebuild the charts on filter/constants/selection changes; rebuild
      once on reveal if the inputs changed, and resize the charts on reveal. Verify by changing the
      filter on another tab and returning: the charts show the new filter and are the right size.
- [x] 3.3 Verify that switching from Gráficos to another Datalog tab and back does not recreate the
      ECharts instances or repeat the first-render cost (e.g. the panels' `onChartReady` callback
      does not fire again on return).
- [x] 3.4 Verify the chart sync context (`ChartSyncContext`, `registerChart`/`unregisterChart`,
      `echarts.connect(GROUP_ID)`) behaves correctly with the chart tree staying mounted while
      other tabs mount/unmount around it: cross-panel hover/zoom sync works after switching tabs.

## 4. Selection on release and loading indicator

- [x] 4.1 Make `TimeRail` keep a draft selection while creating, resizing or moving one, and write
      it to the store once when the drag ends (mouse up or leaving the rail); extract the drag maths
      to a pure helper. Verify with unit tests of the helper (minimum drag, normalization, handles,
      move clamping) and that no `setSelection` happens per mouse move.
- [x] 4.2 Add `useAfterPaint` and use it for each panel's `option`, with a "Carregando…" overlay
      while pending and the effects that re-apply cursor/zoom bound to the applied option. Verify
      type-check and the full test suite.
- [x] 4.3 Add `runWithBusy`/`BusyHost`/`busyStore`; close the filter dialog before applying (and
      make the "Mostrar pontos filtrados" checkbox respond at once) and close the generate dialog
      before generating, each behind the indicator; give the XY and Dinamômetro charts the same
      `useAfterPaint` overlay as the Gráficos panels. Verify type-check and the test suite.
- [x] 4.4 Apply the charts through one shared serial queue (`utils/serialQueue.ts`, one chart per
      frame, `flushSync`) so the interface can respond between charts. Verify with unit tests of
      the queue (order, one job per frame, stale jobs cost no frame) and the full suite.
- [x] 4.5 Apply the selection zoom once per chart (group cleared during the dispatch), through the
      serial queue after the indicator is painted, and skip re-dispatching a selection that came
      from the chart itself. Verify type-check and the full suite.
- [x] 4.6 Block the screen while loading: `busyStore` (ids), `useBusy`, `BusyHost` as a
      non-dismissible full-screen modal with `inert` on the app root, fed by every chart's
      `useAfterPaint`, the selection zoom and `runWithBusy`; 5,000-row minimum and 60 s watchdog.
      Verify type-check and the full suite.
- [x] 4.7 Verify in the browser with the large log: while "Carregando…" shows, clicks and keys do nothing and the modal can't be dismissed, and it goes away by itself; releasing a TimeRail drag shows "Carregando…" at once (no freeze first); applying a filter closes the dialog at once with
      "Aplicando filtro…" shown and clicks made meanwhile are not held until the end; dragging a selection on the rail does not
      freeze (only the band moves), the charts update once on release with the indicator shown
      first, and opening the Gráficos tab shows the indicator before the charts appear.

## 5. Last tab per section (requested during the work)

- [x] 5.1 Remember the last tab of Mapa and Datalog (`uiStore.mapaTab`, `datalogTab`, persisted),
      record it from the route in `MapaPage`/`DatalogPage`, and make both index routes redirect to
      it (`LastTabRedirect`, `utils/lastTab.ts`). Verify with unit tests of the helpers and, in the
      real page, Datalog (XY) -> Mapa (Arquivo) -> Datalog reopens XY and Mapa reopens Arquivo.

## 6. Spec and docs sync

- [ ] 6.1 Confirm `openspec/specs/datalog-charts/spec.md` reflects the new large-log
      responsiveness requirement after this change is archived (handled by `openspec archive`, not
      a manual edit), that the `datalog-timeline`, `datalog-filter`, `correction-runs`, `navigation-guards` and `session-persistence` deltas also sync, and that `openspec validate improve-datalog-charts-performance` passes.
- [x] 6.2 Update `frontend/CLAUDE.md`: the "Gráficos e zoom da seleção" note (windowed rows/mask,
      fixed X-axis domain, re-window policy, hidden-tab rule) and the "Gráficos e pontos filtrados"
      note (series count now applies per loaded window, not per whole log).
