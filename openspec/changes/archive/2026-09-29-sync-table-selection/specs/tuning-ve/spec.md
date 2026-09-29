## MODIFIED Requirements

### Requirement: Support chart alongside the tables
Each map section (original and editable) SHALL be paired with a chart that mirrors the table's data
and stays selection-synchronized in both directions with the selection shared by every table of the
VE tab (see `heatmap-editing`).

#### Scenario: Table selection reflected in chart
- **WHEN** the user selects one or more cells in any table of the VE tab (original, editable, or a
  correction table)
- **THEN** the corresponding points are highlighted in every map chart that is visible

#### Scenario: Chart selection reflected in table
- **WHEN** the user clicks a point, or draws a box selection, in a chart
- **THEN** the corresponding cells become the shared selection, shown in every table, and keyboard
  shortcuts of the editable table act on it immediately

#### Scenario: Orientation and dimensionality toggles
- **WHEN** the user switches the chart's orientation (MAP×RPM / RPM×MAP) or mode (2D / 3D)
- **THEN** the chart redraws accordingly, and the chosen orientation/mode is remembered across the
  session

#### Scenario: Resizable split
- **WHEN** the user drags the handle between a table and its chart
- **THEN** their relative widths adjust, remembered across the session, within a fixed minimum and
  maximum ratio
