# datalog-table Specification

## Purpose
Shows the active logs' raw rows as a scrollable, filterable, exportable table synchronized with
the shared timeline.

## Requirements

### Requirement: Default and optional columns
The Data table SHALL show a fixed set of columns by default (time, RPM, MAP, Lambda 1, Lambda
Target, Lambda Corr, CLT), each with its own display format, and let the user show or hide any
other available signal as an additional column.

#### Scenario: Toggling an optional column
- **WHEN** the user enables an optional signal column
- **THEN** that column appears in the table alongside the default ones

### Requirement: Rows follow the timeline selection
The table SHALL show only rows within the timeline's selected interval when one exists, and all
rows from the active logs (concatenated) otherwise.

#### Scenario: Selection active
- **WHEN** a time interval is selected on the timeline
- **THEN** only rows whose timestamp falls within that interval are shown

#### Scenario: No selection
- **WHEN** no time interval is selected
- **THEN** all rows from every active log, in concatenation order, are shown

### Requirement: Cursor and row selection are linked
The row nearest the timeline cursor SHALL be highlighted and scrolled into view, and clicking a row
SHALL move the cursor to that row's instant.

#### Scenario: Cursor moves elsewhere
- **WHEN** the timeline cursor moves
- **THEN** the table highlights the corresponding row and scrolls it into view

#### Scenario: Clicking a row
- **WHEN** the user clicks a row
- **THEN** the timeline cursor moves to that row's timestamp, updating the Dashboard and charts as
  well

### Requirement: Large logs render without degradation
The table SHALL remain responsive when displaying tens of thousands of rows.

#### Scenario: Large active log
- **WHEN** the active logs together contain tens of thousands of rows
- **THEN** scrolling the table remains smooth, without rendering every row at once

### Requirement: Exporting visible rows
The user SHALL be able to export the currently visible rows as a CSV file that opens correctly,
with accented characters and column separation intact, in common spreadsheet software.

#### Scenario: Exporting with a selection active
- **WHEN** the user exports while a time selection filters the table
- **THEN** only the currently visible (filtered) rows are included in the exported file, with
  values already converted to their display units

#### Scenario: File opens correctly in spreadsheet software
- **WHEN** the exported file is opened in common spreadsheet software
- **THEN** columns are separated correctly and accented characters display correctly, without the
  user needing to manually choose an encoding or delimiter on import
