## MODIFIED Requirements

### Requirement: What persists across a session
The app SHALL persist, across reloads: the imported map (original and current edits), imported logs
(content, active/inactive state, and order), the history of correction runs (see `correction-runs`:
samples, breakpoints, name, creation instant and recipe) and which run is selected, the applied
Datalog filter and its "Mostrar pontos filtrados" setting (see `datalog-filter`), the timeline's
cursor/selection/sparkline choice, the Configurações screen's values (displacement, air-fuel ratio,
BSFC, VE calibration, and the Ponderado confidence constant k), the Dinamômetro tab's settings (filters, Roda/Motor choice, loss percentage,
Bruto/Suavizado choice), the XY tab's choices (the X signal, the ordered list of Y signals and the
"Linha média", "Linha máxima" and "Linha mínima" checkboxes, see `datalog-xy`), and UI layout preferences (collapsed panels, active analysis view, chart
layout including each panel's height and the width split between side-by-side panels, signal sidebar
state, table column visibility).

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
- **WHEN** the user reloads after generating correction runs and selecting one of them
- **THEN** the whole history, each run's name, samples and recipe, and the selected run are
  available again without regenerating, and the selected run shows the same factors against the
  loaded map

#### Scenario: Restoring the applied filter
- **WHEN** the user reloads after applying a filter and changing "Mostrar pontos filtrados"
- **THEN** the same filter is applied and the same setting is in effect

#### Scenario: Restoring constants and dyno settings
- **WHEN** the user reloads after changing the constants and the Dinamômetro tab's settings
- **THEN** the Configurações screen and the Dinamômetro tab show the same values as before the
  reload, and the derived signals are computed with them

#### Scenario: Restoring the XY signal choice
- **WHEN** the user reloads after choosing the X signal and several Y signals on the XY tab
- **THEN** the XY tab shows the same X signal and the same Y signals in the same order

#### Scenario: Restoring the confidence constant
- **WHEN** the user reloads after changing k on the Configurações screen
- **THEN** the same k is in effect, and the Ponderado heatmap uses it

#### Scenario: Saved values are invalid or missing
- **WHEN** the stored constants, confidence constant, dyno settings or XY signal choice are absent or
  unreadable
- **THEN** the defaults are used instead and no error is shown

### Requirement: The former single snapshot becomes a run
A correction snapshot saved by a version of the app that kept only one ("last") snapshot SHALL be
converted, on the first restore, into the first correction run of the history, named after its
generation date and time, with the logs, time range and filter settings it recorded, and SHALL be
selected. Such a snapshot holds no samples, so the resulting run is one without samples (see
`correction-runs`): listed with its recipe, but not usable until generated again. The former saved
correction filter SHALL be converted to the unified filter (see `datalog-filter`). Nothing is lost and
no error is shown.

#### Scenario: Upgrading with an existing snapshot
- **WHEN** the app starts after the update with a snapshot saved by the previous version
- **THEN** the history holds one run built from it, it is selected, and it is shown as a run without
  samples that must be generated again

#### Scenario: Upgrading without a snapshot
- **WHEN** the app starts after the update with no saved snapshot
- **THEN** the history is empty and the Eficiência Volumétrica tab shows the explanatory message of the correction
  section

## REMOVED Requirements

### Requirement: Restored run without a mode
**Reason**: Runs no longer carry per-cell statistics, so "has a mode or not" stops being a property of
a run. The Mode option is always available for a run with samples, and a run without samples shows no
factors at all.
**Migration**: A run restored without samples is handled by "Restored run without samples"; generating
a new run provides every statistic, Mode included.

## ADDED Requirements

### Requirement: Restored run without samples
A correction run restored from a session saved before runs stored samples SHALL remain in the history
with its name, creation time and recipe and SHALL NOT be discarded or converted, but SHALL be shown as
unusable until generated again (see `correction-runs`). The Média / Mediana / Moda choice SHALL keep
its value and SHALL NOT be changed because such a run is selected.

#### Scenario: Restoring an older run
- **WHEN** the user reloads and a restored run has no samples
- **THEN** the run is in the history with its recipe, shown as generated with a previous method, with
  no factors, and is not discarded

#### Scenario: Statistic choice unaffected
- **WHEN** Moda was the selected statistic and a run without samples is selected
- **THEN** the Moda choice is kept and applies again as soon as a run with samples is selected

#### Scenario: Generating a new run after restoring
- **WHEN** the user generates a run in a session that restored only runs without samples
- **THEN** the new run has samples, is selected and displays factors normally
