## MODIFIED Requirements

### Requirement: Rows follow the timeline selection
The table SHALL show only rows within the timeline's selected interval when one exists, and all
rows from the active logs (concatenated) otherwise; within that set, rows also honor the active
highlight mask — the correction filters defined by `tuning-ve-correction`, or the visual filter
defined by `datalog-visual-filter` while one is active — and the visibility toggle.

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
- **THEN** rows that fail the active mask remain in the table, rendered with a dimmed style

#### Scenario: Filtered rows when the visibility toggle is "hidden"
- **WHEN** the visibility toggle is set to hide excluded points
- **THEN** rows that fail the active mask are omitted from the table entirely

#### Scenario: Visual filter active
- **WHEN** a visual filter is active
- **THEN** the dimming or omission above follows the visual filter's pass/fail state, not the
  correction filters'

### Requirement: Exporting visible rows
The user SHALL be able to export the currently visible rows (including dimmed ones, but excluding
rows hidden by the visibility toggle, whether the active mask comes from the correction filters or
from a visual filter) as a CSV file that opens correctly, with accented characters and column
separation intact, in common spreadsheet software.

#### Scenario: Exporting with a selection active
- **WHEN** the user exports while a time selection filters the table
- **THEN** only the currently visible (filtered) rows are included in the exported file, with
  values already converted to their display units

#### Scenario: Exporting with dimmed rows present
- **WHEN** rows failing the active mask are currently shown dimmed (visibility toggle set to
  "visible")
- **THEN** those dimmed rows are included in the export like any other visible row

#### Scenario: File opens correctly in spreadsheet software
- **WHEN** the exported file is opened in common spreadsheet software
- **THEN** columns are separated correctly and accented characters display correctly, without the
  user needing to manually choose an encoding or delimiter on import
