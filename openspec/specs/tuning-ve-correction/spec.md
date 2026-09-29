# tuning-ve-correction Specification

## Purpose
Lets the user configure which datalog points count for VE correction, generate a read-only
correction-factor snapshot from them entirely client-side, and apply it to the editable VE map.

## Requirements

### Requirement: Correction filter panel on the Logs tab
The Logs tab SHALL show a filter panel below the log list, visually separated from it, with
controls for: Lambda Loop (multi-select: open, closed, closed + auto-correção), minimum CLT,
minimum and maximum Lambda, maximum TPS delta, maximum MAP delta, maximum |Lambda − Lambda Target|
delta, the number of initial points to skip after entering closed loop, and the number of initial
points to skip after entering open loop, plus an "Aplicar filtros" action.

#### Scenario: Panel is visually distinct from the log list
- **WHEN** the user opens the Logs tab
- **THEN** the filter panel appears below the log list, separated from it by a visible divider or
  section boundary

### Requirement: Filter edits are a draft until applied
Editing a filter SHALL only change a pending draft; it SHALL NOT affect the Dashboard, Charts, Data
tabs, or "Gerar fator de correção" until the user activates "Aplicar filtros".

#### Scenario: Editing without applying
- **WHEN** the user changes a filter's value
- **THEN** the Dashboard, Charts, and Data tabs, and the qualifying-point count used by "Gerar fator
  de correção", keep reflecting the last-applied filters, unchanged

#### Scenario: Applying
- **WHEN** the user activates "Aplicar filtros"
- **THEN** the pending draft becomes the active filter set, and the Dashboard, Charts, and Data tabs
  immediately reflect the new set of qualifying points

#### Scenario: Combined with a time selection
- **WHEN** a time interval is selected on the timeline and applied correction filters are also
  active
- **THEN** only points that are both inside the selected interval and passing every applied filter
  qualify

#### Scenario: No time selection
- **WHEN** no time interval is selected
- **THEN** qualification depends only on the applied correction filters, evaluated over every active
  log's points

### Requirement: Warn before leaving the Logs tab with unapplied filter edits
Navigating away from the Logs tab (to any other tab or screen) while a filter draft differs from
the last-applied filters SHALL prompt for confirmation before proceeding.

#### Scenario: Navigating away with unapplied edits
- **WHEN** the user has edited a filter without applying it and attempts to switch to the Dashboard,
  Charts, or Data tab (or leave the Datalog screen entirely)
- **THEN** a confirmation dialog explains that the filters have not been applied, before the
  navigation is allowed to proceed

#### Scenario: Confirming leaves the draft as-is
- **WHEN** the user confirms leaving despite the warning
- **THEN** the navigation proceeds and the unapplied draft is neither applied nor discarded — it is
  still there if the user returns to the Logs tab

#### Scenario: Cancelling stays on the Logs tab
- **WHEN** the user cancels out of the warning
- **THEN** the navigation is aborted and the user remains on the Logs tab with the draft intact

#### Scenario: No warning with nothing unapplied
- **WHEN** the filter draft matches the last-applied filters
- **THEN** navigating away proceeds without any confirmation

### Requirement: TPS and MAP delta filter definitions
The maximum TPS delta and maximum MAP delta filters SHALL each evaluate, for each point, the
amplitude (max − min) of their respective signal (Pedal for TPS, MAP for MAP) within the trailing
200 ms window ending at that point's timestamp, and exclude the point when that amplitude exceeds
the filter's own configured maximum. The two filters are independent — a point failing either one
is excluded.

#### Scenario: Rapid pedal movement
- **WHEN** the Pedal signal's value swings by more than the configured TPS maximum within the
  200 ms before a point
- **THEN** that point is excluded, regardless of whether the swing was increasing, decreasing, or
  oscillating

#### Scenario: Rapid MAP transient
- **WHEN** the MAP signal's value swings by more than the configured MAP maximum within the 200 ms
  before a point (e.g., a boost spike or a lift-off)
- **THEN** that point is excluded, regardless of whether the swing was increasing, decreasing, or
  oscillating

#### Scenario: Insufficient history
- **WHEN** a point has less than 200 ms of preceding data available (e.g., near the start of a log)
- **THEN** neither delta filter excludes that point for lack of a full window

### Requirement: Skip-first-N-after-loop-transition filter definitions
Two independent skip-first-N filters SHALL each count points from a Lambda Loop transition,
independently per log: one from each transition into closed loop (open to either closed state —
plain closed or closed with auto-correção), one from each transition into open loop (either closed
state to open). Each excludes the first N points counted from its own kind of transition (N
configured separately per filter); toggling between the two closed states without passing through
open SHALL NOT restart either count.

