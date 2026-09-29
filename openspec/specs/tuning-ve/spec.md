# tuning-ve Specification

## Purpose
Lets the user view and manually edit the ECU's VE (fuel) map, informed by a read-only correction
heatmap (see `tuning-ve-correction`) computed entirely client-side from the active datalogs.

## Requirements

### Requirement: Three-section layout
The VE tab SHALL present a read-only original map, an editable map, and a correction section that
only appears once a correction snapshot has been generated (see `tuning-ve-correction`).

#### Scenario: Before running auto-tuning
- **WHEN** the user opens the VE tab and no correction snapshot has been generated in this session
- **THEN** only the original (collapsible, read-only) and editable map sections are shown

#### Scenario: After running auto-tuning
- **WHEN** a correction snapshot has been generated at least once (see `tuning-ve-correction`'s
  "Gerar fator de correção" action)
- **THEN** the correction section becomes visible below the editable map

#### Scenario: Original map collapse state persists
- **WHEN** the user collapses or expands the original map section
- **THEN** that collapsed/expanded state is remembered across the session (see
  `session-persistence`)

### Requirement: Editable map uses the shared editing contract
The editable map section SHALL follow the `heatmap-editing` capability's selection, keyboard,
inline/bulk-edit, clipboard, and undo/redo behavior, starting as a copy of the original map.

#### Scenario: Editable map starts as a copy
- **WHEN** a map is first imported
- **THEN** the editable VE map's initial values equal the original map's values exactly

### Requirement: Resetting the editable map
A "Reset" control SHALL restore the editable map to the original imported values, guarded by a
confirmation, and disabled when there are no unsaved changes.

#### Scenario: Reset with unsaved edits
- **WHEN** the editable map differs from the original and the user confirms Reset
- **THEN** every cell reverts to its original imported value

#### Scenario: Reset with no changes
- **WHEN** the editable map exactly matches the original
- **THEN** the Reset control is disabled

### Requirement: Support chart alongside the tables
Each map section (original and editable) SHALL be paired with a chart that mirrors the table's data
and stays selection-synchronized in both directions with the selection shared by every table of the
VE tab (see `heatmap-editing`).

#### Scenario: Table selection reflected in chart
- **WHEN** the user selects one or more cells in any table of the VE tab (original, editable, or a
  correction table)
- **THEN** the corresponding points are highlighted in every map chart that is visible

#### Scenario: Chart selection reflected in table
- **WHEN** the user clicks a point, or draws a box selection, in a chart
- **THEN** the corresponding cells become the shared selection, shown in every table, and keyboard
  shortcuts of the editable table act on it immediately

#### Scenario: Orientation and dimensionality toggles
- **WHEN** the user switches the chart's orientation (MAP×RPM / RPM×MAP) or mode (2D / 3D)
- **THEN** the chart redraws accordingly, and the chosen orientation/mode is remembered across the
  session

#### Scenario: Resizable split
- **WHEN** the user drags the handle between a table and its chart
- **THEN** their relative widths adjust, remembered across the session, within a fixed minimum and
  maximum ratio

### Requirement: Log-point overlay on the editable map
When logs and a time selection define an analysis window, the editable map's chart SHALL overlay
the actual datalog points as a scatter, and cells the correction snapshot (see
`tuning-ve-correction`) flags as having no data SHALL be visually flagged as uncorrectable.

#### Scenario: Points plotted at their real coordinates
- **WHEN** logs and a time window are available
- **THEN** each datalog point is plotted at its real RPM/MAP position, with visual density
  indicating how many points fall near that position

#### Scenario: Cell with zero log points
- **WHEN** a cell has no datalog points in the current window
- **THEN** the editable map flags that cell as having no correction data available
