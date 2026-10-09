# mapa-ignition Specification

## Purpose
Describes the ignition (spark advance) map tab: locked from user interaction in v1, but present in
navigation and specified for when it unlocks — manual-only editing of the ignition table.

## Requirements

### Requirement: Locked in v1
The Ignition tab SHALL be visible in navigation but not interactive in v1, following the locked-tab
pattern defined in `navigation-guards`.

#### Scenario: Tab present but inert
- **WHEN** the user is on the Mapa screen
- **THEN** the Ignition tab is visible in the tab bar but behaves as a locked tab (see
  `navigation-guards`)

### Requirement: Predicted layout (manual editing only)
Once unlocked, the Ignition tab SHALL present a read-only original map and an editable map, both
following the `heatmap-editing` contract, with no auto-tuning control — editing is manual only.

#### Scenario: No auto-tuning control
- **WHEN** the Ignition tab is active (post-unlock)
- **THEN** no "Run Auto-tuning" control is present; only manual editing and Reset are available

#### Scenario: Editing follows the shared contract
- **WHEN** the user edits an ignition cell
- **THEN** selection, keyboard shortcuts, inline/bulk edit, clipboard, and undo/redo behave exactly
  as specified in `heatmap-editing`

#### Scenario: Independent undo history
- **WHEN** the user undoes an edit while on the Ignition tab
- **THEN** only the Ignition table's own edit history is affected, independent of the VE and Lambda
  tables' histories

### Requirement: Values are raw integers with no scale conversion
Ignition cell values SHALL be displayed, edited, and stored as plain integers within a 0–100 range,
with no unit conversion.

#### Scenario: Editing an ignition cell
- **WHEN** the user edits an ignition cell to a value within 0–100
- **THEN** the stored, displayed, and edited value are the same integer, with no scaling applied

### Requirement: Edits are included in map export
Edited ignition values SHALL be included automatically in the exported map CSV (see
`map-import-export`), replacing the original ignition lines.

#### Scenario: Exporting after editing ignition
- **WHEN** the user has edited ignition cells and exports the map
- **THEN** the exported CSV's ignition lines reflect the edited values
