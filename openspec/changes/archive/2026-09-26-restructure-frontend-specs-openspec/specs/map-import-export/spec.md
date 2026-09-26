## Purpose

Parses the MasterInjection ECU map CSV into the three MAP×RPM tables the app edits (VE, ignition,
lambda target), and exports an updated CSV back into the original ECU format — entirely in the
browser, without any backend involvement.

## ADDED Requirements

### Requirement: Map CSV import produces three aligned tables
Importing a map CSV SHALL produce three tables — VE (fuel), ignition, and lambda target — that
share the same RPM and MAP breakpoints read from the file, regardless of how many breakpoints the
file defines.

#### Scenario: Valid map CSV imported
- **WHEN** the user selects a valid MasterInjection map CSV
- **THEN** the app parses it into VE, ignition, and lambda-target tables sharing the same RPM
  (columns) and MAP (rows) breakpoints, and any other line in the file is preserved for later
  export

#### Scenario: Non-standard breakpoint count
- **WHEN** the imported CSV declares a different number of breakpoints than the current default
- **THEN** the app builds tables sized to that file's breakpoint count instead of assuming a fixed
  dimension

### Requirement: Map rows display largest MAP on top
Regardless of the order breakpoints appear in the file, the app SHALL display and let the user
interact with MAP rows ordered from largest MAP (top) to smallest (bottom).

#### Scenario: Ascending file order
- **WHEN** the source CSV lists MAP breakpoints in ascending order
- **THEN** the table the user sees still lists the largest MAP value in the top row

### Requirement: Per-table value ranges and display conversion
Each of the three tables SHALL enforce its own valid value range, and the lambda-target table
SHALL be displayed and edited as a decimal while stored as a scaled integer.

#### Scenario: VE value range
- **WHEN** a VE cell is set to a value outside 100–9999
- **THEN** the app does not accept the value as-is (see `heatmap-editing` for the interaction)

#### Scenario: Lambda target display conversion
- **WHEN** the stored lambda-target cell value is `1000`
- **THEN** the table displays and accepts edits to it as `1.00`, and any edit is converted back to
  the stored integer scale

### Requirement: TopBar map control
The global TopBar SHALL let the user import a map when none is loaded, and replace the current map
when one is loaded, without leaving the current screen.

#### Scenario: No map loaded
- **WHEN** no map has been imported
- **THEN** the TopBar shows an "Import Map" control that opens a native file picker restricted to
  `.csv`

#### Scenario: Map loaded
- **WHEN** a map has been imported
- **THEN** the TopBar shows the map's filename, and clicking it reopens the file picker to replace
  the map

#### Scenario: Replacing the current map
- **WHEN** the user selects a new file through the replace control
- **THEN** the app discards the previous map's edits and loads the new file as both the read-only
  original and the editable map, while active logs and time selection remain unchanged

### Requirement: Client-side CSV export
The app SHALL export the currently edited map as a downloadable CSV that matches the original
file's format, replacing only the VE/ignition/lambda-target lines with their current edited values
and leaving every other line unchanged.

#### Scenario: Export disabled without a map
- **WHEN** no map has been imported
- **THEN** the export control is disabled

#### Scenario: Export with a map
- **WHEN** a map is loaded and the user activates export
- **THEN** the browser immediately downloads a CSV named after the original file with a `_tuned`
  suffix, containing the current editable values for VE, ignition, and lambda-target lines and the
  original content for every other line, with no intermediate dialog
