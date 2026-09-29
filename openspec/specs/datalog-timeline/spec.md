# datalog-timeline Specification

## Purpose
Provides the single shared timeline — a point cursor, an interval selection, and a signal
sparkline — that every Datalog tab and the VE correction snapshot's generation (see
`tuning-ve-correction`) read from, across all active logs concatenated in their configured order.

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
and scopes the VE correction snapshot's generation (see `tuning-ve-correction`); a drag shorter
than ~200 ms SHALL be treated as a cursor move instead of a selection.

#### Scenario: Creating a selection
- **WHEN** the user drags across the rail for at least ~200 ms
- **THEN** a selection is created spanning the dragged interval, normalized so the start is before
  the end regardless of drag direction

#### Scenario: Short drag moves the cursor instead
- **WHEN** the user drags for less than ~200 ms
- **THEN** no selection is created and the cursor moves to the release position instead

#### Scenario: Clearing the selection
- **WHEN** the user activates "Clear" or presses Escape while a selection exists
- **THEN** the selection is removed and dependent views (Data table, chart zoom) return to showing
  the full range

#### Scenario: No selection means all points
- **WHEN** no selection is active and the user generates a correction snapshot
- **THEN** every qualifying point from the active logs is used, not a subset

### Requirement: Sparkline previews a chosen signal
The timeline SHALL render a decimated sparkline of one signal, selectable by the user, defaulting
to RPM.

#### Scenario: Changing the sparkline signal
- **WHEN** the user picks a different signal from the sparkline selector
- **THEN** the rail's background sparkline redraws using that signal's values across the timeline

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
the other.

#### Scenario: Zooming a chart updates the timeline
- **WHEN** the user zooms or pans a chart panel (see `datalog-charts`)
- **THEN** the timeline's selection updates to match the chart's visible range, and the rail darkens
  the regions outside it

#### Scenario: Dragging the timeline updates chart zoom
- **WHEN** the user creates or adjusts a selection on the timeline
- **THEN** every chart panel zooms to match the new selected range