#### Scenario: Entering closed loop mid-log
- **WHEN** a log's Lambda Loop value transitions from open to either closed state
- **THEN** the following N points (as configured for the closed-loop filter) are excluded, after
  which points qualify normally with respect to this filter

#### Scenario: Entering open loop mid-log
- **WHEN** a log's Lambda Loop value transitions from either closed state to open
- **THEN** the following N points (as configured for the open-loop filter) are excluded, after which
  points qualify normally with respect to this filter

#### Scenario: Toggling auto-correção while staying closed
- **WHEN** Lambda Loop changes between the two closed states (with or without auto-correção) without
  returning to open in between
- **THEN** neither skip countdown already in progress (if any) is restarted

#### Scenario: Counters reset per log
- **WHEN** two logs are active and each has its own loop transitions
- **THEN** both skip-counts (closed-loop and open-loop) are tracked independently for each log, not
  carried across the concatenated timeline

### Requirement: Visibility toggle for excluded points
The filter panel SHALL include a toggle controlling whether points that fail the correction filters
remain visible (dimmed) or are removed outright in the Data tab and Charts.

#### Scenario: Visible (dimmed)
- **WHEN** the toggle is set to keep filtered points visible
- **THEN** the Data tab renders excluded rows with a dimmed style instead of omitting them, and
  Charts render excluded points dimmed in place, preserving the series' time continuity

#### Scenario: Hidden
- **WHEN** the toggle is set to hide filtered points
- **THEN** the Data tab omits excluded rows entirely, and Charts drop excluded points from the
  series data without regard for the resulting time gap

### Requirement: Generating a correction snapshot
A "Gerar fator de correção" action, available whenever at least one point currently qualifies,
SHALL compute a correction snapshot from every currently-qualifying point and store it as the
displayed result on the VE tab.

#### Scenario: No qualifying points
- **WHEN** no point currently qualifies (no active logs, or filters/selection exclude everything)
- **THEN** the "Gerar fator de correção" action is disabled with a message explaining that no data
  is available

