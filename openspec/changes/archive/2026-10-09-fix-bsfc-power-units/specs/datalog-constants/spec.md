## MODIFIED Requirements

### Requirement: Constants section on the Configurações screen
The Configurações screen (see `app-settings`) SHALL show a "Constantes" section with editable fields
for engine displacement (default 1587 cc), stoichiometric air-fuel ratio (default 9), brake-specific
fuel consumption (default 0.8) and the VE calibration value (default 1000), each labeled with its
unit, and a control to restore all defaults. The brake-specific fuel consumption SHALL be labeled in
lb/hp·h. Edits SHALL take effect immediately, with no separate apply step.

#### Scenario: Opening with no prior configuration
- **WHEN** the user opens the Configurações screen for the first time
- **THEN** the Constantes section shows 1587 cc, an air-fuel ratio of 9, a BSFC of 0.8 (lb/hp·h) and a
  VE calibration of 1000

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

### Requirement: Power and torque signals
The app SHALL provide "Potência" (cv) and "Torque" (kgf·m) signals for every row of every active
log, always representing the engine (no drivetrain loss), computed from air mass flow and fuel
consumption as follows, using VE Lambda Corrigido as VE:

- air mass flow [kg/s] = MAP[Pa] × VE × displacement[m³] × RPM ÷ (287 × IAT[K] × 2 × 60), with
  VE as a fraction (VE% ÷ 100) and IAT[K] = IAT[ºC] + 273
- fuel mass flow [kg/s] = air mass flow ÷ (air-fuel ratio × Lambda 1)
- Potência [hp] = fuel mass flow [kg/s] × 3600 × 2.20462 ÷ BSFC, with BSFC in lb/hp·h
- Potência [cv] = Potência [hp] × 745.7 ÷ 735.5 (metric horsepower)
- Torque [kgf·m] = Potência [cv] × 716.2 ÷ RPM

#### Scenario: Reference sample from the legacy spreadsheet
- **WHEN** a row has MAP 35 kPa, RPM 2567, IAT 50 ºC, Lambda 1 0.998, VE Lambda 59.225%, the default
  constants and a calibration factor of 1.18985849
- **THEN** Potência is approximately 10.11 cv and Torque approximately 2.82 kgf·m

#### Scenario: Torque at zero RPM
- **WHEN** a row has RPM 0
- **THEN** Torque is 0 and no error occurs

#### Scenario: Row without a usable Lambda 1
- **WHEN** a row has Lambda 1 less than or equal to zero
- **THEN** Potência and Torque have no value for that row (shown as "—") instead of an infinite or
  non-numeric figure
