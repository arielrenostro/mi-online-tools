## 1. Interpolation logic

- [x] 1.1 In `HeatmapTable.tsx`, add pure `interpolateHorizontal(cells, sr)` / `interpolateVertical(cells, sr)` helpers: index-based per-row/per-column interpolation between the selection's own edge values, skipping a row/column whose edge value isn't a `number`, no-op below a 3-column/3-row span. Verify with a quick manual check in the browser (select a 5-column range with two numeric edges and differing interior values, run interpolate horizontal, confirm interior values ramp linearly by position and edges are untouched).
- [x] 1.2 Wire two handlers (`runInterpolateH`/`runInterpolateV`) that call the helpers and pass the resulting change list to the existing `onBulkChange` prop, matching the shape `handleBulkApply` already uses. Verify undo (Ctrl+Z) reverts an entire interpolate action in one step.

## 2. Bulk-edit dialog (F2)

- [x] 2.1 Add "Interpolar horizontal" and "Interpolar vertical" buttons to `BulkEditModal.tsx`, each disabled per the same span threshold as its toolbar counterpart (received as props), calling a new `onInterpolate('h' | 'v')` prop instead of `onApply`. Verify by opening F2 with a selection above threshold and confirming both buttons are enabled and, below threshold, disabled.
- [x] 2.2 Have `HeatmapTable.tsx` pass `onInterpolate` into `BulkEditModal`, running the same handlers from 1.2 and closing the dialog afterward. Verify clicking either button in the dialog produces the same result as the toolbar icon and closes the dialog.

## 3. Icon toolbar

- [x] 3.1 Add five inline outline-SVG icons in `HeatmapTable.tsx` (adjust, interpolate-horizontal, interpolate-vertical, undo, redo), styled like the existing icon buttons in `TuningPage.tsx` (`w-4 h-4`, `stroke="currentColor"`, `strokeWidth={2}`).
- [x] 3.2 Render a toolbar row above the table, shown only when `!readOnly`: adjustment icon opens the F2 dialog; interpolate icons call the 1.2 handlers directly (bypassing the dialog) and are disabled below the span threshold; undo/redo icons call new `onUndo`/`onRedo` props and are disabled when `canUndo`/`canRedo` (also new props) is falsy or the prop is absent. Verify each icon's enabled/disabled state matches the selection/history state by exercising it in the browser.

## 4. Prop threading for undo/redo

- [x] 4.1 Add `onUndo?`, `onRedo?`, `canUndo?`, `canRedo?` props to `HeatmapTable.tsx`'s and `MapWithChart.tsx`'s prop interfaces, passing them straight through.
- [x] 4.2 Add the same four props to `EditableMapSection.tsx`, passing them into `MapWithChart`.
- [x] 4.3 In `VETab.tsx`, `IgnitionTab.tsx`, and `LambdaTab.tsx`, select `undo`/`redo` and `history.length > 0`/`future.length > 0` (or the Ignition/Lambda equivalents) from `useMapStore` and pass them into `EditableMapSection`. Verify the toolbar's undo/redo icons work identically to the existing Ctrl+Z/Ctrl+Y shortcut on each of the three tabs.

## 5. Spec sync and final verification

- [x] 5.1 Run `npm run build` in `frontend/` and confirm it type-checks and builds with no errors.
- [x] 5.2 Manually exercise, in the browser, on the VE tab: interpolate horizontal and vertical via both the toolbar icon and the F2 dialog button, a selection with a non-numeric edge cell (row/column skipped, rest still interpolated), and undo/redo via the new icons — confirm behavior matches `specs/heatmap-editing/spec.md`'s scenarios in this change.
- [x] 5.3 Confirm no other capability's spec needs updating for this change (Ignition/Lambda tabs are still route-blocked per `tuning-ignition`/`tuning-lambda` in v1, so no user-facing change there beyond the shared component).
