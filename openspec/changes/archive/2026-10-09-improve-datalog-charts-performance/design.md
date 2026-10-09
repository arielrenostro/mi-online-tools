## Context

See `proposal.md` - Why. Today `SyncedChart.tsx`'s `buildOption` (called from `PanelView`'s
`option` `useMemo`, keyed on `[panel.signals, rows, mask, showFilteredPoints]`) always receives
`rows = allRows` (`useDisplayRows()`, the full flattened active-log row set) and `mask`
(`useFilterMask()`, indexed by row). The `dataZoom` config uses `filterMode: 'none'` (visual-only
zoom), so ECharts keeps processing every point regardless of the visible range, and the X axis uses
`min/max: 'dataMin'/'dataMax'`. Each signal is split into one line series per contiguous filter
pass/fail run (`computeRuns`) so the dimming has no gaps - this is unrelated to point count but
multiplies series count when the filter toggles state often.

The `option` is applied with `notMerge`, which resets the `dataZoom` to 100%; the shared
`selection` (timeStore) is the source of truth for zoom and is re-applied to a rebuilt/new chart by
`applySelectionZoom` (in `onChartReady` and in an effect on `[option]`), under the
`updatingFromExternal` flag so the `datazoom` handler doesn't write it back to the store (see the
`datalog-charts` requirement "Chart zoom follows the time selection when charts are created or
rebuilt"). Any change here must keep that contract.

Datalog tabs (Logs, Dados, Dashboard, Gráficos, XY, Dinamômetro) are nested react-router routes
rendered through `DatalogPage.tsx`'s `<Outlet/>`, each wrapped in `RequireLog`. Leaving Gráficos
unmounts `ChartsTab` (`SyncedChart` + `SignalSidebar`) and all its `ReactECharts` instances;
returning remounts everything and re-runs `buildOption` from scratch. The active tab comes from
the route (`DatalogPage` already reads `useLocation()` for the Dinamômetro); `datalogTab` in
`useUIStore` is still persisted but nothing in the page reads it.

## Goals / Non-Goals

**Goals:**
- Keep every rendered point at full, per-sample resolution - no aggregation/averaging of raw
  values, at any zoom level.
- Keep the per-run pass/fail dimming exactly as precise as it is today (still per-point, no
  blending at run boundaries).
- Make signal add/remove, zoom, and pan cost roughly proportional to what's currently visible, not
  to the total log length.
- Avoid repeating the full one-time processing cost when the user just switches Datalog tabs and
  back.
- Spend effort only where a measurement says the time goes.

**Non-Goals:**
- Not changing the filter/mask pipeline (`evaluateFilter`, `useFilterMask`) - only how its output
  is consumed by the chart.
- Not changing what a "run" is or how dimming looks visually (color/opacity) - see Open Questions
  for a follow-up idea (markArea) that would change that and is explicitly deferred.
- Not addressing `parseDatalogText`'s synchronous main-thread parsing (import-time cost, not
  navigation) - out of scope for this change.
- Not keeping the charts alive when leaving the Datalog area altogether (Mapa, Configurações):
  `DatalogPage` unmounts there and the next visit remounts as today.

## Decisions

### 0. Measure before and after
Build a ~72k-row fixture (real log or synthetic) and record, for add-signal, zoom/pan and
tab re-entry, the time spent in `buildOption`, in ECharts' `setOption` and in the canvas draw. The
numbers go in this file and decide whether decisions 1-3 are all needed and what decision 2 should
contain. Without them, the change risks optimizing the wrong step.

**Baseline (measured, Node + ECharts 5.6 SVG-SSR, 72,000 rows, one panel).** There is no browser in
the dev environment, so this covers `buildOption` and ECharts' `setOption` (data processing, layout
and element creation) but **not** the canvas rasterization. Re-measure in a real browser for that.

| Panel | `buildOption` | `setOption` |
|-------|--------------:|------------:|
| 1 signal, filter never toggles (1 series) | 5 ms | ~195 ms |
| 3 signals, filter never toggles (3 series) | 11 ms | ~310 ms |
| 3 signals, filter toggles every 500 rows (432 series) | 14 ms | ~320 ms |
| 3 signals, filter toggles every 50 rows (4,320 series) | 14 ms | ~1,015 ms |
| same 3 signals, window of 7.2k rows (10%), no toggles | - | 24 ms |
| same 3 signals, window of 7.2k rows, toggles every 50 rows (432 series) | - | 164 ms |
| 3 signals, `lines`+`large`, full 72k, no toggles | - | 186 ms |
| 3 signals, `lines`+`large`, full 72k, toggles every 50 rows | - | 692 ms |

