# datalog-charts Specification

## Purpose
Lets the user build a custom, multi-panel layout of synchronized time-series charts over the
active logs, to visually inspect signal behavior and pick the interval that scopes the VE
correction heatmap (see `mapa-ve-correction`).

## Requirements

### Requirement: Panels show configurable sets of signals
Each chart panel SHALL let the user add or remove signal series independently, with multiple
signals in one panel sharing the X axis and optionally using independent Y axes.

#### Scenario: Adding a signal to a panel
- **WHEN** the user picks a signal from a panel's "add signal" control
- **THEN** that signal's series is added to the panel and rendered alongside any existing series

#### Scenario: Removing a signal from a panel
- **WHEN** the user removes a signal's chip from a panel
- **THEN** that series is removed from the panel; other panels are unaffected

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

### Requirement: Panels share cursor, tooltip, and time axis
All chart panels SHALL stay synchronized on the same time axis, cursor position, and tooltip
instant.

#### Scenario: Hovering one panel updates all panels
- **WHEN** the user moves the mouse over any panel
- **THEN** every panel shows a synchronized tooltip and cursor line at that same time instant,
  showing the last known point before the cursor when there is no exact match

#### Scenario: Clicking a panel moves the shared cursor
- **WHEN** the user clicks inside any panel
- **THEN** the timeline's cursor moves to the clicked time position, reflected in the Dashboard and
  Data tabs as well

### Requirement: Chart zoom and the timeline selection are the same value
Zooming or panning any panel SHALL update the shared time-range selection, and changing that
selection (including from the timeline) SHALL update every panel's zoom.

#### Scenario: Scrolling/panning a panel
- **WHEN** the user scrolls or pans within a chart panel
- **THEN** the shared selection updates to the panel's new visible range, or is cleared if the view
  returns to the full range

#### Scenario: Ctrl+drag to select
- **WHEN** the user holds Ctrl and drags across a panel
- **THEN** a selection rectangle is drawn during the drag, and releasing sets the shared selection
  to that range

#### Scenario: Clearing the selection resets zoom
- **WHEN** the selection is cleared (from the timeline or via Escape)
- **THEN** every panel's zoom returns to showing the full time range

### Requirement: Collapsible signal sidebar
A sidebar listing every available signal's current value at the cursor instant SHALL be available
alongside the chart area, and collapsible to reclaim horizontal space.

#### Scenario: Opening and closing the sidebar
- **WHEN** the user toggles the sidebar
- **THEN** it expands to show the name/value table, or collapses to a narrow strip, without
  affecting the chart panels' data

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

### Requirement: Panels stay responsive on large logs without losing resolution
Chart panels SHALL remain responsive when the active logs together contain tens of thousands of
points, across signal changes, zooming, panning, and returning to the Gráficos tab from another
Datalog tab or from another section (Mapa, Configurações, Home), without reducing the data resolution shown at the current zoom level (no aggregation
or downsampling that merges multiple raw points into one). The time axis SHALL keep spanning the
whole active log regardless of how much of it is currently drawn.

#### Scenario: Adding or removing a signal on a large log
- **WHEN** the user adds or removes a signal from a panel while the active logs total tens of
  thousands of points
- **THEN** the panel updates without freezing the UI, and every point within the panel's current
  zoom range renders individually

#### Scenario: Zooming or panning a large log
- **WHEN** the user zooms or pans within a chart panel on a large log
- **THEN** the redraw stays smooth and every point within the newly visible range is still
  rendered individually, at the same resolution as before the interaction

#### Scenario: Panning far from the original view
- **WHEN** the user pans or zooms to a stretch of the log far from the one that was drawn before
- **THEN** that stretch shows its points at full resolution once the interaction settles, and the
  shared selection holds the visible range

#### Scenario: Time axis spans the whole log
- **WHEN** a selection is active on a large log
- **THEN** the panels show the selected range zoomed in, and zooming out or clearing the selection
  shows the whole log on the same time axis

#### Scenario: Returning to the Gráficos tab
- **WHEN** the user switches from the Gráficos tab to another Datalog tab, or leaves Datalog for
  another section such as Mapa, and then comes back to it
- **THEN** the charts reappear without repeating the one-time cost of processing the entire active
  log set from scratch, and they reflect any filter, constants or selection change made meanwhile

#### Scenario: A hidden Gráficos tab does no work
- **WHEN** the user is on another Datalog tab or another section and changes the filter, the constants or the timeline
  selection
- **THEN** the charts are not redrawn while they are out of sight (no loading modal is shown for
  them), and the changes are applied once when the user returns to Gráficos

#### Scenario: Filtered-point dimming survives zooming
- **WHEN** a filter is applied (see `datalog-filter`) and the user zooms or pans a panel showing
  dimmed (filtered-out) stretches
- **THEN** every point keeps showing its own pass/fail state with no blending across a run
  boundary, at any zoom level

#### Scenario: The interface keeps responding while several panels redraw
- **WHEN** several panels redraw at once on a large log (for example after a filter is applied)
- **THEN** they redraw one after another, the interface handles the user's input and paints
  between them, and a click made meanwhile takes effect at once instead of being held until every
  panel has finished

#### Scenario: Input is blocked while a heavy redraw runs
- **WHEN** a heavy redraw (as above) is in progress on a large log
- **THEN** a modal "Carregando…" covers the whole screen with no way to dismiss it, mouse and
  keyboard input is blocked, and it disappears by itself when every redraw is finished, so nothing
  the user does meanwhile is queued and executed afterwards

#### Scenario: Small logs are not interrupted
- **WHEN** the active logs are small enough for the redraw to be instantaneous
- **THEN** no blocking modal is shown

#### Scenario: Heavy redraws show a loading indicator
- **WHEN** a change makes a panel redraw so much data that it takes noticeable time (a new
  selection, a signal or filter change, a layout change, or opening the Gráficos tab on a large log)
- **THEN** the panel shows a "Carregando…" indicator over its previous content (or empty, when it
  has none yet) before the redraw starts, and removes it when the redraw is done, instead of the
  screen freezing without feedback

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
