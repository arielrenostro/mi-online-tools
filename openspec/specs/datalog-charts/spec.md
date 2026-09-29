# datalog-charts Specification

## Purpose
Lets the user build a custom, multi-panel layout of synchronized time-series charts over the
active logs, to visually inspect signal behavior and pick the interval that scopes the VE
correction heatmap (see `tuning-ve-correction`).

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
panel except when it is the only one remaining.

#### Scenario: Splitting a panel side-by-side
- **WHEN** the user splits a panel horizontally
- **THEN** two panels appear side by side where the one panel was, each independently configurable

#### Scenario: Adding a panel below
- **WHEN** the user adds a panel below an existing one
- **THEN** a new empty panel appears below with the same height as the source panel, and the total
  chart area grows to fit it without shrinking the existing panels

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

### Requirement: Chart area height is user-adjustable
The overall chart area's height SHALL be resizable by the user within a fixed minimum and maximum.

#### Scenario: Dragging the resize handle
- **WHEN** the user drags the resize handle at the bottom of the chart area
- **THEN** the chart area's height changes accordingly, clamped between its minimum and maximum

### Requirement: Correction-filtered points honor the visibility toggle
Every chart panel's series SHALL reflect the correction filters defined by `tuning-ve-correction`,
rendering excluded points according to the panel's visibility toggle.

#### Scenario: Visibility toggle set to "visible"
- **WHEN** the correction filters' visibility toggle is set to keep filtered points visible
- **THEN** points failing the filters render dimmed in place within their series, preserving the
  series' time continuity

#### Scenario: Visibility toggle set to "hidden"
- **WHEN** the correction filters' visibility toggle is set to hide filtered points
- **THEN** points failing the filters are dropped from the series data outright, without regard for
  the resulting time gap

#### Scenario: Filters are applied while a chart is open
- **WHEN** the user applies a change to the correction filters (see `tuning-ve-correction`) while
  viewing a chart panel
- **THEN** the panel's series immediately re-renders to reflect the new qualifying set