Reading: `buildOption` itself is negligible; the cost is ECharts processing the data, and it scales
with points and series. A default layout has six panels, so one rebuild is roughly 1-2 s before
any drawing. Windowing to 10% of the log cuts `setOption` 6-13x (decision 1) and re-entry rebuilds
all panels (decision 3), so both are needed. `lines`+`large` saves ~40% of `setOption` at full
size, a modest gain next to windowing; its real effect would be in rasterization, not measured yet
(decision 2b stays gated on a browser measurement).

### 1. Window the rows and the mask fed into `buildOption` by the visible time range
Compute the panel's series data from `rows` **and the matching `mask` entries** (the mask is
indexed by row, so both are sliced together) restricted to `[visibleStart - margin, visibleEnd +
margin]`, instead of the whole concatenated log. The visible range is the shared `selection` from
timeStore (the same value that drives `dataZoom`), not the chart's internal zoom state, so there is
no new state and no read-back from ECharts. The tooltip lookup (`findLastRow`) runs against the
same windowed rows; the tooltip only fires inside the visible range, which the window covers.

Three constraints from the current code:
- **The time axis keeps the whole log's domain.** With windowed data, `dataMin/dataMax` would shrink
  the axis to the window and change what a zoom percentage means (the `datazoom` handler converts
  percentages using the full log). Set the X axis `min/max` explicitly to the first/last timestamp
  of the full row set.
- **No feedback loop.** `notMerge` resets the zoom on every new `option`, and `applySelectionZoom`
  then re-dispatches the selection. A re-window that fired on every pan frame would rebuild the
  chart continuously. Instead, re-window only when the visible range leaves the loaded window or
  its width changes by a large factor (e.g. zoom in far enough that the loaded window is mostly
  wasted); a margin of about one visible width on each side makes a normal pan stay inside it.
  Panning faster than that shows an empty edge until the next re-window - accepted.
- **No selection = full overview.** The panel legitimately needs every point; that case keeps
  today's cost, but now happens once per overview render instead of on every interaction.

**Alternative considered:** aggregated downsampling (`sampling: 'lttb'`/bucket average) so the
overview is always cheap. Rejected: it loses chart resolution (a fast transient disappears inside
an averaged bucket) and a bucket can straddle a filter pass/fail boundary, corrupting the dimming -
both explicitly unacceptable.

### 2. Reduce per-point overhead without touching the data (measurement-gated)
ECharts' `large` mode is **not available for `line` series** in ECharts 5.6 (`LineSeries` offers
only `sampling` and a disabled `progressive`), and `sampling` is rejected (decision 1). Candidates
that change no point, to be tried in this order and kept only if decision 0's numbers improve:

**2a. Cheap flags and data construction** (no change to the series type):
- series flags that skip work the app doesn't use: `silent: true` (no hit-testing on 72k points;
  tooltip and cursor are driven by explicit `dispatchAction`/`applyMarkLine`, not by per-series
  events) and `emphasis: { disabled: true }`;
