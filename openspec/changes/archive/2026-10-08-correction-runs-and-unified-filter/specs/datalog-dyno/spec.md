## REMOVED Requirements

### Requirement: Data selection
**Reason**: Renamed; it no longer mentions the removed visual filter.
**Migration**: See "Dyno data selection" below.

## MODIFIED Requirements

### Requirement: Dinamômetro tab
The Datalog screen SHALL provide a "Dinamômetro" tab, after "Dados", showing one chart with RPM on
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

### Requirement: Dyno filters
The tab SHALL provide a "Filtros" button that opens a modal dialog, styled like the Datalog filter
modal, holding its own filter fields: minimum Pedal (default 90%), minimum RPM, maximum RPM, minimum
MAP, minimum CLT (default 80 ºC), the accepted Lambda Loop states (default all three) and the accepted
gears (Marcha 0 to 5, default all six), plus the drivetrain-loss field (see "Engine and wheel
values"). An empty numeric field SHALL mean no limit, and having every gear selected SHALL mean no
gear restriction. A row SHALL be used only when it satisfies every restricting field (AND). At least
one Lambda Loop state and one gear SHALL stay selected. Edits SHALL take effect immediately (the modal
has no apply step) and the modal SHALL show how many rows are in use. The modal SHALL close through its
close button, the Escape key or a click outside it, keeping the values, and SHALL offer a control that
restores the filters and the loss to their defaults. The filters SHALL NOT be shown outside the modal.

#### Scenario: Opening and closing the filters modal
- **WHEN** the user clicks "Filtros", edits a field and closes the modal with its close button,
  Escape or a click outside it
- **THEN** the edit is kept, the chart reflects it and the modal is gone

#### Scenario: Rows in use
- **WHEN** the filters modal is open
- **THEN** it shows how many of the active rows are currently used, updating as fields change

#### Scenario: Restoring defaults
- **WHEN** the user changes filters and the loss and activates the restore-defaults control
- **THEN** every filter field and the loss return to their default values

#### Scenario: Default filters
- **WHEN** the tab is opened with no prior configuration
- **THEN** only rows with Pedal at or above 90% and CLT at or above 80 ºC are used

#### Scenario: Clearing a field
- **WHEN** the user empties the minimum Pedal field
- **THEN** rows are no longer restricted by Pedal

#### Scenario: Restricting RPM
- **WHEN** the user sets a minimum and a maximum RPM
- **THEN** rows outside that RPM range are not used

#### Scenario: Inconsistent range
- **WHEN** the minimum RPM is greater than the maximum RPM
- **THEN** both fields are flagged as invalid and the chart shows the no-data message

#### Scenario: Restricting gears
- **WHEN** the user leaves only gear 4 selected
- **THEN** only rows logged in 4th gear are used

#### Scenario: Selecting several gears
- **WHEN** the user leaves gears 3 and 4 selected
- **THEN** rows logged in 3rd or 4th gear are used

#### Scenario: All gears selected
- **WHEN** every gear is selected
- **THEN** rows are not restricted by gear, including rows that carry no gear value

#### Scenario: Gear restricted on logs without gear data
- **WHEN** the gear selection restricts gears and the active logs carry no Marcha signal
- **THEN** no row is used and the no-data message is shown together with a hint that those logs have
  no gear information

#### Scenario: Last gear cannot be unselected
- **WHEN** only one gear is selected and the user tries to unselect it
- **THEN** it stays selected

## ADDED Requirements

### Requirement: Dyno data selection
The chart SHALL be built from the rows of the active logs that pass the dyno filters and, when a
time interval is selected on the timeline, fall inside that interval. The Datalog filter (see
`datalog-filter`) SHALL NOT affect the chart.

#### Scenario: Time selection active
- **WHEN** an interval is selected on the timeline
- **THEN** only rows inside that interval and passing the dyno filters contribute to the curves

#### Scenario: Datalog filter changed
- **WHEN** the Datalog filter is changed or applied
- **THEN** the dynamometer chart is unchanged by it

#### Scenario: No row qualifies
- **WHEN** no row passes the dyno filters and the time selection
- **THEN** the chart area shows a message saying no data matches the current filters instead of an
  empty or broken chart
