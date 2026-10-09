# mapa-ve-correction Specification

## Purpose
Lets the user configure which datalog points count for VE correction, generate a read-only
correction-factor snapshot from them entirely client-side, and apply it to the editable VE map.

## Requirements

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
Four independent skip filters SHALL each count points around a Lambda Loop transition, independently
per log. There are two kinds of transition — into closed loop (open to either closed state, plain
closed or closed with auto-correção) and into open loop (either closed state to open) — and, for
each, two windows: **after** the transition (the first N points counted from the transition point,
inclusive) and **before** it (the N points immediately preceding the transition point, which itself
is not part of the window). Each filter excludes the points of its own window for its own kind of
transition, with N configured separately per filter. Toggling between the two closed states without
passing through open SHALL NOT restart or create any window.

#### Scenario: Entering closed loop mid-log
- **WHEN** a log's Lambda Loop value transitions from open to either closed state
- **THEN** the following N points (as configured for the closed-loop "after" filter) are excluded,
  after which points qualify normally with respect to this filter

#### Scenario: Entering open loop mid-log
- **WHEN** a log's Lambda Loop value transitions from either closed state to open
- **THEN** the following N points (as configured for the open-loop "after" filter) are excluded,
  after which points qualify normally with respect to this filter

#### Scenario: Points before entering closed loop
- **WHEN** a log's Lambda Loop value transitions from open to either closed state and the closed-loop
  "before" filter is set to N
- **THEN** the N points immediately preceding the first closed point (all of them in open loop,
  unless a shorter stretch precedes) are excluded, and the first closed point itself is not excluded
  by this filter

#### Scenario: Points before entering open loop
- **WHEN** a log's Lambda Loop value transitions from either closed state to open and the open-loop
  "before" filter is set to N
- **THEN** the N points immediately preceding the first open point are excluded, and the first open
  point itself is not excluded by this filter

#### Scenario: Fewer than N points before the transition
- **WHEN** a "before" window would extend past the start of the log
- **THEN** only the points that exist are excluded, and no other point is affected

#### Scenario: Toggling auto-correção while staying closed
- **WHEN** Lambda Loop changes between the two closed states (with or without auto-correção) without
  returning to open in between
- **THEN** no "before" or "after" window is created, and neither "after" countdown already in
  progress (if any) is restarted

#### Scenario: Counters reset per log
- **WHEN** two logs are active and each has its own loop transitions
- **THEN** all four skip windows are computed independently for each log, not carried across the
  concatenated timeline — in particular a "before" window never reaches into the previous log and the
  first point of a log is never treated as a transition

### Requirement: Generating a correction snapshot
Generating a correction SHALL compute a correction snapshot from every currently-qualifying point and
store it as a new correction run (see `correction-runs`), which becomes the run displayed on the VE
tab. A point qualifies when it belongs to an active log, passes the applied filter (see
`datalog-filter`) and, when a time interval is selected, lies inside it. The action itself lives in
the Datalog header and is defined by `correction-runs`.

#### Scenario: No qualifying points
- **WHEN** no point currently qualifies (no active logs, or the filter/selection exclude everything)
- **THEN** the generate action is disabled with a message explaining that no data is available

#### Scenario: Generating
- **WHEN** the user activates the generate action with at least one qualifying point and a map loaded
- **THEN** the app computes the snapshot (see "Bilinear cell attribution" and "Per-cell sample count
  and central values" below), stores it as a new run, and that run becomes the correction section's
  displayed result on the Eficiência Volumétrica tab

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
of every point touching it) and a mean, a median, and a mode of the per-point VE Lambda values of
the points touching it, so that switching between mean, median, and mode on the Eficiência Volumétrica tab requires no
regeneration. The mode is the approximate most frequent value: the center of the densest cluster of
values, found with a fixed tolerance of ±0.5 VE percentage points.

#### Scenario: Mean is weighted, median is not
- **WHEN** the snapshot is generated
- **THEN** each cell's mean is the bilinear-weight-weighted average of its points' VE Lambda values,
  and its median and mode are computed over the unweighted set of the same values

#### Scenario: Mode is the densest cluster
- **WHEN** a cell's points' VE Lambda values are 58.1, 59.0, 59.2, 59.3, 59.4, 59.6, 61.5 and 64.0
- **THEN** the cell's mode is the average of the values inside the ±0.5 window holding the most
  points (59.0 through 59.6), approximately 59.3, not the mean or median of the whole set

