## Purpose

Describes the lambda-target map tab: locked from user interaction in v1, but present in navigation
and specified for when it unlocks — manual-only editing with a decimal display scale.

## ADDED Requirements

### Requirement: Locked in v1
The Lambda tab SHALL be visible in navigation but not interactive in v1, following the locked-tab
pattern defined in `navigation-guards`.

#### Scenario: Tab present but inert
- **WHEN** the user is on the Tuning screen
- **THEN** the Lambda tab is visible in the tab bar but behaves as a locked tab (see
  `navigation-guards`)

### Requirement: Predicted layout (manual editing only)
Once unlocked, the Lambda tab SHALL present a read-only original map and an editable map, both
following the `heatmap-editing` contract, with no auto-tuning control — editing is manual only.

#### Scenario: No auto-tuning control
- **WHEN** the Lambda tab is active (post-unlock)
- **THEN** no "Run Auto-tuning" control is present; only manual editing and Reset are available

#### Scenario: Independent undo history
- **WHEN** the user undoes an edit while on the Lambda tab
- **THEN** only the Lambda table's own edit history is affected, independent of the VE and Ignition
  tables' histories

### Requirement: Decimal display with integer storage
Lambda-target cells SHALL be stored as scaled integers but displayed and edited as a two-decimal
lambda value; conversion happens only at this tab's boundary.

#### Scenario: Displaying a stored value
- **WHEN** a lambda-target cell is stored as `1000`
- **THEN** the table displays and accepts edits to it as `1.00`

#### Scenario: Editing a displayed value
- **WHEN** the user edits a cell's displayed value to `0.85`
- **THEN** the stored value is updated to `850`

#### Scenario: Quick percentage adjustment operates on the decimal value
- **WHEN** the user applies the ±1% quick-adjust shortcut to a cell displayed as `1.00`
- **THEN** the displayed value becomes `1.01` (or `0.99`), which is then converted to its stored
  integer form

### Requirement: Chart Y-axis fits the real data range
The Lambda tab's support chart SHALL scale its Y axis to the actual data range with a 5% padding,
without rounding to whole numbers, to keep small variations visible.

#### Scenario: Narrow data range
- **WHEN** the displayed lambda values range from 0.78 to 1.00
- **THEN** the chart's Y axis spans approximately 0.77 to 1.01, not rounded to integers

### Requirement: Edits are included in map export
Edited lambda-target values SHALL be included automatically in the exported map CSV (see
`map-import-export`), scaled back to their stored integer form, replacing the original lambda
lines.

#### Scenario: Exporting after editing lambda targets
- **WHEN** the user has edited lambda-target cells and exports the map
- **THEN** the exported CSV's lambda lines contain the edited values multiplied back to their
  integer scale
