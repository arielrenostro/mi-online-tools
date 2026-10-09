## REMOVED Requirements

### Requirement: Rows follow the timeline selection
**Reason**: Renamed and reworded: rows follow the single filter, with no visual-filter alternative.
**Migration**: See "Rows follow the timeline selection and the filter" below.

## MODIFIED Requirements

### Requirement: Default and optional columns
The Data table SHALL show every available signal as a column by default — the signals read from the
CSV, the derived signals (VE Lambda and Inj. Efetivo) and the signals derived from the constants of
the Configurações screen (VE Lambda Corrigido, Potência, Torque, see `datalog-constants`) — and let
the user hide any column via the same toggle mechanism used to show it again. Columns and the toggle
menu follow the grouped signal order defined by `datalog-import`.

#### Scenario: Opening with no prior column preference
- **WHEN** the user opens the Data tab for the first time
- **THEN** every available signal, including VE Lambda, Inj. Efetivo, VE Lambda Corrigido, Potência
  and Torque, appears as a column

#### Scenario: Toggling an optional column
- **WHEN** the user disables a visible column, or re-enables a hidden one
- **THEN** the table immediately shows or hides that column, keeping every other column unchanged

#### Scenario: Constants change while the table is open
- **WHEN** the user changes a constant on the Configurações screen and returns to the Data tab
- **THEN** the VE Lambda Corrigido, Potência and Torque columns show values computed with the new
  constants

#### Scenario: Related columns are adjacent
- **WHEN** the table shows VE, VE Lambda and VE Lambda Corrigido
- **THEN** those three columns are consecutive, and the column toggle menu lists them in the same order

### Requirement: Exporting visible rows
The user SHALL be able to export the currently visible rows (including dimmed ones, but excluding
rows hidden by the visibility toggle) as a CSV file that opens correctly, with accented characters
and column separation intact, in common spreadsheet software.

#### Scenario: Exporting with a selection active
- **WHEN** the user exports while a time selection filters the table
- **THEN** only the currently visible (filtered) rows are included in the exported file, with
  values already converted to their display units

#### Scenario: Exporting with dimmed rows present
- **WHEN** rows failing the applied filter are currently shown dimmed (visibility toggle set to
  "visible")
- **THEN** those dimmed rows are included in the export like any other visible row

#### Scenario: File opens correctly in spreadsheet software
- **WHEN** the exported file is opened in common spreadsheet software
- **THEN** columns are separated correctly and accented characters display correctly, without the
  user needing to manually choose an encoding or delimiter on import

## ADDED Requirements

### Requirement: Rows follow the timeline selection and the filter
The table SHALL show only rows within the timeline's selected interval when one exists, and all
rows from the active logs (concatenated) otherwise; within that set, rows also honor the applied
filter (see `datalog-filter`) and its visibility toggle.

#### Scenario: Selection active
- **WHEN** a time interval is selected on the timeline
- **THEN** only rows whose timestamp falls within that interval are shown, subject to the
  filter scenarios below

#### Scenario: No selection
- **WHEN** no time interval is selected
- **THEN** all rows from every active log, in concatenation order, are shown, subject to the
  filter scenarios below

#### Scenario: Filtered rows when the visibility toggle is "visible"
- **WHEN** the visibility toggle is set to keep excluded points visible
- **THEN** rows that fail the applied filter remain in the table, rendered with a dimmed style

#### Scenario: Filtered rows when the visibility toggle is "hidden"
- **WHEN** the visibility toggle is set to hide excluded points
- **THEN** rows that fail the applied filter are omitted from the table entirely
