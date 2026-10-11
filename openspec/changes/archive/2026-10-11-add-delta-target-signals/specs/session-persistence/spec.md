## ADDED Requirements

### Requirement: Saved "Turbo Target" choices migrate to "Boost Target"
Any persisted choice that names the signal formerly called "Turbo Target" — a signal in a Gráficos
panel, a hidden/shown Dados column, the X or a Y signal of the XY tab, the sparkline signal, or a
custom axis range from Configurações — SHALL be restored as "Boost Target", keeping its position,
order and values, without showing an error. If both names are present in the same saved list, the
signal SHALL appear once.

#### Scenario: Chart panel saved with the old name
- **WHEN** the user reloads with a saved chart layout in which a panel plots "Turbo Target"
- **THEN** that panel plots "Boost Target" in the same position

#### Scenario: Custom axis range saved with the old name
- **WHEN** the user reloads with a saved custom range for "Turbo Target"
- **THEN** "Boost Target" uses that range

#### Scenario: XY or sparkline saved with the old name
- **WHEN** the user reloads with the XY tab or the sparkline set to "Turbo Target"
- **THEN** they are set to "Boost Target"

## MODIFIED Requirements

### Requirement: Logs saved by an older CSV reader gain new signals on restore
When a log restored from a previous session was built by an older version of the app's CSV reader
(for example one that did not read Marcha, or the injection, battery and pressure signals, or that
did not derive the target deltas or still named the boost target "Turbo Target"), the app
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

#### Scenario: Restoring a log saved before the target deltas existed
- **WHEN** the user reloads with a log saved by a version that had a "Turbo Target" signal and no
  Delta Lambda 1 Target or Delta Boost Target
- **THEN** after restore the log has "Boost Target", Delta Lambda 1 Target and Delta Boost Target
  and no "Turbo Target", and its enabled state and order are unchanged

#### Scenario: Restoring an up-to-date log
- **WHEN** a restored log was built by the current version of the CSV reader
- **THEN** it is used as stored, without being rebuilt, even if its CSV has no Marcha column

#### Scenario: Rebuild fails
- **WHEN** the stored CSV of an outdated log cannot be read or parsed
- **THEN** the log is restored as stored and the restore does not fail
