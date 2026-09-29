## MODIFIED Requirements

### Requirement: Logs tab list management
The Logs tab SHALL let the user see every imported log with its name and duration, toggle each
log's inclusion in the active session, reorder logs, and remove a log permanently.

#### Scenario: Toggling a log inactive
- **WHEN** the user toggles a log to inactive
- **THEN** the log is visually dimmed and excluded from the active session's timeline, charts, and
  correction snapshot generation (see `tuning-ve-correction`), without being deleted

#### Scenario: Removing a log
- **WHEN** the user removes a log
- **THEN** the log is permanently deleted from the session and can no longer be re-enabled without
  re-importing the file

#### Scenario: Reordering logs
- **WHEN** the user drags a log to a new position in the list
- **THEN** the concatenation order used by the timeline and all downstream views updates to match,
  without discarding any log's data
