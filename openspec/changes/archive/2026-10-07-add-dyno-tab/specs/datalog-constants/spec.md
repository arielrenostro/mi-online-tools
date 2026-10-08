## Purpose

Lets the user declare the engine constants and the VE calibration the app needs to estimate engine
power and torque from a datalog, and defines the signals derived from them (VE Lambda Corrigido,
Potência, Torque). These signals depend on user input that changes at runtime, so they are never
part of an imported log's stored data.

## ADDED Requirements

### Requirement: Constants section on the Logs tab
The Logs tab SHALL show a "Constantes" section with editable fields for engine displacement
(default 1587 cc), stoichiometric air-fuel ratio (default 9), brake-specific fuel consumption
(default 0.8) and the VE calibration value (default 1000), each labeled with its unit, and a control
to restore all defaults. Edits SHALL take effect immediately, with no separate apply step.

#### Scenario: Opening with no prior configuration
- **WHEN** the user opens the Logs tab for the first time
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

### Requirement: Field validation
Each constant SHALL accept only a number greater than zero. An empty, non-numeric, zero or negative
entry SHALL be flagged as invalid and SHALL NOT replace the last valid value in effect.

#### Scenario: Entering an invalid value
- **WHEN** the user clears a field or types `0` or a negative number
- **THEN** the field is visibly flagged as invalid and derived signals keep using the last valid
  value of that constant

#### Scenario: Correcting an invalid value
- **WHEN** the user then types a valid number
- **THEN** the flag disappears and the new value takes effect

### Requirement: VE calibration is expressed as the current VE where VE should be 100%
The VE calibration field SHALL be labeled "Qual o valor de VE atual onde a VE deveria ser 100%?" and
SHALL be expressed in the same scale as the map's VE table, where 100% is shown as 1000. The section
SHALL display the resulting calibration factor `k = 1000 / informed value`. No MAP or RPM field is
part of the calibration.

#### Scenario: Default calibration
- **WHEN** the calibration field holds 1000
- **THEN** the displayed factor is 1.000 and VE Lambda Corrigido equals VE Lambda

#### Scenario: Map shows less than 100% where it should be 100%
- **WHEN** the user informs 873 because the map currently shows 873 in the cell where VE should be
  100%
- **THEN** the displayed factor is approximately 1.145

### Requirement: VE Lambda Corrigido signal
The app SHALL provide a "VE Lambda Corrigido" signal, in % like VE Lambda, equal to VE Lambda
multiplied by the calibration factor `k`, for every row of every active log.

#### Scenario: Calibration changes
- **WHEN** the user changes the VE calibration value
- **THEN** VE Lambda Corrigido is recalculated for every row while VE Lambda keeps its original value

### Requirement: Power and torque signals
The app SHALL provide "Potência" (cv) and "Torque" (kgf·m) signals for every row of every active
log, always representing the engine (no drivetrain loss), computed from air mass flow and fuel
consumption as follows, using VE Lambda Corrigido as VE:

- air mass flow [kg/s] = MAP[Pa] × VE × displacement[m³] × RPM ÷ (287 × IAT[K] × 2 × 60), with
  VE as a fraction (VE% ÷ 100) and IAT[K] = IAT[ºC] + 273
- fuel mass flow [kg/s] = air mass flow ÷ (air-fuel ratio × Lambda 1)
- Potência [cv] = fuel mass flow [kg/s] × 3600 × 2.20462 ÷ BSFC
- Torque [kgf·m] = Potência × 716.2 ÷ RPM

#### Scenario: Reference sample from the legacy spreadsheet
- **WHEN** a row has MAP 35 kPa, RPM 2567, IAT 50 ºC, Lambda 1 0.998, VE Lambda 59.225%, the default
  constants and a calibration factor of 1.18985849
- **THEN** Potência is approximately 9.98 cv and Torque approximately 2.78 kgf·m

#### Scenario: Torque at zero RPM
- **WHEN** a row has RPM 0
- **THEN** Torque is 0 and no error occurs

#### Scenario: Row without a usable Lambda 1
- **WHEN** a row has Lambda 1 less than or equal to zero
- **THEN** Potência and Torque have no value for that row (shown as "—") instead of an infinite or
  non-numeric figure

### Requirement: Derived signals behave as regular signals
VE Lambda Corrigido, Potência and Torque SHALL be selectable and displayed in Gráficos, listed in the
signal sidebar and the Dashboard, and shown as columns in Dados (including CSV export), exactly like
the signals read from the CSV. They SHALL NOT be written into an imported log's stored content.

#### Scenario: Reload after changing constants
- **WHEN** the user changes the constants and reloads the browser
- **THEN** the constants are restored and the derived signals are recomputed from the restored logs
  with those constants

#### Scenario: Charting a derived signal
- **WHEN** the user adds Potência to a chart panel
- **THEN** the series is drawn like any other signal, in cv

### Requirement: Constants never affect the VE map correction
The constants and the calibration factor SHALL NOT influence the correction filters, the visual
filter or the generation of the VE correction snapshot; correction generation SHALL keep using VE
Lambda without the calibration factor.

#### Scenario: Generating the correction with a non-default calibration
- **WHEN** the user has set a VE calibration other than 1000 and runs "Gerar fator de correção"
- **THEN** the generated snapshot is identical to the one generated with the default calibration

#### Scenario: Changing the calibration after a snapshot exists
- **WHEN** the user changes any constant after a correction snapshot was generated
- **THEN** the snapshot is not marked as outdated
