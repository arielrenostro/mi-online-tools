## Purpose

Guarantees the user never loses imported files or edits by closing the browser, reloading, or
restarting the computer, and defines what is kept, in what order it comes back, and what gets
invalidated when.

## ADDED Requirements

### Requirement: Work survives reload without re-importing
Closing the browser, reloading the page, or restarting the computer SHALL NOT lose the imported
map, imported logs, or any manual edits made to them.

#### Scenario: Reload after editing
- **WHEN** the user has imported a map and logs, made manual edits, and reloads the browser
- **THEN** the map, the logs, and the edits are restored automatically without re-importing any
  file

### Requirement: What persists across a session
The app SHALL persist, across reloads: the imported map (original and current edits), imported logs
(content, active/inactive state, and order), the last auto-tuning result, the tuning config and
selected engine, the timeline's cursor/selection/sparkline choice, and UI layout preferences
(collapsed panels, active analysis view, chart layout/height, signal sidebar state, table column
visibility).

#### Scenario: Restoring UI preferences
- **WHEN** the user reloads after collapsing the original-map panel and customizing the chart
  layout
- **THEN** those UI preferences are restored exactly as left

#### Scenario: Restoring the last tuning result
- **WHEN** the user reloads after running auto-tuning
- **THEN** the last auto-tuning result and its analysis views are available again without re-running

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
Actions that change the map, the active log set, or the selected engine SHALL invalidate the last
auto-tuning result, while changing only the tuning config SHALL mark it as outdated instead of
discarding it.

#### Scenario: Replacing the map
- **WHEN** the user imports a new map to replace the current one
- **THEN** the last auto-tuning result is cleared and edits reset to the newly imported map

#### Scenario: Removing or deactivating an active log
- **WHEN** the user removes or deactivates a log that was part of the active set
- **THEN** the last auto-tuning result is cleared, since it was computed from a different set of
  logs

#### Scenario: Reordering logs does not invalidate anything
- **WHEN** the user reorders active logs without changing which ones are active
- **THEN** the last auto-tuning result is left untouched

#### Scenario: Changing the tuning config
- **WHEN** the user changes the tuning config
- **THEN** any existing auto-tuning result is kept but marked as outdated, not discarded

#### Scenario: Changing the selected engine
- **WHEN** the user selects a different tuning engine
- **THEN** the last auto-tuning result is cleared, since it may no longer be a valid result for the
  newly selected engine

### Requirement: Graceful fallback when persistent storage is unavailable
When the browser's persistent storage is unavailable (e.g., private browsing mode), the app SHALL
continue to function for the current session using in-memory state, and SHALL warn the user that a
reload will lose their work.

#### Scenario: Persistent storage unavailable
- **WHEN** the browser's persistent storage cannot be used
- **THEN** the app continues to work normally within the current session, and the user is warned
  that reloading will lose unsaved data
