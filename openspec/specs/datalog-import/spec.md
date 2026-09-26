# datalog-import Specification

## Purpose
Parses MasterInjection datalog CSVs into signal rows the rest of the app consumes, and lets the
user manage the set of logs active in the current session (add, remove, reorder, enable/disable)
from both the Logs tab and the global TopBar.

## Requirements

### Requirement: Datalog CSV parsing tolerates real-world log files
Importing a datalog CSV SHALL identify columns by header name (not position), tolerate a header
reappearing mid-file, synthesize timestamps when the file has none, and discard malformed rows
instead of failing the whole import.

#### Scenario: Header reappears mid-file
- **WHEN** the logging software restarted during capture and rewrote the header partway through
  the file
- **THEN** the parser keeps reading, remapping columns from the new header from that point onward

#### Scenario: No timestamp column
- **WHEN** the CSV has no `Timestamp` column
- **THEN** the app generates one, starting at `0` and incrementing by 100 ms per row

#### Scenario: Malformed row
- **WHEN** a row has a different field count than the active header, or its RPM/MAP/Timestamp
  fields are not valid numbers
- **THEN** that row is discarded and the rest of the file continues to be parsed

#### Scenario: Known signals converted to real units
- **WHEN** the file contains recognized signal columns (RPM, MAP, Lambda 1, CLT, IAT, Lambda
  Target, Lambda Corr, ACC %, Lambda Loop, etc.)
- **THEN** each is converted from its raw encoding to its real-world unit before being used
  anywhere else in the app

#### Scenario: Large log file
- **WHEN** the imported file has tens of thousands of rows (e.g. a long road session logged at high
  frequency)
- **THEN** the import completes without freezing or crashing the browser tab

### Requirement: Duplicate log detection
Importing a file whose content matches an already-loaded log SHALL be rejected with a clear
message instead of creating a duplicate entry.

#### Scenario: Re-importing the same file
- **WHEN** the user imports a CSV whose content is identical to a log already in the session
- **THEN** the import is rejected and an error message identifies it as already loaded

### Requirement: Logs tab list management
The Logs tab SHALL let the user see every imported log with its name and duration, toggle each
log's inclusion in the active session, reorder logs, and remove a log permanently.

#### Scenario: Toggling a log inactive
- **WHEN** the user toggles a log to inactive
- **THEN** the log is visually dimmed and excluded from the active session's timeline, charts, and
  auto-tuning input, without being deleted

#### Scenario: Removing a log
- **WHEN** the user removes a log
- **THEN** the log is permanently deleted from the session and can no longer be re-enabled without
  re-importing the file

#### Scenario: Reordering logs
- **WHEN** the user drags a log to a new position in the list
- **THEN** the concatenation order used by the timeline and all downstream views updates to match,
  without discarding any log's data

### Requirement: Logs importable without a map
The Logs tab and Datalog screen SHALL be reachable and usable without any map ever being imported.

#### Scenario: Importing logs with no map loaded
- **WHEN** the user has not imported a map
- **THEN** the user can still import logs, and the Logs tab reflects them normally

### Requirement: TopBar logs control
The global TopBar SHALL let the user import logs when none are loaded, and manage active logs
through a dropdown panel once one or more are loaded.

#### Scenario: No logs loaded
- **WHEN** no logs have been imported
- **THEN** the TopBar shows an "Import Log" control accepting multiple `.csv` files at once

#### Scenario: Logs loaded
- **WHEN** one or more logs are active
- **THEN** the TopBar shows a control labeled with the log count, which opens a dropdown listing
  every log with a checkbox for inclusion, a drag handle for reordering, a remove control, and the
  total selected duration

#### Scenario: Changing logs from the TopBar panel
- **WHEN** the user checks/unchecks, reorders, or removes a log from the TopBar dropdown
- **THEN** every component that consumes log data (timeline, charts, dashboard, table) updates
  automatically without a page reload