- cheaper data construction in `buildOption` (fewer per-point array allocations, e.g. building each
  run's data once per `rows`/`mask` and reusing it when only `signals` change).

*Result of 2a (measured in headless Chromium against the real app, 72k rows, default filter):* the
CPU profile of a selection change was dominated by ECharts' `DataDiffer` (~2 s of ~7 s sampled) and
`SymbolDraw.updateData`. With `symbol: 'none'` the symbols are invisible but `showSymbol` stays true,
so `LineView` still diffed and walked every point on each update. `showSymbol: false` (plus `silent`
and `emphasis.disabled`) removes that: the same operation went from ~6.7 s to ~3.6 s blocked in that
environment (software-rendered, slower than a real machine), the profile is now flat (no single
hotspot; what remains grows with the number of series, i.e. pass/fail runs, see the markArea open
question). Tooltip, cursor line and rendering were checked in the real page.

*Re-measurement (tasks 2.2 and 2.4), same environment, 72k rows, six panels, default filter,
time the screen stays blocked after the action:* entering Gráficos ~4.0 s, creating a selection
~3.1 s, moving/zooming a selection ~3.1 s, a 70 % selection ~3.0 s, clearing the selection ~0.4 s.
In the CPU profile of a selection change the native part (`(program)`, which includes the canvas
rasterization) is ~19 % of the time and the rest is ECharts' JavaScript pipeline spread over many
functions, growing with the number of series. So the canvas draw is **not** the bottleneck and 2b
is **not adopted** (task 2.3 skipped). The user confirmed the interface now feels good on their
machine (faster than this software-rendered environment).

**2b. Draw with `lines` (`coordinateSystem: 'cartesian2d'`, `polyline: true`, `large: true`)
instead of `line`** - only if, after 2a and decisions 1 and 3, the measurement still shows the
canvas draw as the bottleneck. `lines` does have a large-scale draw path, shares the grid axes and
clips to the grid (`clip: true`), and takes one `lineStyle` per series, which fits the existing
one-series-per-pass/fail-run split. It is a different series type, so it only counts if every
current behavior is kept; the known gaps and how each is covered:
- *Gaps at NaN.* A `line` breaks at a NaN value, a `lines` polyline does not: split each run's data
  into separate polylines at every NaN so the gaps stay.
- *Y auto-scale.* Not a gap: every `SignalDef` has a fixed `min`/`max`, which `buildOption` already
  sets on each Y axis, so the axis never depends on the series data (this is also why windowing
  needs no Y-axis compensation).
- *Axis tooltip and cursor.* The axis tooltip is built from the series' values, which `lines`
  doesn't expose, so the formatter would receive no `params`: keep a helper series for the tooltip
  and read the instant from `axisValue` instead of `params[0].value[0]`; verify the `markLine`
  cursor (today on `series[0]`) works on a `lines` series or move it to the helper.
- *Canvas layers.* Large `lines` series draw progressively and each series above the threshold
  gets its own zlevel (canvas layer): with a noisy filter (many runs) this can be worse than today.
  Keep the number of large series bounded (e.g. fall back to `line` above N runs) or drop 2b.
- *Dimming and resolution unchanged:* same points, same per-run colors, still no `sampling`.

The decision is recorded either way: 2a/2b adopted with their numbers, or "not needed" if decisions
0, 1 and 3 already meet the spec.

### 3. Keep the Gráficos chart tree mounted across Datalog tab switches
Render `ChartsTab` (chart **and** signal sidebar) once inside `DatalogPage`, outside the `<Outlet/>`,
and hide it with CSS instead of unmounting it when the route is not `/datalog/charts`. The `charts`
route stays but renders nothing, so URLs and the tab link keep working. Show it only when there is
at least one active log (what `RequireLog` guards today), and tell it whether it is the visible tab
via a prop derived from `useLocation()` (as `DatalogPage` already does for Dinamômetro), not from
`datalogTab`. The other tabs keep going through the router/`Outlet` - only Gráficos has expensive
mount-time setup (ECharts instance creation + first `buildOption`).

Two consequences must be handled:
- **Hidden means idle.** While Gráficos is hidden, filter/constants/selection changes must not
  rebuild its charts; it rebuilds once, when shown again, if its inputs changed. Otherwise the cost
  just moves to the other tabs.
- **Size 0 while hidden.** A chart inside a `display:none` container has no size; on reveal it must
  be resized (`echarts-for-react` resizes on container size changes - verify it fires on reveal).

**Alternative considered:** cache the last computed `option` per panel across unmounts and skip
`buildOption` on remount if inputs haven't changed. Rejected as primary approach: it still pays the
cost of recreating the ECharts instances and their first paint, which is most of what makes
re-entering the tab feel like a freeze. May still be worth adding later as defense in depth.

### 4. Commit a dragged selection on release; redraw after the loading indicator is painted
Feedback after trying windowing: it feels smoother but still freezes, especially while dragging a
selection on the TimeRail. Two causes, two fixes:
- `TimeRail` calls `setSelection` on every mouse move while creating, resizing or moving a
  selection, so every consumer (Gráficos windowing, Dados, Dinamômetro, XY, `persistTime`) works per
  move. The rail now keeps the dragged interval as a local draft (band and readout follow the
  pointer, cheap) and writes it to the store once, on mouse up / leaving the rail. The drag maths
  is a pure function (`utils/railDrag.ts`). This changes the `datalog-timeline` contract (the charts
  zoom when the drag ends), so the change carries a delta for that capability.
- The ECharts `setOption` for a panel is synchronous and costs hundreds of ms on a large log; React
  can't time-slice it (it runs in the commit phase), so a spinner set in the same render never gets
  painted. `useAfterPaint(option)` hands the new `option` to the chart only after two animation
  frames, with `pending` driving a "Carregando…" overlay on the panel; a newer `option` arriving
  meanwhile replaces the waiting one (only the last is applied). The first mount waits too, so
  entering the tab paints the indicator before building the charts. Effects that re-apply the
  cursor and the selection zoom run on the option actually applied.

Feedback after that: the indicator is fine, but the screen can't be used while the charts apply
and every click given meanwhile runs afterwards. That is what a long synchronous task does - the
browser queues input until it ends. Applying all panels in one task (6 x ~100-300 ms) made it
seconds long. `useAfterPaint` therefore also puts each chart's apply into one shared serial queue
(`utils/serialQueue.ts`, injectable frame scheduler so it is unit-tested): one chart per animation
frame, applied with `flushSync` so its heavy commit happens inside its own short task, discarded
(stale) jobs cost no frame. The browser handles input and paints between charts, panels that
finished drop their overlay while the rest still show theirs, and a click is no longer deferred by
the sum of all panels, only by the one in progress.

Feedback on releasing a TimeRail drag: it froze first, only then showed "Carregando…". The freeze
was not the `option` (already deferred) but the **zoom** applied to the existing charts by an effect
right after the commit: `dispatchAction({type:'dataZoom'})` on every instance. Measured with six
connected 18k-row charts: dispatching to each one takes ~1.3 s, dispatching to one ~0.2 s - an action
on a chart of an `echarts.connect` group is propagated to the other five, so the loop did the same
zoom six times. Fixes: (1) each chart gets the zoom once, with the group cleared during its dispatch
(no propagation); (2) those dispatches run through the same serial queue after two painted frames,
one per frame, with the panel's overlay shown meanwhile; (3) a selection that came from the chart's
own wheel/drag is not re-dispatched (`echarts.connect` already propagated it), so zooming with the
wheel doesn't show the loader on every step.

Feedback after that: still odd, and anything clicked meanwhile was queued and executed afterwards.
So loading now **blocks the screen**: `busyStore` holds the operations in progress (each registered
with an id; `useBusy(active)` registers while a component is loading - `useAfterPaint` does it for
every chart, `SyncedChart` for the selection zoom - and `runWithBusy` for dialog-triggered work),
and `BusyHost` renders a full-screen modal with no close control while any is registered, sets
`inert` on `#root` (mouse and keyboard) and blurs the focused element. Guards: it only shows when
the active logs have at least 5,000 rows (below that the work is instantaneous and the modal would
just flash); a 60 s watchdog releases it if something never finishes. The text is the most recent
explicit message ("Aplicando filtro…") or "Carregando…".

**Alternative considered:** `useDeferredValue`/transitions. They keep the urgent render responsive
but the chart's own commit is still one long synchronous task, and there is no guarantee a frame is
painted before it starts; the explicit two-frame wait is deterministic.

**Not covered:** one chart's own apply is still a single synchronous task (hundreds of ms for a
72k-point overview), so input can still wait for that one. Slicing inside a chart would need
ECharts' progressive rendering, which `line` series don't have but `lines` + `large` does (split into
many polyline items, `progressive` set): that is the decision 2b spike, now also the way to bound
the per-chart block, not only to save time.

