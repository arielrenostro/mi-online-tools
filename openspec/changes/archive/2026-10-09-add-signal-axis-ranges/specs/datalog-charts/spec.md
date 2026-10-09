## ADDED Requirements

### Requirement: Y axes use the configured signal range
Each series' Y axis in the Gráficos panels SHALL span the range configured for that signal on the
Configurações screen (see `app-settings`) — its default range when the user has not changed it —
regardless of the data shown. Changing a range SHALL redraw every panel that shows that signal
without losing the panels' signals, layout, time selection or cursor, and SHALL NOT change the series
data, the tooltip values or the filter dimming.

#### Scenario: Default range
- **WHEN** the user has not changed any range and adds Lambda 1 to a panel
- **THEN** its Y axis spans 0.7 to 1.3

#### Scenario: Range edited in Configurações
- **WHEN** the user sets the range of Lambda 1 to 0.9–1.1 on the Configurações screen and returns to
  Gráficos
- **THEN** every panel that shows Lambda 1 has its Y axis spanning 0.9 to 1.1, and values outside it
  are drawn cut by the axis edge instead of rescaling the axis

#### Scenario: Several signals in one panel
- **WHEN** a panel shows MAP and Lambda 1 and the user changes only the range of MAP
- **THEN** only the MAP axis changes; the Lambda 1 axis keeps its range

#### Scenario: Time selection and layout preserved
- **WHEN** the user changes a signal's range while a time selection exists
- **THEN** every panel still shows exactly the selected range on the time axis and keeps its size and
  signals

#### Scenario: Invalid range being edited
- **WHEN** the range of a signal is flagged as invalid on the Configurações screen
- **THEN** the charts keep using the signal's last valid range
