## ADDED Requirements

### Requirement: Panels stay responsive on large logs without losing resolution
Chart panels SHALL remain responsive when the active logs together contain tens of thousands of
points, across signal changes, zooming, panning, and re-entering the Gráficos tab, without
reducing the data resolution shown at the current zoom level (no aggregation or downsampling that
merges multiple raw points into one).

#### Scenario: Adding or removing a signal on a large log
- **WHEN** the user adds or removes a signal from a panel while the active logs total tens of
  thousands of points
- **THEN** the panel updates without freezing the UI, and every point within the panel's current
  zoom range renders individually

#### Scenario: Zooming or panning a large log
- **WHEN** the user zooms or pans within a chart panel on a large log
- **THEN** the redraw stays smooth and every point within the newly visible range is still
  rendered individually, at the same resolution as before the interaction

#### Scenario: Returning to the Gráficos tab
- **WHEN** the user navigates away from the Gráficos tab and back to it
- **THEN** the charts reappear without repeating the one-time cost of processing the entire active
  log set from scratch

#### Scenario: Filtered-point dimming survives zooming
- **WHEN** a VE correction filter is active and the user zooms or pans a panel showing dimmed
  (filtered-out) stretches
- **THEN** every point keeps showing its own pass/fail state with no blending across a run
  boundary, at any zoom level
