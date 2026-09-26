# tuning-ve Specification

## Purpose
Lets the user view, manually edit, and auto-correct the ECU's VE (fuel) map using datalog data,
by delegating the correction calculation to the backend and rendering whatever result it returns.

## Requirements

### Requirement: Three-section layout
The VE tab SHALL present a read-only original map, an editable map, and an auto-tuning analysis
section that only appears once auto-tuning has been run.

#### Scenario: Before running auto-tuning
- **WHEN** the user opens the VE tab and has never run auto-tuning in this session
- **THEN** only the original (collapsible, read-only) and editable map sections are shown

#### Scenario: After running auto-tuning
- **WHEN** auto-tuning has been run at least once
- **THEN** the analysis section becomes visible below the editable map

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

### Requirement: Auto-tuning availability depends on log data
Running auto-tuning SHALL require active logs, and SHALL use only the currently selected time
interval when one exists.

#### Scenario: No active logs
- **WHEN** there are no active logs
- **THEN** the "Run Auto-tuning" control is disabled with a message explaining that logs are
  required

#### Scenario: Logs with a time selection
- **WHEN** logs are active and a time interval is selected on the timeline
- **THEN** running auto-tuning uses only the datalog points within that interval

#### Scenario: Logs without a time selection
- **WHEN** logs are active and no time interval is selected
- **THEN** running auto-tuning uses every point from all active logs

### Requirement: Running auto-tuning
Running auto-tuning SHALL ask for confirmation, send the current editable map, active logs, time
range, and tuning config to the backend, and apply the returned suggested map to the editable map.

#### Scenario: Confirming and running
- **WHEN** the user activates "Run Auto-tuning" and confirms the overwrite warning
- **THEN** the app sends the current editable map's values, the active logs, the selected time
  range (or none), and the current tuning config to the backend, and — on success — replaces the
  editable map's values with the returned suggested map, marking changed cells as modified

#### Scenario: Cancelling the confirmation
- **WHEN** the user declines the overwrite confirmation
- **THEN** no request is sent and the editable map is unchanged

#### Scenario: Run summary
- **WHEN** auto-tuning completes successfully
- **THEN** a summary is shown below the table with the number of cells corrected, cells with no
  data, and cells unchanged, plus the average/max/min correction and the RPM/MAP of the extreme
  values

#### Scenario: Run fails
- **WHEN** the backend request fails (server error, missing log data, invalid config, network
  problem, or timeout)
- **THEN** the run is aborted, the editable map is left unchanged, and a message describing the
  failure is shown to the user

### Requirement: Resetting the editable map
A "Reset" control SHALL restore the editable map to the original imported values, guarded by a
confirmation, and disabled when there are no unsaved changes.

#### Scenario: Reset with unsaved edits
- **WHEN** the editable map differs from the original and the user confirms Reset
- **THEN** every cell reverts to its original imported value

#### Scenario: Reset with no changes
- **WHEN** the editable map exactly matches the original
- **THEN** the Reset control is disabled

### Requirement: Auto-tuning analysis heatmaps
Once auto-tuning has run, the analysis section SHALL offer multiple diagnostic heatmap views over
the same MAP×RPM grid, sourced from the backend's result, with cells lacking data shown distinctly
in every view.

#### Scenario: Switching analysis view
- **WHEN** the user switches between the available diagnostic views (e.g. measured VE, sample
  coverage, confidence, variability, correction magnitude, convergence)
- **THEN** the heatmap recolors to reflect the selected view while keeping the same grid layout

#### Scenario: Cell with no data in any view
- **WHEN** a cell had no qualifying datalog samples
- **THEN** it is shown in the same distinct "no data" style regardless of which diagnostic view is
  active

#### Scenario: Tooltip is view-independent
- **WHEN** the user hovers any cell in any diagnostic view
- **THEN** the tooltip lists every available diagnostic field for that cell, not only the one
  driving the current view's color

### Requirement: Post-processing warnings panel
The analysis section SHALL include a collapsible warnings panel, always shown (even with zero
warnings), listing every post-processing violation the backend reports; warnings SHALL never block
export.

#### Scenario: Warnings present
- **WHEN** the backend's result includes post-processing warnings
- **THEN** each is listed with its RPM/MAP location and detail, and clicking a row highlights the
  corresponding cell in both the active diagnostic heatmap and the editable table

#### Scenario: No warnings
- **WHEN** the backend's result has no warnings
- **THEN** the panel is still shown, indicating zero warnings

#### Scenario: Warnings do not block export
- **WHEN** one or more warnings are present
- **THEN** the map export control (see `map-import-export`) remains available

### Requirement: Filter-statistics panel
The analysis section SHALL show a fixed panel summarizing how many datalog points were used and why
each excluded group was discarded, as reported by the backend.

#### Scenario: Displaying filter stats
- **WHEN** auto-tuning has completed
- **THEN** the panel shows the counts read, passed, and discarded per reason, with a discard reason
  that had zero occurrences shown as "0" and a discard reason disabled in the current config shown
  as "—"

### Requirement: Support chart alongside the tables
Each map section (original and editable) SHALL be paired with a chart that mirrors the table's data
and stays selection-synchronized with it in both directions.

#### Scenario: Table selection reflected in chart
- **WHEN** the user selects one or more cells in a table
- **THEN** the corresponding points are highlighted in that table's chart

#### Scenario: Chart selection reflected in table
- **WHEN** the user clicks a point, or draws a box selection, in a chart
- **THEN** the corresponding cells become selected in the paired table, ready for keyboard shortcuts
  to act on immediately

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
the actual datalog points as a scatter, and cells with zero contributing points SHALL be visually
flagged as uncorrectable by auto-tuning.

#### Scenario: Points plotted at their real coordinates
- **WHEN** logs and a time window are available
- **THEN** each datalog point is plotted at its real RPM/MAP position, with visual density
  indicating how many points fall near that position

#### Scenario: Cell with zero log points
- **WHEN** a cell has no datalog points in the current window
- **THEN** the editable map flags that cell as having no data for auto-tuning purposes

### Requirement: Config access point
The VE tab SHALL provide a control that opens the tuning engine's configuration (see
`tuning-config`), applying to every tuning tab.

#### Scenario: Opening config from the VE tab
- **WHEN** the user activates the config control in the VE tab
- **THEN** the `tuning-config` modal opens
