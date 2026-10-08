## MODIFIED Requirements

### Requirement: Default and optional columns
The Data table SHALL show every available signal as a column by default — the signals read from the
CSV, the derived signals (VE Lambda and Inj. Efetivo) and the signals derived from the Constantes
section (VE Lambda Corrigido, Potência, Torque, see `datalog-constants`) — and let the user hide any
column via the same toggle mechanism used to show it again. Columns and the toggle menu follow the
grouped signal order defined by `datalog-import`.

#### Scenario: Opening with no prior column preference
- **WHEN** the user opens the Data tab for the first time
- **THEN** every available signal, including VE Lambda, Inj. Efetivo, VE Lambda Corrigido, Potência
  and Torque, appears as a column

#### Scenario: Toggling an optional column
- **WHEN** the user disables a visible column, or re-enables a hidden one
- **THEN** the table immediately shows or hides that column, keeping every other column unchanged

#### Scenario: Constants change while the table is open
- **WHEN** the user changes a constant on the Logs tab and returns to the Data tab
- **THEN** the VE Lambda Corrigido, Potência and Torque columns show values computed with the new
  constants

#### Scenario: Related columns are adjacent
- **WHEN** the table shows VE, VE Lambda and VE Lambda Corrigido
- **THEN** those three columns are consecutive, and the column toggle menu lists them in the same order
