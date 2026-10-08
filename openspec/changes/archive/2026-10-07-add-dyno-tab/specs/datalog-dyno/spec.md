## Purpose

Shows the engine's estimated power and torque against RPM, built from the active logs, so the user
can read the power curve of a run (at the engine or at the wheels, raw or smoothed) without leaving
the app. Uses the Potência and Torque signals defined by `datalog-constants`.

## ADDED Requirements

### Requirement: Dinamômetro tab
The Datalog screen SHALL provide a "Dinamômetro" tab, after "Dados", showing one chart with RPM on
the X axis, power (cv) on one Y axis and torque (kgf·m) on a second Y axis, each with its own series
and unit label.

#### Scenario: Opening the tab with active logs
- **WHEN** the user opens the Dinamômetro tab with at least one active log
- **THEN** the chart shows a power series and a torque series against RPM, with power and torque
  each readable on its own axis

#### Scenario: Hovering the chart
- **WHEN** the user hovers a point of the chart
- **THEN** a tooltip shows the RPM and the power and torque values at that point

#### Scenario: Constants change
- **WHEN** the user edits a constant or the VE calibration on the Logs tab and returns to the tab
- **THEN** the curves reflect the new values

### Requirement: Data selection
The chart SHALL be built from the rows of the active logs that pass the dyno filters and, when a
time interval is selected on the timeline, fall inside that interval. The correction filters and the
visual filter SHALL NOT affect the chart.

#### Scenario: Time selection active
- **WHEN** an interval is selected on the timeline
- **THEN** only rows inside that interval and passing the dyno filters contribute to the curves

#### Scenario: Visual filter active
- **WHEN** a visual filter is active
- **THEN** the dynamometer chart is unchanged by it

#### Scenario: No row qualifies
- **WHEN** no row passes the dyno filters and the time selection
- **THEN** the chart area shows a message saying no data matches the current filters instead of an
  empty or broken chart

### Requirement: Dyno filters
The tab SHALL provide a "Filtros" button that opens a modal dialog, styled like the visual filter
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

### Requirement: Engine and wheel values
The tab SHALL provide a Roda / Motor switch, and the filters modal SHALL hold a drivetrain-loss field
in percent (default 15, accepted range 0 to 100). In Motor mode the chart shows the Potência and Torque signals as they are.
In Roda mode both are multiplied by `1 − loss ÷ 100`. The loss field SHALL only have an effect in
Roda mode.

#### Scenario: Wheel mode with default loss
- **WHEN** the user selects Roda with the loss at 15%
- **THEN** every plotted power and torque value is 85% of its Motor-mode value at the same point

#### Scenario: Editing the loss in Motor mode
- **WHEN** the switch is on Motor and the user changes the loss in the filters modal
- **THEN** the curves do not change

#### Scenario: Invalid loss
- **WHEN** the loss field is empty, negative or above 100
- **THEN** the field is flagged as invalid and the last valid loss stays in effect

### Requirement: Raw and smoothed curves
The tab SHALL provide a Bruto / Suavizado switch, defaulting to Suavizado. Bruto SHALL plot every qualifying row as a point
at its own RPM and value, joined in increasing RPM order. Suavizado SHALL plot one point per RPM
band (100 rpm wide, not user-adjustable), taking the median of the samples in the band and then
smoothing across neighboring bands (a short running median followed by a short moving average), so
that an isolated sample, or an isolated band, far from its neighbors does not appear as a peak. Bands
without samples SHALL NOT produce a point.

#### Scenario: Raw mode
- **WHEN** Bruto is selected
- **THEN** each qualifying row appears as a point and the line between them follows increasing RPM

#### Scenario: Smoothed mode removes an isolated spike
- **WHEN** a single sample is several times larger than the samples around it in RPM, including the
  case where its band holds only one or two samples
- **THEN** the smoothed curve does not show a peak at that band

#### Scenario: Smoothed mode with a sparse log
- **WHEN** an RPM band has no qualifying sample
- **THEN** no point is plotted for that band and the curve continues between the nearest bands with
  samples

### Requirement: Responsive on large logs
The tab SHALL stay responsive when the active logs contain tens of thousands of rows, both when the
tab opens and when a filter, switch or constant changes.

#### Scenario: Large log
- **WHEN** the active logs contain tens of thousands of rows
- **THEN** opening the tab and editing a filter update the chart without freezing the page

### Requirement: Tab preferences are remembered
The dyno filters (including the gear selection), the Roda / Motor choice, the loss percentage, and the Bruto / Suavizado choice
SHALL be restored after a reload.

#### Scenario: Reload after configuring the tab
- **WHEN** the user sets a minimum Pedal of 80, selects Roda with 12% loss and Suavizado, and reloads
- **THEN** the tab reopens with those exact settings
