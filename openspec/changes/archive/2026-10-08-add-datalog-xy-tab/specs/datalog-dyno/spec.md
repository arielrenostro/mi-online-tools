## MODIFIED Requirements

### Requirement: Dinamômetro tab
The Datalog screen SHALL provide a "Dinamômetro" tab, after "XY" (the last tab), showing one chart with RPM on
the X axis, power (cv) on one Y axis and torque (kgf·m) on a second Y axis, each with its own series
and unit label. The tab SHALL carry a discreet note saying the power and torque values are calculated
from the constants set on the Configurações screen, with a link to it that navigates only when
activated.

#### Scenario: Opening the tab with active logs
- **WHEN** the user opens the Dinamômetro tab with at least one active log
- **THEN** the chart shows a power series and a torque series against RPM, with power and torque
  each readable on its own axis

#### Scenario: Hovering the chart
- **WHEN** the user hovers a point of the chart
- **THEN** a tooltip shows the RPM and the power and torque values at that point

#### Scenario: Constants change
- **WHEN** the user edits a constant or the VE calibration on the Configurações screen and returns
  to the tab
- **THEN** the curves reflect the new values

#### Scenario: Note about the constants
- **WHEN** the user opens the Dinamômetro tab
- **THEN** a low-emphasis note states that the data is calculated from the constants in
  Configurações, and activating its link opens the Configurações screen
