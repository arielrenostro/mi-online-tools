## Why

Editing a map table today requires knowing keyboard shortcuts (F2, Ctrl+Z/Y, Ctrl+I/U) with no
on-screen affordance, and there is no way to linearly fill a run of cells between two edited
edge values — a common tuning move (smoothing a ramp across an RPM or MAP range) that today
requires editing every interior cell by hand.

## What Changes

- Add two new selection-based bulk operations to the map-editing contract: **interpolate
  horizontal** and **interpolate vertical**. For a rectangular selection, each replaces the
  interior cells of every selected row (horizontal) / column (vertical) with the value linearly
  interpolated between that row's/column's own two edge values, positioned by the interior
  cell's index within the selection (not by axis breakpoint value) — ported from
  `mi-dashboard-android`'s `MapEditOps.interpolateHorizontal`/`interpolateVertical` (its current
  code, which reversed an earlier breakpoint-value-based design after verifying index-based
  against a reference tuning tool). A selection edge whose value is not a number causes that
  row/column to be skipped, not filled. Applied as a single undo step, same as the existing bulk
  operations.
- Extend the bulk-edit dialog (opened by F2) with two additional actions, "Interpolar
  horizontal" and "Interpolar vertical", alongside its existing percent/add/set fields. These
  need no numeric input — they act immediately on the current selection.
- Add an icon toolbar above the editable map table with five actions: open the adjustment
  dialog (F2), interpolate horizontal, interpolate vertical, undo, redo. The two interpolate
  icons run the same operation as the dialog's new buttons, without opening the dialog — a
  direct shortcut, mirroring how the existing Ctrl+I/Ctrl+U shortcuts already duplicate the
  dialog's percent field.
- Icons are inline SVGs matching the existing outline style already used in `TuningPage.tsx`'s
  actions menu — no new icon library dependency.

## Capabilities

### Modified Capabilities
- `heatmap-editing`: adds the interpolate-horizontal/interpolate-vertical bulk operations and the
  icon toolbar (adjust/interpolate-h/interpolate-v/undo/redo) as part of the shared N×M
  map-editing contract used by VE, Ignition, and Lambda.

## Impact

- `frontend/src/components/HeatmapTable.tsx` — toolbar UI, selection-driven interpolate
  handlers, new optional `onUndo`/`onRedo`/`canUndo`/`canRedo` props.
- `frontend/src/features/tuning/BulkEditModal.tsx` — two new action buttons.
- `frontend/src/components/MapWithChart/MapWithChart.tsx`,
  `frontend/src/features/tuning/EditableMapSection.tsx` — thread the four new props through.
- `frontend/src/features/tuning/ve/VETab.tsx`,
  `frontend/src/features/tuning/ignition/IgnitionTab.tsx`,
  `frontend/src/features/tuning/lambda/LambdaTab.tsx` — wire undo/redo/history-length from
  `mapStore` into the new props.
- No changes to `mapStore.ts` — `undo`/`redo`/`history`/`future` already exist per map; only
  `bulkUpdateCells` (and its Ignition/Lambda equivalents) are called, same as existing bulk ops.
