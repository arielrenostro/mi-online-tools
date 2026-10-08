## MODIFIED Requirements

### Requirement: What persists across a session
The app SHALL persist, across reloads: the imported map (original and current edits), imported logs
(content, active/inactive state, and order), the last generated VE correction snapshot with its
provenance (logs, time range, filter values), the correction filter panel's current settings and
visibility toggle, the timeline's cursor/selection/sparkline choice, the Constantes section's values
(displacement, air-fuel ratio, BSFC, VE calibration), the Dinamômetro tab's settings (filters,
Roda/Motor choice, loss percentage, Bruto/Suavizado choice), and UI layout
preferences (collapsed panels, active analysis view, chart layout including each panel's height and
the width split between side-by-side panels, signal sidebar state, table column visibility).

#### Scenario: Restoring UI preferences
- **WHEN** the user reloads after collapsing the original-map panel and customizing the chart
  layout
- **THEN** those UI preferences are restored exactly as left

#### Scenario: Restoring panel sizes
- **WHEN** the user reloads after changing panels' heights and widths with the size buttons
- **THEN** every panel comes back with the same height and the same share of the row width

#### Scenario: Restoring a layout saved by the drag-resize version
- **WHEN** the user reloads with a chart layout saved while panel sizes were set by dragging (an
  overall height and split ratios)
- **THEN** the layout is restored with every panel at a height equivalent to what it had before,
  side-by-side panels keep their width split, and nothing is lost or shows an error

#### Scenario: Restoring the last tuning result
- **WHEN** the user reloads after generating a VE correction snapshot
- **THEN** the last snapshot, its provenance, and its staleness state are available again without
  regenerating

#### Scenario: Restoring constants and dyno settings
- **WHEN** the user reloads after changing the constants and the Dinamômetro tab's settings
- **THEN** the Constantes section and the Dinamômetro tab show the same values as before the reload,
  and the derived signals are computed with them

#### Scenario: Saved values are invalid or missing
- **WHEN** the stored constants or dyno settings are absent or unreadable
- **THEN** the defaults are used instead and no error is shown