### 5. Dialogs close first; heavy work runs behind a global indicator
Feedback: after applying the filter the browser froze and the dialog could not be closed until it
finished. Applying the filter takes the mask only ~33 ms at 72k rows (measured), but it makes every
mounted screen recompute in the same synchronous React update that also closes the dialog, so the
dialog is still on screen when the freeze starts. `runWithBusy(message, fn)` (`utils/runWithBusy.ts`)
shows a global pill (`BusyHost`, driven by `busyStore`), waits two painted frames, then runs `fn`;
the pill leaves two frames after `fn` and the render it caused. The filter dialog calls `onClose()`
first and then `runWithBusy('Aplicando filtro…', apply)`; the "Mostrar pontos filtrados" checkbox
keeps a local state so it flips at once; "Gerar Correção" does the same. The per-panel `useAfterPaint`
overlay (decision 4) now also covers the XY and Dinamômetro charts, so each screen shows its own
"Carregando…" after the global pill goes away.

**Not covered:** the recalculation itself still blocks the main thread; the indicator is painted
just before. Other heavy triggers (e.g. editing a constant in Configurações, which recomputes the
runtime signals of every row) are not wrapped yet.

### 6. Last tab per section, and what the keep-mounted implementation does (decision 3, done)
Decision 3 is implemented as: `DatalogPage` renders `ChartsTab` itself, after the first visit and only
with an active log (the `charts` route keeps `RequireLog` but renders nothing), hidden with CSS on the
other tabs. `SyncedChart` takes `active` and, while it is false, works on a frozen copy of its
inputs (layout, cursor, selection, rows, mask, filter visibility), so nothing is rebuilt or zoomed
and no loading modal appears for charts nobody sees; on return the differences are applied once.
Checked in the real page: the six canvases are the same DOM nodes after leaving and returning,
re-entry is instant when nothing changed, and a filter change or a selection made on another tab
shows up (with the loader) when returning; hover and wheel-zoom sync across panels still work.

