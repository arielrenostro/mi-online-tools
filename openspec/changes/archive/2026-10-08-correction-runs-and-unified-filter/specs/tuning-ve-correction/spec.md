## MODIFIED Requirements

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
  displayed result on the VE tab

### Requirement: Snapshot provenance
The correction section SHALL display which logs, which time range per log, and which filter settings
produced the selected run, as defined by `correction-runs` ("Run selector in the VE correction
section").

#### Scenario: Displaying provenance
- **WHEN** a run is displayed
- **THEN** the panel shows the filenames of every log used at generation time, the time range used
  per log (or an indication that the logs were used in full), and every enabled filter criterion with
  its limits

### Requirement: Correction heatmap shows Direct, Weighted, and Amostras simultaneously
The VE tab's correction section SHALL show three read-only heatmaps at once — Direct correction,
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
- **WHEN** the user changes k on the Configurações screen and returns to the VE tab
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

### Requirement: Tooltip shows full cell context
Hovering any cell in any of the three correction heatmaps SHALL show a tooltip with every available
field for that cell (effective sample count, mean, median, mode, Direct correction, Weighted
correction — the last two as signed percentages), independent of which heatmap is hovered or which
statistic (mean/median/mode) is currently selected.

#### Scenario: Hovering any of the three heatmaps
- **WHEN** the user hovers a cell in the Direct, Weighted, or Amostras heatmap
- **THEN** the tooltip lists all available fields for that cell, including the mode, not only the
  one that heatmap itself displays, with the Direct and Weighted corrections as percentages

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Correction filter panel on the Logs tab
**Reason**: The filters are edited in the single Datalog filter modal, reachable from every Datalog
tab; the Logs tab keeps only the log inventory.
**Migration**: See `datalog-filter`.

### Requirement: Filter edits are a draft until applied
**Reason**: The draft/apply mechanism moved into the filter modal, where the draft is local and
discarded on close.
**Migration**: See `datalog-filter` ("Edits are local to the modal until applied" and "One mask for
highlighting and for correction runs", which carries the time-selection scenarios).

### Requirement: Warn before leaving the Logs tab with unapplied filter edits
**Reason**: With the draft kept inside a modal there is no pending state that survives leaving a tab.
**Migration**: None needed; see `datalog-filter` ("Leaving a tab with an open draft").

### Requirement: Visibility toggle for excluded points
**Reason**: The toggle moved into the filter modal.
**Migration**: See `datalog-filter` ('"Mostrar pontos filtrados" in the filter modal').

### Requirement: Snapshot staleness
**Reason**: A run is a fixed compiled result with an explicit recipe; changing filters, logs or the
time selection after generating simply means generating another run.
**Migration**: See `correction-runs` ("A run is a compiled result, independent of the logs and the
map's values").
