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
visibility toggle, the timeline's cursor/selection/sparkline choice, the Constantes section's values
(displacement, air-fuel ratio, BSFC, VE calibration), the Dinamômetro tab's settings (filters,
Roda/Motor choice, loss percentage, Bruto/Suavizado choice), and UI layout
preferences (collapsed panels, active analysis view, chart layout including each panel's height and
the width split between side-by-side panels, signal sidebar state, table column visibility).

#### Scenario: Restoring UI preferences
- **WHEN** the user reloads after collapsing the original-map panel and customizing the chart
  layout
- **THEN** those UI preferences are restored exactly as left

#### Scenario: Restoring panel sizes
- **WHEN** the user reloads after changing panels' heights and widths with the size buttons
- **THEN** every panel comes back with the same height and the same share of the row width

#### Scenario: Restoring a layout saved by the drag-resize version
- **WHEN** the user reloads with a chart layout saved while panel sizes were set by dragging (an
  overall height and split ratios)
- **THEN** the layout is restored with every panel at a height equivalent to what it had before,
  side-by-side panels keep their width split, and nothing is lost or shows an error

#### Scenario: Restoring the last tuning result
- **WHEN** the user reloads after generating a VE correction snapshot
- **THEN** the last snapshot, its provenance, and its staleness state are available again without
  regenerating

#### Scenario: Restoring constants and dyno settings
- **WHEN** the user reloads after changing the constants and the Dinamômetro tab's settings
- **THEN** the Constantes section and the Dinamômetro tab show the same values as before the reload,
  and the derived signals are computed with them

#### Scenario: Saved values are invalid or missing
- **WHEN** the stored constants or dyno settings are absent or unreadable
- **THEN** the defaults are used instead and no error is shown

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

### Requirement: Restored snapshot without a mode
A correction snapshot restored from a session saved before the Mode statistic existed SHALL remain
displayable and usable with Mean and Median, and the Mode option SHALL be unavailable for it until a
new snapshot is generated.

#### Scenario: Restoring an older snapshot
- **WHEN** the user reloads and the restored snapshot's cells have no mode value
- **THEN** the snapshot is shown normally with Mean and Median working, the Mode option is disabled
  with a hint that regenerating the correction factor enables it, and the snapshot is not discarded
  or flagged as outdated on that account alone

#### Scenario: Regenerating enables Mode
- **WHEN** the user runs "Gerar fator de correção" again
- **THEN** the new snapshot carries a mode for every cell with data and the Mode option is enabled

#### Scenario: Selected statistic no longer available
- **WHEN** Mode was the selected statistic and an older snapshot without mode is displayed
- **THEN** the selection falls back to Median instead of showing empty factors

### Requirement: Logs saved by an older CSV reader gain new signals on restore
When a log restored from a previous session was built by an older version of the app's CSV reader
(for example one that did not read Marcha, or the injection, battery and pressure signals), the app
SHALL rebuild that log's data from its stored CSV during restore, without the user reimporting it,
keeping the log's active/inactive state, order and position in the timeline. A log whose CSV simply
does not contain a signal SHALL NOT be rebuilt again on every restore.

#### Scenario: Restoring a log saved before Marcha existed
- **WHEN** the user reloads with a log saved by a version that did not read Marcha
- **THEN** after restore the log has the Marcha signal, and its enabled state and order are unchanged

#### Scenario: Restoring a log saved before the injection signals existed
- **WHEN** the user reloads with a log saved by a version that did not read Inj. Pulse, Inj. DT,
  ACP, dACC, Batt Volt. or Pressão Óleo, and its CSV has those columns
- **THEN** after restore the log has those signals and Inj. Efetivo, and its enabled state and
  order are unchanged

#### Scenario: Restoring an up-to-date log
- **WHEN** a restored log was built by the current version of the CSV reader
- **THEN** it is used as stored, without being rebuilt, even if its CSV has no Marcha column

#### Scenario: Rebuild fails
- **WHEN** the stored CSV of an outdated log cannot be read or parsed
- **THEN** the log is restored as stored and the restore does not fail
