# mapa-arquivo Specification

## Purpose
The Arquivo tab of Mapa is the single place to manage the ECU map: load or replace it, export the
edited result, remove it, and see what is currently loaded. It works with or without a map, so it
is also the entry point for starting a Mapa session from scratch.

## Requirements

### Requirement: Arquivo tab in Mapa
The Mapa section SHALL provide an "Arquivo" tab, routed at `/mapa/arquivo`, listed before Eficiência Volumétrica, Ignition
and Lambda in the tab bar. The tab SHALL be reachable whether or not a map is loaded, and SHALL be
the only place that offers import, replace, export and removal of the map.

#### Scenario: Tab order
- **WHEN** the user opens any Mapa route
- **THEN** the tab bar lists Arquivo, Eficiência Volumétrica, Ignition and Lambda, in that order, and no separate
  actions menu is present in the tab bar

#### Scenario: Opening the tab without a map
- **WHEN** no map is loaded and the user navigates to `/mapa/arquivo`
- **THEN** the tab renders normally, showing the empty state described below, instead of
  redirecting or showing a prerequisite notice

#### Scenario: Reloading on the tab
- **WHEN** the user reloads the browser while on `/mapa/arquivo`
- **THEN** the app loads on the same route and, once session restore completes, the tab reflects
  the restored map (or the empty state if there is none)

### Requirement: Loading a map from the Arquivo tab
With no map loaded, the Arquivo tab SHALL let the user load a map by choosing a `.csv` file through a
native file picker or by dropping a `.csv` file onto the tab. The loaded file SHALL be parsed
client-side as defined in `map-import-export`, without navigating away from the tab.

#### Scenario: Empty state
- **WHEN** no map is loaded
- **THEN** the tab shows that no map is loaded, an "Importar mapa" action and a drop area; the
  "Exportar mapa" and "Remover mapa" actions and the map information are not shown

#### Scenario: Choosing a file
- **WHEN** the user selects a valid MasterInjection map CSV through the picker
- **THEN** the map is loaded, the tab switches to showing the map's information and actions, and
  the app stays on `/mapa/arquivo`

#### Scenario: Dropping files
- **WHEN** the user drops one or more files onto the tab and at least one is a `.csv`
- **THEN** the first `.csv` file is loaded as the map and the other files are ignored

#### Scenario: Dropping no CSV
- **WHEN** the user drops files and none is a `.csv`
- **THEN** nothing is loaded and the current map, if any, is unchanged

#### Scenario: Unreadable file
- **WHEN** the selected file cannot be parsed as a map
- **THEN** the tab shows an error message, and the previously loaded map, if any, remains loaded
  and unchanged

#### Scenario: Importing in progress
- **WHEN** a file is being parsed
- **THEN** the import actions are disabled and indicate that the import is in progress

### Requirement: Replacing the loaded map
With a map loaded, the Arquivo tab SHALL offer the same "Importar mapa" action as the empty state, which opens the file picker
(and accepts drops) to load another map. Replacing SHALL discard the previous map's edits and load
the new file as both the read-only original and the editable map, leaving the active logs, the
time selection and the correction runs untouched. When the current map has unsaved edits in any of
its tables, the app SHALL ask for confirmation before discarding them.

#### Scenario: Replacing an unedited map
- **WHEN** the loaded map has no edits and the user selects another valid CSV
- **THEN** the new map is loaded immediately, without a confirmation

#### Scenario: Replacing an edited map
- **WHEN** the loaded map has edits in at least one table and the user selects another CSV
- **THEN** a confirmation warns that the edits will be lost; confirming loads the new map and
  discarding the edits, cancelling keeps the current map and its edits

#### Scenario: Logs and runs are preserved
- **WHEN** the map is replaced
- **THEN** imported logs, their active state, the time selection and every correction run remain
  as they were

### Requirement: Exporting the map from the Arquivo tab
The Arquivo tab SHALL offer an "Exportar mapa" action that downloads the currently edited map as
defined by the "Client-side CSV export" requirement of `map-import-export`. The action SHALL be
shown only while a map is loaded.

#### Scenario: Exporting with a map
- **WHEN** a map is loaded and the user activates "Exportar mapa"
- **THEN** the browser immediately downloads the `_tuned` CSV with the current VE, ignition and
  lambda-target values, with no intermediate dialog, and the app stays on the tab

#### Scenario: Exporting without a map
- **WHEN** no map is loaded
- **THEN** "Exportar mapa" is not shown

### Requirement: Removing the map
The Arquivo tab SHALL offer a "Remover mapa" action, shown only while a map is loaded. Removing SHALL
require confirmation, and on confirmation SHALL discard the original map, the editable tables and
their undo/redo history, and the persisted copy of the map, so that a reload does not bring it
back. Imported logs, the time selection, the constants, the filters and every correction run SHALL
NOT be affected.

#### Scenario: Confirming removal
- **WHEN** the user activates "Remover mapa" and confirms
- **THEN** the map is discarded, the tab shows the empty state, and reloading the browser does not
  restore the map

#### Scenario: Cancelling removal
- **WHEN** the user activates "Remover mapa" and cancels the confirmation
- **THEN** the map and its edits remain exactly as they were

#### Scenario: Confirmation mentions unsaved edits
- **WHEN** the map has edits and the user activates "Remover mapa"
- **THEN** the confirmation states that the edits will be lost and that exporting first keeps them

#### Scenario: Removal keeps the rest of the session
- **WHEN** the map is removed while logs are imported and correction runs exist
- **THEN** the logs, the time selection and the correction runs are still present afterwards

#### Scenario: Staying in Mapa after removal
- **WHEN** the map is removed from the Arquivo tab
- **THEN** the app stays on `/mapa/arquivo` and does not navigate to Home

### Requirement: Map information
With a map loaded, the Arquivo tab SHALL show information about it, derived from the loaded map and
its current edits: the file name; the grid size as number of RPM columns × number of MAP rows; the
RPM range (lowest to highest breakpoint); the MAP range (lowest to highest breakpoint, in kPa); and,
for each of the VE, Ignição and Lambda alvo tables, how many cells currently differ from the
original imported values (or that there are no edits).

#### Scenario: Freshly imported map
- **WHEN** a map was just loaded and nothing was edited
- **THEN** the tab shows the file name, grid size, RPM range and MAP range, and each table reports
  no edits

#### Scenario: Edited tables
- **WHEN** the user has changed 7 VE cells and 2 ignition cells in the editable tables
- **THEN** the information shows 7 edited cells for VE, 2 for Ignição and no edits for Lambda alvo

#### Scenario: Information follows edits live
- **WHEN** the user edits a cell in the Eficiência Volumétrica tab and returns to the Arquivo tab
- **THEN** the edited-cell counts reflect the change, and undoing it back to the original value
  makes that cell stop counting as edited

#### Scenario: Non-standard grid size
- **WHEN** the loaded file declares a number of breakpoints different from the default
- **THEN** the grid size and ranges shown are those of that file
