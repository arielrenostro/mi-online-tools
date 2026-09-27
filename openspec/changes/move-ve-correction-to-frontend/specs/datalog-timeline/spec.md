## MODIFIED Requirements

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
