## Context

See `proposal.md` for motivation and `specs/heatmap-editing/spec.md` for the behavior contract.
Relevant existing pieces this design builds on:

- `HeatmapTable.tsx` already owns selection state (`anchor`/`selEnd` → `sr` rectangle), the F2
  bulk-edit dialog (`bulkEditOpen`), and the `onBulkChange` callback used by every existing bulk
  operation (`handleBulkApply`, Ctrl+I/U, paste, range-delete) — each already produces a
  `{row, col, value}[]` list applied as one undo step by the caller's store.
- `mapStore.ts` already has independent `history`/`future`/`undo`/`redo` (and Ignition/Lambda
  equivalents), with clamping/rounding centralized in `bulkUpdateCells` (and its Ignition/Lambda
  equivalents) — every existing bulk op already relies on this rather than clamping itself.
- `mi-dashboard-android`'s `ui/maps/MapEditOps.kt` (`interpolateHorizontal`/`interpolateVertical`)
  is the reference algorithm to port: index-based positioning within the selection, per current
  code (a prior breakpoint-value-based version was reverted after verification against a
  reference tuning tool — see its in-code comment). Its `AxisInterpolation.kt` (bilinear,
  automatic-cursor mode) is unrelated and not used here.
- No icon library is installed; the only existing icon precedent is inline outline SVGs in
  `TuningPage.tsx`'s actions menu.

## Goals / Non-Goals

**Goals:**
- Port the index-based interpolation algorithm as pure logic inside `HeatmapTable.tsx`, reusing
  the existing `onBulkChange` path so clamping, rounding, dirty-tracking, and undo recording stay
  exactly as they are for every other bulk operation.
- Expose the two interpolate actions from both the bulk-edit dialog and a new icon toolbar, and
  expose undo/redo from the same toolbar, without duplicating history state (undo/redo state
  stays owned by `mapStore`, passed in as props).

**Non-Goals:**
- No new `mapStore` methods — `undo`/`redo`/`history.length`/`future.length` (and Ignition/Lambda
  equivalents) are read and passed down as-is.
- No whole-block bilinear fill (a single 2D surface across all four selection corners) — each
  row/column interpolates independently, matching the Android precedent's own explicit
  non-goal.
- No new icon library dependency.

## Decisions

### 1. Interpolation logic lives in `HeatmapTable.tsx`, not `mapStore.ts`

**Decision:** `interpolateHorizontal(cells, sr)` / `interpolateVertical(cells, sr)` are pure
functions co-located in `HeatmapTable.tsx`, reading the already-available `cells` prop and
selection rectangle, returning a `{row, col, value}[]` change list passed to the existing
`onBulkChange` prop.

**Why:** Every other bulk operation in this file (`handleBulkApply`, Ctrl+I/U, paste) already
follows this exact shape — computed here, applied through the same generic callback. Keeping
interpolation here avoids a third place (alongside `HeatmapTable` and `mapStore`) that needs to
know about selection rectangles, and needs no new store method since clamping/rounding already
happens uniformly in `bulkUpdateCells`.

**Alternative considered:** Add `interpolateHorizontal`/`interpolateVertical` actions to
`mapStore.ts` (mirroring `updateCell`/`bulkUpdateCells`). Rejected — would need the selection
rectangle threaded into the store (which today only ever receives already-resolved
`{row,col,value}` changes), tripling the Ignition/Lambda boilerplate for logic that is pure
selection math, not state ownership.

### 2. Non-numeric edge skips the whole row/column, not the whole operation

**Decision:** While building the change list, a row (horizontal) or column (vertical) whose edge
value is not a `number` is skipped entirely; other rows/columns in the selection still
interpolate.

