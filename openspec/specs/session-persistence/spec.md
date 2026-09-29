# session-persistence Specification

## Purpose
Guarantees the user never loses imported files or edits by closing the browser, reloading, or
restarting the computer, and defines what is kept, in what order it comes back, and what gets
invalidated when.

## Requirements

### Requirement: Work survives reload without re-importing
Closing the browser, reloading the page, or restarting the computer SHALL NOT lose the imported
map, imported logs, or any manual edits made to them.

#### Scenario: Reload after editing
- **WHEN** the user has imported a map and logs, made manual edits, and reloads the browser
- **THEN** the map, the logs, and the edits are restored automatically without re-importing any
  file

### Requirement: What persists across a session
The app SHALL persist, across reloads: the imported map (original and current edits), imported logs
(content, active/inactive state, and order), the last generated VE correction snapshot with its
provenance (logs, time range, filter values), the correction filter panel's current settings and
visibility toggle, the timeline's cursor/selection/sparkline choice, and UI layout preferences
(collapsed panels, active analysis view, chart layout/height, signal sidebar state, table column
visibility).

#### Scenario: Restoring UI preferences
- **WHEN** the user reloads after collapsing the original-map panel and customizing the chart
  layout
- **THEN** those UI preferences are restored exactly as left

#### Scenario: Restoring the last tuning result
- **WHEN** the user reloads after generating a VE correction snapshot
- **THEN** the last snapshot, its provenance, and its staleness state are available again without
  regenerating

### Requirement: Restore feedback and non-blocking startup
The app SHALL render immediately on load and confirm to the user when a prior session was restored,
without blocking the initial render on the restore process.

#### Scenario: Successful restore with prior data
- **WHEN** the app starts and finds a previously imported map or logs
- **THEN** the app renders immediately and, once restore completes, shows a brief confirmation that
  the session was restored

#### Scenario: No prior session
- **WHEN** the app starts with nothing previously imported
- **THEN** no restore confirmation is shown

### Requirement: Invalidation rules keep derived data consistent
Changing the active log set, the correction filters, or the time selection after a correction
snapshot has been generated SHALL mark it as outdated without discarding it; replacing the map
SHALL clear it, since it no longer corresponds to any map; editing the map's cells SHALL NOT affect
it.

#### Scenario: Replacing the map
- **WHEN** the user imports a new map to replace the current one
- **THEN** the last generated correction snapshot is cleared and edits reset to the newly imported
  map

#### Scenario: Removing or deactivating an active log
- **WHEN** the user removes or deactivates a log that was part of the active set
- **THEN** the last generated correction snapshot is marked as outdated, since it was computed from
  a different set of logs

#### Scenario: Reordering logs does not invalidate anything
- **WHEN** the user reorders active logs without changing which ones are active
- **THEN** the last generated correction snapshot is left untouched

#### Scenario: Changing the tuning config
- **WHEN** the user changes any correction filter (the closest equivalent left to the removed
  tuning config) after a snapshot exists
- **THEN** the snapshot is kept and displayed but marked as outdated, not discarded

#### Scenario: Changing the selected engine
- **WHEN** — this scenario no longer applies: the client-side correction algorithm has no
  selectable engines
- **THEN** there is no engine-selection trigger for snapshot invalidation; see "Changing the tuning
  config" and "Removing or deactivating an active log" above for the triggers that replace it

#### Scenario: Editing the map does not invalidate the snapshot
- **WHEN** the user edits the editable map's cells
- **THEN** the last generated correction snapshot is left untouched and not marked as outdated

### Requirement: Graceful fallback when persistent storage is unavailable
When the browser's persistent storage is unavailable (e.g., private browsing mode), the app SHALL
continue to function for the current session using in-memory state, and SHALL warn the user that a
reload will lose their work.

#### Scenario: Persistent storage unavailable
- **WHEN** the browser's persistent storage cannot be used
- **THEN** the app continues to work normally within the current session, and the user is warned
  that reloading will lose unsaved data