#### Scenario: Tie between clusters
- **WHEN** two or more windows hold the same maximum number of points
- **THEN** the mode is taken from the window whose values lie closest to the cell's median

#### Scenario: Single point
- **WHEN** exactly one point touches a cell
- **THEN** that cell's mean, median, and mode all equal that point's VE Lambda value

#### Scenario: Cell with zero effective samples
- **WHEN** no qualifying point touches a cell
- **THEN** that cell has no mean, median, mode, or count, and is marked as having no data

### Requirement: Correction heatmap shows Direct, Weighted, and Amostras simultaneously
The Eficiência Volumétrica tab's correction section SHALL show three read-only heatmaps at once — Direct correction,
Weighted correction, and effective sample count — with no toggle needed to switch between them; a
separate Mean/Median/Mode toggle controls which statistic feeds both correction heatmaps'
calculation without regenerating the run. The two correction heatmaps SHALL display each cell as a
percentage variation relative to the current map value — the factor 1.05 shown as +5.0%, the factor
0.95 as -5.0%, no correction as 0.0% — and not as a raw factor.

#### Scenario: Direct factor heatmap
- **WHEN** a run is displayed
- **THEN** the "Direta" heatmap shows, for each cell with data, the percentage
  `(factor − 1) × 100` where `factor = cell value (mean, median, or mode, per the selected
  statistic) ÷ current editable-map value for that cell`

#### Scenario: Weighted factor heatmap
- **WHEN** a run is displayed
- **THEN** the "Ponderado" heatmap shows, for each cell with data, the percentage
  `(factor − 1) × 100` where `factor = 1 + (direct factor − 1) × w`, `w = n / (n + k)`, `n` is the
  cell's effective sample count and `k` is the confidence constant set on the Configurações screen
  (100 by default); this is the heatmap "Apply corrections to map" reads from

#### Scenario: Weighted heatmap follows the confidence constant
- **WHEN** the user changes k on the Configurações screen and returns to the Eficiência Volumétrica tab
- **THEN** the "Ponderado" heatmap and its "Apply corrections to map" action use the new k, with no
  regeneration of the run, and the "Direta" heatmap is unaffected

#### Scenario: Signed percentage format
- **WHEN** a cell's factor is 1.05, 0.95 or 1.00
- **THEN** the cell reads "+5.0%", "-5.0%" and "0.0%" respectively, with one decimal place, and a
  value that rounds to zero carries no sign

#### Scenario: Amostras heatmap
- **WHEN** a run is displayed
- **THEN** an "Amostras" heatmap shows each cell's effective sample count, with cells with more
  effective samples rendering hotter, independent of their correction value

#### Scenario: Both factor heatmaps render on the same diverging scale
- **WHEN** either correction heatmap is displayed
- **THEN** each cell's color depends only on the absolute size of its percentage, not its sign: near
  0% is cool, about 5% is already a warning (yellow), about 10% is strong (red), and 15% or more is
  the limit, shown in the darkest red; colors between those points blend smoothly and do not change
  beyond 15%

#### Scenario: Factors update live with map edits
- **WHEN** the user edits the editable map's cells after a run exists
- **THEN** every displayed percentage in both the Direct and Weighted heatmaps recomputes
  immediately from the run's stored values and the new map values, without needing to regenerate

#### Scenario: Switching Mean/Median recomputes both factor heatmaps
- **WHEN** the user switches the Mean/Median/Mode toggle to any of its options
- **THEN** both the Direct and Weighted heatmaps recompute from the newly selected statistic,
  without needing to regenerate

#### Scenario: Applying corrections uses the selected statistic
- **WHEN** the Mode statistic is selected and the user applies corrections to the map
- **THEN** the Weighted corrections used are the ones derived from the mode, exactly as displayed

