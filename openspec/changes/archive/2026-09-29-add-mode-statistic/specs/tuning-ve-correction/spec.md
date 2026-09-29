## MODIFIED Requirements

### Requirement: Per-cell sample count and central values
For each cell, the snapshot SHALL record an effective sample count (the sum of the bilinear weights
of every point touching it) and a mean, a median, and a mode of the per-point VE Lambda values of
the points touching it, so that switching between mean, median, and mode on the VE tab requires no
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
The VE tab's correction section SHALL show three read-only heatmaps at once — Direct factor,
Weighted factor, and effective sample count — with no toggle needed to switch between them; a
separate Mean/Median/Mode toggle controls which statistic feeds both factor heatmaps' calculation
without regenerating the snapshot. Both factor heatmaps are centered on 1.00 as the neutral
(no-correction) value.

#### Scenario: Direct factor heatmap
- **WHEN** a snapshot is displayed
- **THEN** the "Direta" heatmap shows, for each cell with data,
  `factor = cell value (mean, median, or mode, per the selected statistic) ÷ current editable-map
  value for that cell`

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
- **WHEN** the user switches the Mean/Median/Mode toggle to any of its options
- **THEN** both the Direct and Weighted heatmaps recompute from the newly selected statistic,
  without needing to regenerate

#### Scenario: Applying corrections uses the selected statistic
- **WHEN** the Mode statistic is selected and the user applies corrections to the map
- **THEN** the Weighted factors used are the ones derived from the mode, exactly as displayed

### Requirement: Tooltip shows full cell context
Hovering any cell in any of the three correction heatmaps SHALL show a tooltip with every available
field for that cell (effective sample count, mean, median, mode, Direct factor, Weighted factor),
independent of which heatmap is hovered or which statistic (mean/median/mode) is currently
selected.

#### Scenario: Hovering any of the three heatmaps
- **WHEN** the user hovers a cell in the Direct, Weighted, or Amostras heatmap
- **THEN** the tooltip lists all available fields for that cell, including the mode, not only the
  one that heatmap itself displays
