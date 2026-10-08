## MODIFIED Requirements

### Requirement: Panels can be split and recombined
The user SHALL be able to split any panel side-by-side or stacked, recursively, and remove any
panel except when it is the only one remaining. A panel added below another SHALL start with the
same height as the panel it came from and SHALL NOT change the size of any other panel.

#### Scenario: Splitting a panel side-by-side
- **WHEN** the user splits a panel horizontally
- **THEN** two panels of equal width appear side by side where the one panel was, each
  independently configurable

#### Scenario: Adding a panel below
- **WHEN** the user adds a panel below an existing one
- **THEN** a new empty panel appears below with the same height as the source panel, the source
  panel keeps its height, every other panel keeps its size, and the chart area grows by the new
  panel's height

#### Scenario: Removing the last remaining panel is blocked
- **WHEN** only one panel remains
- **THEN** the remove control for that panel is unavailable

## ADDED Requirements

### Requirement: Panel size is adjusted with buttons
Each panel SHALL expose, next to its split controls, buttons to increase and decrease its height
and — when it sits beside another panel — its width. Sizes SHALL NOT be adjustable by dragging.
Changing a panel's height SHALL change the height of its whole row, so panels side by side stay the
same height. Changing a panel's width SHALL take the difference from (or give it to) the panel
beside it, so the total width never changes and the chart area never scrolls horizontally. The chart
area SHALL scroll vertically when its content is taller than the available space, and SHALL NOT
stretch panels when it is shorter.

#### Scenario: Increasing a panel's height
- **WHEN** the user presses the "increase height" button of a panel
- **THEN** that panel's row becomes taller by a fixed step (up to a maximum), panels beside it grow
  with it, and panels in other rows keep their size

#### Scenario: Decreasing a panel's height
- **WHEN** the user presses the "decrease height" button of a panel
- **THEN** that panel's row becomes shorter by a fixed step, never below a minimum, and the control
  is unavailable once the minimum is reached

#### Scenario: Widening a panel takes space from its neighbour
- **WHEN** the user presses the "increase width" button of a panel that sits beside another
- **THEN** that panel becomes wider by a fixed step and the neighbour becomes narrower by the same
  amount, so the pair occupies the same total width as before

#### Scenario: Width limits
- **WHEN** a width change would leave either panel narrower than its minimum
- **THEN** the change is not applied and the corresponding control is unavailable

#### Scenario: Panel without a horizontal neighbour
- **WHEN** a panel has no panel beside it
- **THEN** its width buttons are not shown, and only its height buttons are available

#### Scenario: Content taller than the viewport
- **WHEN** the panels' heights add up to more than the space available to the chart area
- **THEN** the chart area scrolls vertically and no horizontal scrollbar appears

#### Scenario: Content shorter than the viewport
- **WHEN** the panels' heights add up to less than the space available to the chart area
- **THEN** panels keep their own heights and the remaining space is left empty

#### Scenario: No drag resizing
- **WHEN** the user presses and drags on the border between panels or at the bottom of the chart
  area
- **THEN** no panel changes size

### Requirement: Chart zoom follows the time selection when charts are created or rebuilt
Whenever a chart panel is drawn — a new panel gets its first signal, a signal is added or removed,
panels are split, added or removed, the filters or constants change, or the Gráficos tab is entered
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
- **WHEN** a selection exists and the user applies different correction filters or visual filter
- **THEN** the charts redraw still showing the selected range

### Requirement: Default chart panels
When no chart layout was saved, the Gráficos tab SHALL open with one panel per group below, stacked
top to bottom, each with the same height: RPM; MAP and Pedal; Lambda Target, Lambda 1 and Lambda
Corr; VE and VE Lambda; Inj. Pulse, Inj. DT and Inj. Efetivo; Batt Volt. A saved layout SHALL
always take precedence over this default.

#### Scenario: First visit to the Gráficos tab
- **WHEN** the user opens the Gráficos tab with no saved chart layout
- **THEN** six stacked panels are shown with the signal groups above, in that order

#### Scenario: Saved layout exists
- **WHEN** the user opens the Gráficos tab with a previously saved chart layout
- **THEN** that layout is shown, not the default one

### Requirement: Fixed value ranges for lambda signals
A chart panel's value axis for Lambda 1 and Lambda Target SHALL span 0.7 to 1.3, and for Lambda
Corr SHALL span -30 to 30 (%), regardless of the data's own range.

#### Scenario: Lambda signals in a panel
- **WHEN** a panel shows Lambda 1, Lambda Target or Lambda Corr
- **THEN** its value axis uses the range above

## REMOVED Requirements

### Requirement: Chart area height is user-adjustable
**Reason**: Height is now set per panel with buttons (see "Panel size is adjusted with buttons");
the overall height is the sum of the rows and there is no separate drag handle.
**Migration**: Use the height buttons on each panel. Saved layouts are converted automatically (see
`session-persistence`).
