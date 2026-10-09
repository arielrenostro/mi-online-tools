## MODIFIED Requirements

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
