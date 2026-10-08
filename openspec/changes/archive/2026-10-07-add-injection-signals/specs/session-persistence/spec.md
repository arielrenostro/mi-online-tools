## MODIFIED Requirements

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
