## ADDED Requirements

### Requirement: Per-point ratio against the loaded map
Each qualifying datalog point SHALL contribute to the correction the ratio between the VE the engine
needed at that point (its VE Lambda) and the VE the loaded map gives at the point's own MAP and RPM,
that is, the editable map's value interpolated bilinearly between the four surrounding cells, exactly
as the ECU reads the table. The ratio SHALL NOT depend on the map that was in the ECU when the log was
recorded, nor on the value of the cell the point is later attributed to. A point whose interpolated
map value is not greater than zero SHALL be discarded and SHALL NOT count toward any cell's sample
count.

#### Scenario: Ratio on a sloped region of the map
- **WHEN** a point has VE Lambda 55.9 and the loaded map interpolated at its MAP and RPM gives 57.0
- **THEN** the point's ratio is approximately 0.981, whatever the values of the cell centres around it

#### Scenario: Slope of the map does not leak into the factor
- **WHEN** two points, one at MAP 50 and one at MAP 40, both need 2% less VE than the loaded map gives
  at their own positions, and both are attributed to the MAP 40 cell
- **THEN** both ratios are 0.98 and the cell's mean is 0.98 (a factor of −2.0%), even though their
  absolute VE Lambda values differ by 10%

#### Scenario: Map edited after the run exists
- **WHEN** the user edits the editable map's cells
- **THEN** every point's ratio is recomputed against the edited map

#### Scenario: Interpolated map value not usable
- **WHEN** the interpolated map value at a point is zero or negative
- **THEN** that point is discarded and is not counted in any cell's effective sample count

## MODIFIED Requirements

### Requirement: Per-cell sample count and central values
For each cell, the correction SHALL provide an effective sample count (the sum of the bilinear
weights of every point touching it) and a mean, a median, and a mode of the per-point ratios (see
"Per-point ratio against the loaded map") of the points touching it, so that switching between mean,
median, and mode on the Eficiência Volumétrica tab requires no regeneration. The mode is the
approximate most frequent value: the center of the densest cluster of values, found with a fixed
tolerance of ±0.5 percentage points of factor (±0.005 in ratio).

#### Scenario: Mean is weighted, median is not
- **WHEN** the cell values are computed
- **THEN** each cell's mean is the bilinear-weight-weighted average of its points' ratios, and its
  median and mode are computed over the unweighted set of the same ratios

#### Scenario: Mode is the densest cluster
- **WHEN** a cell's points' ratios are 0.981, 0.990, 0.992, 0.993, 0.994, 0.996, 1.015 and 1.040
- **THEN** the cell's mode is the average of the values inside the ±0.005 window holding the most
  points (0.990 through 0.996), approximately 0.993, not the mean or median of the whole set

#### Scenario: Tie between clusters
- **WHEN** two or more windows hold the same maximum number of points
- **THEN** the mode is taken from the window whose values lie closest to the cell's median

#### Scenario: Single point
- **WHEN** exactly one point touches a cell
- **THEN** that cell's mean, median, and mode all equal that point's ratio

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
  `(factor − 1) × 100` where `factor` is the cell's value for the selected statistic (mean, median,
  or mode of the per-point ratios), which is already a factor against the loaded map and is not
  divided by the cell's own map value

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
  immediately from the run's stored samples and the new map values, without needing to regenerate

#### Scenario: Switching Mean/Median recomputes both factor heatmaps
- **WHEN** the user switches the Mean/Median/Mode toggle to any of its options
- **THEN** both the Direct and Weighted heatmaps recompute from the newly selected statistic,
  without needing to regenerate

#### Scenario: Applying corrections uses the selected statistic
- **WHEN** the Mode statistic is selected and the user applies corrections to the map
- **THEN** the Weighted corrections used are the ones derived from the mode, exactly as displayed

### Requirement: Tooltip shows full cell context
Hovering any cell in any of the three correction heatmaps SHALL show a tooltip with every available
field for that cell (effective sample count, mean, median, mode, Direct correction, Weighted
correction), independent of which heatmap is hovered or which statistic (mean/median/mode) is
currently selected. Mean, median and mode, being ratios against the loaded map, and the Direct and
Weighted corrections SHALL all be shown as signed percentages.

#### Scenario: Hovering any of the three heatmaps
- **WHEN** the user hovers a cell in the Direct, Weighted, or Amostras heatmap
- **THEN** the tooltip lists all available fields for that cell, including the mode, not only the
  one that heatmap itself displays, with the mean, median, mode and the Direct and Weighted
  corrections as signed percentages
