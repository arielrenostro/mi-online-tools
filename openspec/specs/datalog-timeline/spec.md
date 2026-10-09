# datalog-timeline Specification

## Purpose
Provides the single shared timeline — a point cursor, an interval selection, and a signal
sparkline — that every Datalog tab and the VE correction snapshot's generation (see
`mapa-ve-correction`) read from, across all active logs concatenated in their configured order.

## Requirements

### Requirement: Point cursor drives the current instant
The timeline SHALL expose a draggable point cursor representing "now" across the whole active
timeline, consumed by the Dashboard, the Data table, and every chart.

#### Scenario: Dragging the cursor
- **WHEN** the user drags the cursor along the rail
- **THEN** the cursor position updates continuously and every consumer (dashboard cards, table
  highlight, chart cursor lines) reflects the new instant

#### Scenario: Keyboard nudging
- **WHEN** the timeline has focus and the user presses the left/right arrow keys
- **THEN** the cursor moves 100 ms per press, or 1000 ms per press when Shift is held

#### Scenario: Cursor stays within bounds
- **WHEN** any interaction would move the cursor outside `[0, total duration]`
- **THEN** the cursor is clamped to that range

### Requirement: Interval selection defines the analysis window
The timeline SHALL let the user select a time interval by dragging, which filters the Data table
and scopes the VE correction snapshot's generation (see `mapa-ve-correction`); a drag shorter
than ~200 ms SHALL be treated as a cursor move instead of a selection. While the drag is in
progress only the rail itself (the selected band and the selection readout) SHALL follow the
pointer; the selection SHALL be applied to the rest of the app once, when the drag ends.

#### Scenario: Creating a selection
- **WHEN** the user drags across the rail for at least ~200 ms
- **THEN** a selection is created spanning the dragged interval, normalized so the start is before
  the end regardless of drag direction

#### Scenario: Short drag moves the cursor instead
- **WHEN** the user drags for less than ~200 ms
- **THEN** no selection is created and the cursor moves to the release position instead

#### Scenario: Selection applies when the drag ends
- **WHEN** the user creates, resizes (by a handle) or moves a selection by dragging on the rail
- **THEN** during the drag the rail shows the band and readout following the pointer while the
  views that depend on the selection (Gráficos, Data table, Dinamômetro, XY) keep showing the
  previous selection, and when the user releases the mouse (or the pointer leaves the rail) they
  switch to the final selection in one step

#### Scenario: Clearing the selection
- **WHEN** the user activates "Clear" or presses Escape while a selection exists
- **THEN** the selection is removed and dependent views (Data table, chart zoom) return to showing
  the full range

#### Scenario: No selection means all points
- **WHEN** no selection is active and the user generates a correction snapshot
- **THEN** every qualifying point from the active logs is used, not a subset

### Requirement: Sparkline previews a chosen signal
The timeline SHALL render, behind the rail, a preview chart of one signal across the whole active
timeline, selectable by the user and defaulting to RPM. The preview SHALL be clearly visible, SHALL
keep short peaks and dips visible regardless of log length, SHALL leave a gap where the signal has
no value (instead of drawing zero), and SHALL show the signal's value at the cursor and the minimum
and maximum of its scale.

#### Scenario: Preview is shown
- **WHEN** at least one log is active
- **THEN** the rail shows the preview chart of the selected signal from the first render, aligned
  with the timeline's time axis

#### Scenario: Changing the sparkline signal
- **WHEN** the user picks a different signal from the sparkline selector
- **THEN** the rail's preview redraws using that signal's values across the timeline, with the new
  signal's minimum and maximum

#### Scenario: Short transients on long logs
- **WHEN** the active logs contain far more points than the preview can draw and the signal has a
  short spike or dip
- **THEN** the spike or dip is still visible in the preview

#### Scenario: Missing values
- **WHEN** the selected signal has no value over some stretch of the timeline
- **THEN** the preview shows a gap there instead of a line at zero

#### Scenario: Value at the cursor
- **WHEN** the cursor is on the timeline
- **THEN** the preview marks the selected signal's value at that instant and shows it formatted as
  in the rest of the app, following the cursor as it moves

### Requirement: Multiple logs render as one continuous timeline
When multiple logs are active, the timeline SHALL concatenate them in their configured order and
mark the boundary between logs, with total duration always relative to the start of the first
active log.

#### Scenario: Two active logs
- **WHEN** two logs are active
- **THEN** the timeline shows them back-to-back with a visible separator at the join point, and the
  total duration equals the sum of both logs' durations

#### Scenario: Reordering active logs
- **WHEN** the user reorders active logs (see `datalog-import`)
- **THEN** the timeline rebuilds using the new concatenation order

### Requirement: Selection is a bidirectional zoom contract with charts
The timeline's selection SHALL be the same concept as the Gráficos tab's zoom: changing one updates
the other. A selection made by dragging on the timeline reaches the charts when the drag ends (see
"Interval selection defines the analysis window").

#### Scenario: Zooming a chart updates the timeline
- **WHEN** the user zooms or pans a chart panel (see `datalog-charts`)
- **THEN** the timeline's selection updates to match the chart's visible range, and the rail darkens
  the regions outside it

#### Scenario: Dragging the timeline updates chart zoom
- **WHEN** the user creates or adjusts a selection on the timeline and releases the mouse
- **THEN** every chart panel zooms to match the new selected range