### Requirement: Snapshot provenance
The correction section SHALL display which logs, which time range per log, and which filter settings
produced the selected run, as defined by `correction-runs` ("Run selector in the VE correction
section").

#### Scenario: Displaying provenance
- **WHEN** a run is displayed
- **THEN** the panel shows the filenames of every log used at generation time, the time range used
  per log (or an indication that the logs were used in full), and every enabled filter criterion with
  its limits

### Requirement: Applying corrections to the map
An "Apply corrections to map" action SHALL multiply every cell that has run data by the Weighted
factor equivalent to its currently displayed percentage (factor = 1 + percentage ÷ 100), as one undo
step, leaving cells without data unchanged.

#### Scenario: Applying
- **WHEN** the user activates "Apply corrections to map" and confirms
- **THEN** every cell with run data is set to its current value times the factor equivalent to its
  displayed Weighted percentage (a displayed +5.0% multiplies by 1.05), recorded as a single undo
  entry, and cells without run data are left unchanged

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
field for that cell (effective sample count, mean, median, mode, Direct correction, Weighted
correction — the last two as signed percentages), independent of which heatmap is hovered or which
statistic (mean/median/mode) is currently selected.

#### Scenario: Hovering any of the three heatmaps
- **WHEN** the user hovers a cell in the Direct, Weighted, or Amostras heatmap
- **THEN** the tooltip lists all available fields for that cell, including the mode, not only the
  one that heatmap itself displays, with the Direct and Weighted corrections as percentages

### Requirement: Direct and Weighted heatmaps fit side by side
The Direct and Weighted correction heatmaps SHALL be shown side by side, sized together so that the
pair, including the space between them, fits the width of the correction section: whatever the map
and chart split chosen above, the section SHALL NOT show a horizontal scrollbar for the pair at
ordinary window widths. Cell width shrinks, down to a minimum, before any scrolling is allowed.

#### Scenario: Default layout
- **WHEN** a run is displayed in a window of ordinary width
- **THEN** the Direct and Weighted heatmaps appear side by side, both fully visible, with no
  horizontal scrollbar

#### Scenario: Wide map table
- **WHEN** the user has widened the editable map's table at the expense of its chart
- **THEN** the two correction heatmaps still fit side by side without a horizontal scrollbar

#### Scenario: Resizing the window
- **WHEN** the user narrows or widens the window
- **THEN** the heatmaps' cells resize so the pair keeps fitting

### Requirement: Color source of the correction heatmaps
The correction section SHALL offer a "Cores" switch with two options, "Valor" and "Amostras", placed
beside the "Valores" switch, that decides how the cells of the Direct and Weighted heatmaps are
painted; the numbers shown in the cells are the corrections in both options. "Amostras" is the
default. "Valor" paints each cell by the size of the correction, as defined above, with full
colors. "Amostras" starts from exactly the
same colors as "Valor" and only reduces how much each cell stands out, by the confidence of its
sample count: `n ÷ (n + k)`, where `n` is the cell's effective sample count and `k` the confidence
constant from the Configurações screen. The less confidence, the more the cell's color fades toward
the neutral color of a cell without data (a muted gray-blue), never toward black: cells with few
samples for that k all end up in a similar muted tone, whatever their correction, and no cell becomes
darker or more conspicuous than its "Valor" color or than the neutral tone; cells with many samples
keep the full "Valor" color. The fade is strong — a cell with practically no samples shows only a faint hint of its "Valor" color —
but it never reaches the neutral color completely, so every number stays readable. The choice SHALL NOT affect the Amostras heatmap, the displayed numbers, the
generated runs or what "Apply corrections to map" writes.

#### Scenario: Default
- **WHEN** a run is displayed for the first time
- **THEN** "Cores" is on "Amostras", and cells are faded by their sample confidence

#### Scenario: Valor shows full colors
- **WHEN** the user selects "Valor"
- **THEN** the heatmaps are painted by the size of the correction, every cell with its full color

#### Scenario: Fading by samples
- **WHEN** the user selects "Amostras"
- **THEN** every cell of the Direct and Weighted heatmaps keeps the hue it had in "Valor", but a cell
  with far fewer samples than k is faded close to the neutral tone, one with n equal to k is
  half-way, and one with many times k is practically unchanged

#### Scenario: Dark colors do not turn into dark spots
- **WHEN** a cell with the darkest "Valor" color (the 15% limit) has few samples, in "Amostras"
- **THEN** it is not darker than it was in "Valor" nor than the neutral tone, and it does not stand
  out from the other low-confidence cells

#### Scenario: Same correction, different samples
- **WHEN** two cells have the same correction but different sample counts, in "Amostras"
- **THEN** the one with fewer samples is the closer to the neutral tone

#### Scenario: Following the confidence constant
- **WHEN** "Amostras" is selected and the user changes k on the Configurações screen
- **THEN** the fading updates, since the same sample count is more or less trusted with another k

#### Scenario: Switching between the two
- **WHEN** the user switches from "Amostras" to "Valor" and back
- **THEN** only the intensity of the colors changes, and no number changed
