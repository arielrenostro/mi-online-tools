## REMOVED Requirements

### Requirement: Invalidation rules keep derived data consistent
**Reason**: Snapshots no longer get invalidated: a run is a fixed result, and replacing the map no
longer clears anything.
**Migration**: See "Correction runs are never invalidated" below.

### Requirement: Restored snapshot without a mode
**Reason**: Renamed; it now speaks of runs, and "regenerating" an old run is no longer possible.
**Migration**: See "Restored run without a mode" below.

## MODIFIED Requirements

### Requirement: What persists across a session
The app SHALL persist, across reloads: the imported map (original and current edits), imported logs
(content, active/inactive state, and order), the history of correction runs (see `correction-runs`:
compiled cells, breakpoints, name, creation instant and recipe) and which run is selected, the applied
Datalog filter and its "Mostrar pontos filtrados" setting (see `datalog-filter`), the timeline's
cursor/selection/sparkline choice, the Configurações screen's values (displacement, air-fuel ratio,
BSFC, VE calibration, and the Ponderado confidence constant k), the Dinamômetro tab's settings (filters, Roda/Motor choice, loss percentage,
Bruto/Suavizado choice), and UI layout preferences (collapsed panels, active analysis view, chart
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
- **THEN** the whole history, each run's name and recipe, and the selected run are available again
  without regenerating

#### Scenario: Restoring the applied filter
- **WHEN** the user reloads after applying a filter and changing "Mostrar pontos filtrados"
- **THEN** the same filter is applied and the same setting is in effect

#### Scenario: Restoring constants and dyno settings
- **WHEN** the user reloads after changing the constants and the Dinamômetro tab's settings
- **THEN** the Configurações screen and the Dinamômetro tab show the same values as before the
  reload, and the derived signals are computed with them

#### Scenario: Restoring the confidence constant
- **WHEN** the user reloads after changing k on the Configurações screen
- **THEN** the same k is in effect, and the Ponderado heatmap uses it

#### Scenario: Saved values are invalid or missing
- **WHEN** the stored constants, confidence constant or dyno settings are absent or unreadable
- **THEN** the defaults are used instead and no error is shown

## ADDED Requirements

### Requirement: The former single snapshot becomes a run
A correction snapshot saved by a version of the app that kept only one ("last") snapshot SHALL be
converted, on the first restore, into the first correction run of the history, named after its
generation date and time, with the logs, time range and filter settings it recorded, and SHALL be
selected. The former saved correction filter SHALL be converted to the unified filter (see
`datalog-filter`). Nothing is lost and no error is shown.

#### Scenario: Upgrading with an existing snapshot
- **WHEN** the app starts after the update with a snapshot saved by the previous version
- **THEN** the history holds one run built from it, it is selected, and its factors show against the
  loaded map if the breakpoints match

#### Scenario: Upgrading without a snapshot
- **WHEN** the app starts after the update with no saved snapshot
- **THEN** the history is empty and the VE tab shows the explanatory message of the correction
  section

### Requirement: Correction runs are never invalidated
Correction runs are fixed results and SHALL NOT be invalidated, flagged or discarded by changes to
the active log set, the filter, the time selection, the constants or the map's cells. Replacing or
clearing the map SHALL NOT delete any run; a run whose breakpoints differ from the loaded map's is
shown as incompatible (see `correction-runs`). Only deleting a run, or exceeding the history limit,
removes one.

#### Scenario: Replacing the map
- **WHEN** the user imports a new map to replace the current one
- **THEN** every correction run stays in the history, edits reset to the newly imported map, and runs
  with different breakpoints are shown as incompatible

#### Scenario: Removing or deactivating an active log
- **WHEN** the user removes or deactivates a log that was used by a run
- **THEN** the run is unchanged and not flagged

#### Scenario: Reordering logs does not invalidate anything
- **WHEN** the user reorders active logs
- **THEN** no correction run changes

#### Scenario: Changing the filter or the time selection
- **WHEN** the user applies a different filter or changes the time selection after runs exist
- **THEN** no run changes and none is flagged

#### Scenario: Editing the map does not invalidate anything
- **WHEN** the user edits the editable map's cells
- **THEN** no run changes; the displayed factors of the selected run are recomputed from the new
  cells

### Requirement: Restored run without a mode
A correction run restored from a session saved before the Mode statistic existed — including the run
migrated from the former single snapshot — SHALL remain displayable and usable with Mean and Median,
and the Mode option SHALL be unavailable for it, since a run is never regenerated.

#### Scenario: Restoring an older run
- **WHEN** the user reloads and the restored run's cells have no mode value
- **THEN** the run is shown normally with Mean and Median working, the Mode option is disabled with a
  hint that only runs generated from now on carry a mode, and the run is not discarded

#### Scenario: Generating a new run enables Mode
- **WHEN** the user generates a new run
- **THEN** it carries a mode for every cell with data and the Mode option is enabled while it is
  selected

#### Scenario: Selected statistic no longer available
- **WHEN** Mode was the selected statistic and a run without mode is selected
- **THEN** the selection falls back to Median instead of showing empty factors
