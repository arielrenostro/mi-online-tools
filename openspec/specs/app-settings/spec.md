# app-settings Specification

## Purpose
Defines the Configurações screen: a top-level destination, reachable from the TopBar next to Mapa
and Datalog, that holds the user-editable constants the app needs to compute derived signals. It does
not depend on any map or log being loaded.

## Requirements

### Requirement: Configurações destination in the TopBar
The TopBar SHALL show a "Configurações" item next to "Mapa" and "Datalog" that opens the
Configurações screen, with the same active-item indication used by the other items. The screen SHALL
be addressed by its own route in the URL fragment and SHALL NOT require a map or any log.

#### Scenario: Opening from the TopBar
- **WHEN** the user activates "Configurações" in the TopBar
- **THEN** the app shows the Configurações screen and the item is marked as the active one

#### Scenario: No prerequisites
- **WHEN** no map and no log have been imported
- **THEN** the Configurações screen is reachable and fully usable

#### Scenario: Opening the route directly
- **WHEN** the user opens the Configurações URL directly or reloads while on it
- **THEN** the screen renders after the session is restored, subject to no guard

### Requirement: Constants live on the Configurações screen
The Configurações screen SHALL hold the "Constantes" section defined by `datalog-constants`
(displacement, air-fuel ratio, BSFC and VE calibration, the calibration factor and the
restore-defaults control), and SHALL say which signals depend on them (VE Lambda Corrigido, Potência
and Torque) and that they do not affect the correction factor of the map.

#### Scenario: Seeing what depends on the constants
- **WHEN** the user reads the Constantes section
- **THEN** it lists the signals computed from these values and states that the VE correction is not
  affected by them

#### Scenario: Editing takes effect everywhere
- **WHEN** the user edits a constant and goes to the Dashboard, Gráficos, Dados or Dinamômetro tab
- **THEN** the signals that depend on it already reflect the new value

### Requirement: Weighting confidence constant section
The Configurações screen SHALL have its own section for the confidence constant **k** of the
Ponderado correction, separate from the Constantes section, with a field labeled "k — constante de
confiança" (default 100), a control to restore the default, and a text explaining that the weighted
factor of each cell is `1 + (direct − 1) × n ÷ (n + k)`, where `n` is the cell's effective sample
count. The field SHALL accept any number greater than or equal to zero. Edits SHALL take effect
immediately, with no separate apply step.

#### Scenario: Opening with no prior configuration
- **WHEN** the user opens the Configurações screen for the first time
- **THEN** the weighting section shows k = 100

#### Scenario: Changing k updates the Ponderado heatmap
- **WHEN** the user sets k to 50 and opens the Eficiência Volumétrica tab with a run selected
- **THEN** the "Ponderado" heatmap shows the corrections computed with `n ÷ (n + 50)`, and a cell
  whose effective sample count is 50 shows half of its direct correction

#### Scenario: Changing k changes what "Apply corrections" writes
- **WHEN** the user changes k and applies the Weighted corrections to the map
- **THEN** the cells are multiplied by the weighted factors computed with the new k, exactly as the
  Ponderado heatmap displays

#### Scenario: k never alters stored runs
- **WHEN** the user changes k
- **THEN** no correction run in the history changes; only the derived Weighted values do

#### Scenario: k equal to zero
- **WHEN** the user sets k to 0
- **THEN** the Weighted heatmap equals the Direct heatmap for every cell with data

#### Scenario: Invalid value
- **WHEN** the user clears the field or types a negative or non-numeric value
- **THEN** the field is flagged as invalid and the last valid k keeps being used

#### Scenario: Restoring the default
- **WHEN** the user activates the restore-default control of this section
- **THEN** k returns to 100
