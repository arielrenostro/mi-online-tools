## MODIFIED Requirements

### Requirement: What persists across a session
The app SHALL persist, across reloads: the imported map (original and current edits), imported logs
(content, active/inactive state, and order), the last generated VE correction snapshot with its
provenance (logs, time range, filter values), the correction filter panel's current settings and
visibility toggle, the timeline's cursor/selection/sparkline choice, the Constantes section's values
(displacement, air-fuel ratio, BSFC, VE calibration), the Dinamômetro tab's settings (filters,
Roda/Motor choice, loss percentage, Bruto/Suavizado choice), and UI layout
preferences (collapsed panels, active analysis view, chart layout/height, signal sidebar state, table
column visibility).

#### Scenario: Restoring UI preferences
- **WHEN** the user reloads after collapsing the original-map panel and customizing the chart
  layout
- **THEN** those UI preferences are restored exactly as left

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

## ADDED Requirements

### Requirement: Logs saved by an older CSV reader gain new signals on restore
When a log restored from a previous session was built by an older version of the app's CSV reader
(for example one that did not read Marcha), the app SHALL rebuild that log's data from its stored CSV
during restore, without the user reimporting it, keeping the log's active/inactive state, order and
position in the timeline. A log whose CSV simply does not contain a signal SHALL NOT be rebuilt again
on every restore.

#### Scenario: Restoring a log saved before Marcha existed
- **WHEN** the user reloads with a log saved by a version that did not read Marcha
- **THEN** after restore the log has the Marcha signal, and its enabled state and order are unchanged

#### Scenario: Restoring an up-to-date log
- **WHEN** a restored log was built by the current version of the CSV reader
- **THEN** it is used as stored, without being rebuilt, even if its CSV has no Marcha column

#### Scenario: Rebuild fails
- **WHEN** the stored CSV of an outdated log cannot be read or parsed
- **THEN** the log is restored as stored and the restore does not fail