**Why:** Matches the conservative behavior confirmed during exploration — no synthetic edge is
invented from a missing value, but one row/column with no data (per `heatmap-editing`'s own "Cell
with no data" requirement) shouldn't block interpolating the rest of a larger selection.

**Alternative considered:** Abort the whole operation if any edge is non-numeric. Rejected as
overly strict for a table where "no data" cells are an expected, per-cell state.

### 3. Toolbar, dialog, and keyboard share one execution path; dialog adds two buttons, no new fields

**Decision:** `BulkEditModal` gains two buttons, "Interpolar horizontal" and "Interpolar
vertical", disabled per the same span-threshold rule as the toolbar icons. The dialog buttons,
the toolbar icons, and the unmodified `H`/`V` keys (added per user follow-up request, mirroring
how every other quick-adjust action in this table already has both a keyboard shortcut and a UI
control) all call the same two handlers in `HeatmapTable.tsx` (`runInterpolateH`/
`runInterpolateV`), which build the change list and call `onBulkChange`, then (for the dialog
path) close it. `H`/`V` need no modifier key — the container keydown handler already reserves
digits/`.`/`-` for starting an inline edit, and every letter key is otherwise unused.

**Why:** These two operations take no numeric input, so gating them behind opening a dialog is
pure friction for the toolbar path, while still offering them inside the existing F2 dialog for
discoverability and consistency with the percent/add/set actions already grouped there — exactly
the "same operation, two access paths" pattern this codebase already uses for percent
(Ctrl+I/U vs. the dialog's percent field) — now three paths, matching that same precedent.

**Alternative considered:** Only add the toolbar icons, leaving the F2 dialog unchanged. Rejected
— the user explicitly asked for interpolation to be reachable through the F2 dialog, and later for
a direct keyboard shortcut too.

### 4. Undo/redo state threads down as props, not read from a store hook inside `HeatmapTable`

**Decision:** `HeatmapTable` gains four new optional props — `onUndo?`, `onRedo?`, `canUndo?`,
`canRedo?` — computed by each tab (`VETab`/`IgnitionTab`/`LambdaTab`) from `mapStore` (`undo`/
`redo`/`history.length > 0`/`future.length > 0`, or the Ignition/Lambda equivalents) and threaded
through `MapWithChart` → `EditableMapSection` → `HeatmapTable`, the same way `onCellChange`/
`onBulkChange` already are.

**Why:** `HeatmapTable` is also used read-only (`AnalysisSection`, `OriginalMapSection`) and has
no knowledge today of which map (VE/Ignition/Lambda) it renders or which store slice owns its
history — importing `mapStore` directly would break that reuse and hard-code a map identity the
component doesn't otherwise need. Props keep it store-agnostic, consistent with every other
mutation path in the file.

**Alternative considered:** Have `HeatmapTable` accept a `mapKind: 've' | 'ignition' | 'lambda'`
prop and read `mapStore` internally. Rejected — couples a generic table component to one
specific store's shape for no benefit over passing four already-computed values down.

### 5. Icons are hand-drawn inline SVGs, no new dependency

**Decision:** Five outline SVG icons (adjust/gear-slider, two arrows for horizontal interpolate,
two arrows for vertical interpolate, undo arrow, redo arrow) live in a shared
`components/MapEditIcons.tsx` module, sized and styled like the existing icon buttons in
`TuningPage.tsx` (`w-4 h-4`, `stroke="currentColor"`, `strokeWidth={2}`). Both the toolbar
(`HeatmapTable.tsx`) and the F2 dialog's two interpolate buttons (`BulkEditModal.tsx`) import from
there — the dialog's interpolate actions are icon buttons too, not text, matching the toolbar.

**Why:** Confirmed with the user — avoids adding a runtime dependency for five icons when the
codebase already has an established inline-SVG pattern. A shared module (rather than defining them
in `HeatmapTable.tsx` and importing into `BulkEditModal.tsx`) avoids a circular import, since
`HeatmapTable.tsx` already imports `BulkEditModal`.

### 6. Toolbar buttons must not steal focus or clear the table's selection

**Decision:** The toolbar sits as a sibling of the table's focusable/selection-owning div
(`wrapRef`), inside a shared outer container (`containerRef`). Each toolbar button gets
`onMouseDown={e => e.preventDefault()}` to stop the browser's default click-to-focus behavior, and
the table div's `onBlur` handler checks containment against `containerRef` (which wraps both the
toolbar and the table) instead of against itself.

**Why:** Found during manual verification — the table clears its selection (`anchor`/`selEnd`) on
blur when focus moves somewhere not contained in the table div, so that outgoing keyboard
shortcuts still make sense afterward (see `heatmap-editing`'s "Escape clears selection" and general
selection-lifecycle assumptions). The toolbar buttons are DOM siblings of that div, not
descendants, so clicking one used to blur the table and wipe the selection before the button's own
`onClick` (interpolate/undo/redo) could read it, and left focus on the button afterward so
subsequent keyboard shortcuts (arrows, F2, Ctrl+Z) silently did nothing. Preventing the mousedown's
default focus transfer keeps focus on the table through a toolbar click entirely, for the common
case; widening the blur check to `containerRef` is a second, independent guard so any future
child of the container (e.g. the F2 dialog, which already renders inside the table div and was
unaffected here) can shift focus without wiping the selection either.

**Alternative considered:** Refocus the table div after each toolbar action (e.g. via a
`setTimeout(() => wrapRef.current?.focus())`, the pattern already used to refocus after the F2
dialog closes). Rejected as a second-choice fallback — it would still let the selection get
cleared for one render before being reasserted, and doesn't address the root cause (the blur
firing at all for an interaction that's still "inside" the editing UI).

## Risks / Trade-offs

- **[Risk]** Five new icons in the table's already-compact header area could feel cramped at
  small `cellWidth` (the table already shrinks for narrow layouts, per `MapWithChart`'s
  `derivedCellWidth`).
  → **Mitigation:** The toolbar is a fixed-height row above the table, independent of
  `cellWidth`/column count, so it does not compete with per-column space the way table cells do.
- **[Risk]** A user selects a single cell and clicks interpolate horizontal/vertical — no-op per
  spec, but a silent no-op could look like a bug.
  → **Mitigation:** Both icons are disabled (not just inert) below the 3-column/3-row threshold,
  same as the dialog buttons, so the affordance itself communicates why nothing happens.

## Migration Plan

Purely additive: two new pure functions and two new props-driven handlers in `HeatmapTable.tsx`,
two new buttons in `BulkEditModal.tsx`, four new optional props threaded through
`MapWithChart`/`EditableMapSection`, and three call sites (`VETab`/`IgnitionTab`/`LambdaTab`)
wiring existing `mapStore` state into those props. No data migration, no schema change, no new
dependency. Rollback is a plain revert.