#### Scenario: Generating
- **WHEN** the user activates "Gerar fator de correção" with at least one qualifying point
- **THEN** the app computes the snapshot (see "Bilinear cell attribution" and "Per-cell sample
  count and central values" below) and it becomes the correction section's displayed result on the
  VE tab

### Requirement: Bilinear cell attribution
Each qualifying datalog point SHALL be attributed to the map's MAP×RPM cells by bilinear
interpolation between the breakpoints surrounding its MAP and RPM values, contributing a weight to
each such cell that sums to 1 across all cells it touches; a point outside the map's MAP or RPM
range SHALL be discarded from the snapshot entirely.

#### Scenario: Point strictly between breakpoints on both axes
- **WHEN** a point's MAP and RPM both fall strictly between two breakpoints
- **THEN** it contributes a weighted share to all 4 surrounding cells, with weights computed from
  its relative position between each axis's breakpoints and summing to 1

#### Scenario: Point exactly on one axis's breakpoint
- **WHEN** a point's MAP or RPM (but not both) exactly matches a breakpoint
- **THEN** it contributes to only the 2 cells along the other axis's surrounding breakpoints

#### Scenario: Point exactly on both breakpoints
- **WHEN** a point's MAP and RPM both exactly match breakpoints
- **THEN** it contributes its full weight to that single cell

#### Scenario: Point outside the map's range
- **WHEN** a point's MAP or RPM falls outside the map's lowest-to-highest breakpoint range
- **THEN** it is discarded and contributes to no cell

### Requirement: Per-cell sample count and central values
For each cell, the snapshot SHALL record an effective sample count (the sum of the bilinear weights
of every point touching it) and both a mean and a median of the per-point VE Lambda values of the
points touching it, so that switching between mean and median on the VE tab requires no
regeneration.

#### Scenario: Mean is weighted, median is not
- **WHEN** the snapshot is generated
- **THEN** each cell's mean is the bilinear-weight-weighted average of its points' VE Lambda values,
  and its median is the unweighted median of the same set of values

#### Scenario: Cell with zero effective samples
- **WHEN** no qualifying point touches a cell
- **THEN** that cell has no mean, median, or count, and is marked as having no data

### Requirement: Correction heatmap shows Direct, Weighted, and Amostras simultaneously
The VE tab's correction section SHALL show three read-only heatmaps at once — Direct factor,
Weighted factor, and effective sample count — with no toggle needed to switch between them; a
separate Mean/Median toggle controls which statistic feeds both factor heatmaps' calculation
without regenerating the snapshot. Both factor heatmaps are centered on 1.00 as the neutral
(no-correction) value.

#### Scenario: Direct factor heatmap
- **WHEN** a snapshot is displayed
- **THEN** the "Direta" heatmap shows, for each cell with data,
  `factor = cell value (mean or median, per the selected statistic) ÷ current editable-map value
  for that cell`

#### Scenario: Weighted factor heatmap
- **WHEN** a snapshot is displayed
- **THEN** the "Ponderado" heatmap shows, for each cell with data,
  `factor = 1 + (direct factor − 1) × w`, where `w = n / (n + 100)` and `n` is the cell's effective
  sample count; this is the heatmap "Apply corrections to map" reads from

#### Scenario: Amostras heatmap
- **WHEN** a snapshot is displayed
- **THEN** an "Amostras" heatmap shows each cell's effective sample count, with cells with more
  effective samples rendering hotter, independent of their factor value

#### Scenario: Both factor heatmaps render on the same diverging scale
- **WHEN** either factor heatmap is displayed
- **THEN** it renders on a scale centered at 1.00, with both low and high factors rendering hot and
  1.00 rendering neutral

#### Scenario: Factors update live with map edits
- **WHEN** the user edits the editable map's cells after a snapshot exists
- **THEN** every displayed factor in both the Direct and Weighted heatmaps recomputes immediately
  from the existing snapshot's stored values and the new map values, without needing to regenerate

#### Scenario: Switching Mean/Median recomputes both factor heatmaps
- **WHEN** the user switches the Mean/Median toggle
- **THEN** both the Direct and Weighted heatmaps recompute from the newly selected statistic,
  without needing to regenerate

### Requirement: Snapshot provenance
The correction section SHALL display which logs, which time range, and which filter values produced
the currently displayed snapshot.

#### Scenario: Displaying provenance
- **WHEN** a snapshot is displayed
- **THEN** the panel shows the filenames of every log active at generation time, the time range used
  (or an indication that the full logs were used), and every filter's value at generation time

### Requirement: Snapshot staleness
The displayed snapshot SHALL be flagged as outdated, without being discarded or hidden, when the
correction filters, the active log set, or the time selection change after it was generated; editing
the map SHALL NOT trigger this flag.

#### Scenario: Changing a filter after generating
- **WHEN** the user changes any correction filter, the active log set, or the time selection after a
  snapshot exists
- **THEN** the snapshot remains displayed but is visibly flagged as outdated, until "Gerar fator de
  correção" runs again

#### Scenario: Editing the map does not cause staleness
- **WHEN** the user edits the editable map's cells
- **THEN** the snapshot is not flagged as outdated, since its factors recompute live from the
  existing snapshot

### Requirement: Applying corrections to the map
An "Apply corrections to map" action SHALL multiply every cell that has snapshot data by its
currently displayed Weighted factor, as one undo step, leaving cells without data unchanged.

#### Scenario: Applying
- **WHEN** the user activates "Apply corrections to map" and confirms
- **THEN** every cell with snapshot data is set to its current value times its currently displayed
  Weighted factor, recorded as a single undo entry, and cells without snapshot data are left
  unchanged

#### Scenario: Cancelling the confirmation
- **WHEN** the user declines the confirmation
- **THEN** no cell changes

### Requirement: Correction heatmaps are read-only
None of the three correction heatmaps (Direct, Weighted, Amostras) SHALL be directly editable, and
none SHALL apply a correction factor through a keyboard shortcut. They SHALL nevertheless take part
in the selection shared with the maps (see `heatmap-editing`): clicking a cell selects it in every
table, and the editing shortcuts of the editable map work while a correction heatmap has focus,
always acting on the editable map.

#### Scenario: Attempting to edit a cell
- **WHEN** the user double-clicks a cell in any of the three correction heatmaps, presses Enter, or types
  a digit while one has focus
- **THEN** no inline editing opens in the correction heatmap and no value of any table changes

#### Scenario: Clicking a correction cell shows it on the map
- **WHEN** the user clicks a cell in the Direct, Weighted, or Amostras heatmap
- **THEN** the same cell is shown as selected in the editable map (and in the original map and the
  other correction heatmaps)

#### Scenario: F2 from a correction heatmap
- **WHEN** the user presses F2 with focus on a correction heatmap
- **THEN** the standard bulk-edit dialog of the editable map opens for the shared selection, without
  using any correction factor, and behaves exactly as when opened from the editable map

#### Scenario: Apply-corrections control is unaffected
- **WHEN** the user activates "Aplicar correções no mapa" on a correction heatmap
- **THEN** it behaves as before, independent of the shared selection

### Requirement: Tooltip shows full cell context
Hovering any cell in any of the three correction heatmaps SHALL show a tooltip with every available
field for that cell (effective sample count, mean, median, Direct factor, Weighted factor),
independent of which heatmap is hovered or which statistic (mean/median) is currently selected.

#### Scenario: Hovering any of the three heatmaps
- **WHEN** the user hovers a cell in the Direct, Weighted, or Amostras heatmap
- **THEN** the tooltip lists all available fields for that cell, not only the one that heatmap
  itself displays