*Follow-up (feedback: "if I go to Mapa and come back it reloads"):* `DatalogPage` was a route element,
so leaving `/datalog` unmounted it and the charts with it. The section is now rendered by
`RootLayout` (after the first visit) and hidden with CSS on other sections (`visible` false: no
header, no TimeRail, no tab content; only the charts stay), and its tabs are resolved from the
pathname inside `DatalogPage` instead of by `<Outlet/>` (the `datalog` routes keep only their paths
and the index redirect; tab links became absolute). `useDisplayRows(enabled)` returns the last rows
without recomputing while the charts are out of sight, so editing a constant in Configurações does
not recompute 72k rows for a screen nobody sees. Checked in the real page: Gráficos -> Mapa ->
Configurações -> Datalog reopens Gráficos with the same six canvases and no loader, tabs and the
browser's back button still work.

Requested alongside: leaving Datalog for Mapa (or Home) and coming back must reopen the tab last
used. The TopBar keeps linking to `/datalog` and `/mapa`; their index routes now render
`LastTabRedirect`, which reads `uiStore.datalogTab` / `uiStore.mapaTab` (new, persisted in
`miot:ui`; `datalogTab` already existed but nothing used it). `DatalogPage` and `MapaPage` record
the tab from the pathname (`utils/lastTab.ts`, pure and tested). Linking the TopBar straight to the
saved tab was rejected: `NavLink` would stop highlighting the section on its other tabs.

## Risks / Trade-offs

- **[Re-windowing is rare but not free: it rebuilds the panel (`notMerge`) and re-applies the
  selection zoom]** → Keep re-windowing triggers coarse (leaving the loaded window / large width
  change) and verify that adding a signal or splitting a panel with a selection still shows exactly
  the selected range.
- **[An empty edge while panning faster than the margin]** → Margin of one visible width per side;
  tune against a real 2h log.
- **[Keeping Gráficos always mounted holds ECharts instances in memory while on another Datalog
  tab]** → Acceptable: the data (`allRows`, `mask`) is already held in the stores; only the
  already-built canvas instances are extra.
- **[Hidden charts go stale until shown]** → By design (decision 3); the first frame on reveal
  includes one rebuild only if inputs changed.
- **[Drawing with `lines` (2b) is a different series type: it can lose gaps, tooltip
  or the cursor, and can multiply canvas layers]** → Only after measurement points at the draw, as
  a spike behind a switch, with the gaps listed in Decision 2b covered or the option dropped.
- **[The loading indicator delays every chart update by two frames (~32 ms), including small ones]**
  → Acceptable for the cases that matter (large logs); revisit (skip the wait below some point
  count) if it is noticeable on small logs.
- **[`silent: true` disables ECharts' own per-series pointer events]** → The tooltip/cursor sync
  (`PanelView`'s `applyMarkLine`, `SyncedChart`'s `handlePointerMove`/`showTip` dispatch) relies on
  explicit `dispatchAction` calls on the axis tooltip; verify it still works when applying this.

## Open Questions

- If, after 1-3, a panel with a very noisy filter (many short pass/fail runs) is still slow because
  of the resulting series count, should dimming switch from "one series per run" to "one series per
  signal + `markArea` overlays for filtered-out stretches"? This changes the dimming's visual
  granularity (a shaded band instead of a per-point-colored line) and needs visual sign-off, so it
  is deferred - can be answered after measuring against a real 2h log.
- Should the vestigial `datalogTab` field of `useUIStore` be removed? Out of scope here; noted
  because this change makes it more obvious that the route, not the store, owns the active tab.
