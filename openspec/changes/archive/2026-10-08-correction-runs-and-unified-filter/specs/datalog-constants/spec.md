## RENAMED Requirements

- FROM: `### Requirement: Constants section on the Logs tab`
- TO: `### Requirement: Constants section on the Configurações screen`

## MODIFIED Requirements

### Requirement: Constants section on the Configurações screen
The Configurações screen (see `app-settings`) SHALL show a "Constantes" section with editable fields
for engine displacement (default 1587 cc), stoichiometric air-fuel ratio (default 9), brake-specific
fuel consumption (default 0.8) and the VE calibration value (default 1000), each labeled with its
unit, and a control to restore all defaults. Edits SHALL take effect immediately, with no separate
apply step.

#### Scenario: Opening with no prior configuration
- **WHEN** the user opens the Configurações screen for the first time
- **THEN** the Constantes section shows 1587 cc, an air-fuel ratio of 9, a BSFC of 0.8 and a VE
  calibration of 1000

#### Scenario: Editing a constant
- **WHEN** the user changes any constant to a valid value
- **THEN** every derived signal that depends on it is recalculated and shown with the new value in
  Dashboard, Gráficos, Dados and Dinamômetro without reimporting any log

#### Scenario: Restoring defaults
- **WHEN** the user activates the restore-defaults control
- **THEN** all four fields return to their default values

#### Scenario: Section available without logs or a map
- **WHEN** no log and no map have been imported
- **THEN** the Constantes section is still visible and editable

### Requirement: Constants never affect the VE map correction
The constants and the calibration factor SHALL NOT influence the applied filter or the generation of
a correction run; correction generation SHALL keep using VE Lambda without the calibration factor.

#### Scenario: Generating the correction with a non-default calibration
- **WHEN** the user has set a VE calibration other than 1000 and generates a correction run
- **THEN** the generated run is identical to the one generated with the default calibration

#### Scenario: Changing the calibration after a snapshot exists
- **WHEN** the user changes any constant after a correction run (the compiled snapshot) was generated
- **THEN** the run is unchanged

## ADDED Requirements

### Requirement: Signals computed from the constants say so on hover
Wherever a signal that depends on the constants (VE Lambda Corrigido, Potência, Torque) is named —
its card in the Dashboard, its entry in the Gráficos signal sidebar and signal picker, and its
column header and column-menu entry in Dados — hovering it SHALL show a text saying the value is
computed from the constants set on the Configurações screen. Signals that do not depend on the
constants SHALL NOT show this text.

#### Scenario: Hovering a dependent signal in the Dashboard
- **WHEN** the user hovers the Potência card
- **THEN** a hover text says Potência is calculated from the constants in Configurações

#### Scenario: Hovering a dependent signal in Gráficos
- **WHEN** the user hovers Torque in the signal sidebar or the signal picker
- **THEN** the same kind of hover text is shown

#### Scenario: Hovering a dependent column in Dados
- **WHEN** the user hovers the VE Lambda Corrigido column header
- **THEN** the hover text is shown

#### Scenario: Hovering an ordinary signal
- **WHEN** the user hovers RPM or any signal read from the CSV
- **THEN** no such text is shown
