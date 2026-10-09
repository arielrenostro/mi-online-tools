## REMOVED Requirements

### Requirement: Correction-filtered points honor the visibility toggle
**Reason**: Renamed and reworded: there is a single filter now, not correction filters plus a visual
filter.
**Migration**: See "Filtered points honor the visibility toggle" below.

## ADDED Requirements

### Requirement: Filtered points honor the visibility toggle
Every chart panel's series SHALL reflect the applied filter (see `datalog-filter`), rendering the
points that fail it according to the visibility toggle held in the filter modal.

#### Scenario: Visibility toggle set to "visible"
- **WHEN** the visibility toggle is set to keep excluded points visible
- **THEN** points failing the applied filter render dimmed in place within their series, preserving
  the series' time continuity

#### Scenario: Visibility toggle set to "hidden"
- **WHEN** the visibility toggle is set to hide excluded points
- **THEN** points failing the applied filter are dropped from the series data outright, without
  regard for the resulting time gap

#### Scenario: Filter is applied while a chart is open
- **WHEN** the user applies a change to the filter (see `datalog-filter`) while viewing a chart panel
- **THEN** the panel's series immediately re-renders to reflect the new qualifying set

## MODIFIED Requirements

### Requirement: Chart zoom follows the time selection when charts are created or rebuilt
Whenever a chart panel is drawn — a new panel gets its first signal, a signal is added or removed,
panels are split, added or removed, the filter or constants change, or the Gráficos tab is entered
— its visible range SHALL be the shared time selection, or the full range when there is none. The
user SHALL NOT have to reselect the interval on the timeline for the charts to apply it.

#### Scenario: Adding or removing a signal while a selection exists
- **WHEN** a selection exists and the user adds or removes a signal in a panel
- **THEN** every panel, including the one that changed, still shows exactly the selected range, and
  the selection is unchanged

#### Scenario: Splitting or adding a panel while a selection exists
- **WHEN** a selection exists and the user splits a panel or adds one below
- **THEN** all panels, including the ones recreated by the layout change, show the selected range

#### Scenario: First signal in an empty panel
- **WHEN** a selection exists and the user adds the first signal to an empty panel
- **THEN** the new chart opens already showing the selected range

#### Scenario: Filters change while a selection exists
- **WHEN** a selection exists and the user applies a different filter
- **THEN** the charts redraw still showing the selected range
