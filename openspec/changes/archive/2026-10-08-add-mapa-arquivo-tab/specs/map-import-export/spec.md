## REMOVED Requirements

### Requirement: TopBar map control
**Reason**: The TopBar no longer hosts any map control or map name: loading, replacing, exporting
and removing the map now live in the Arquivo tab of Mapa (see `mapa-arquivo`). The requirement also
described import/replace controls that the TopBar had already stopped offering.
**Migration**: Use the Arquivo tab (`/mapa/arquivo`) for importing and replacing the map (behavior
of replacing is specified under "Replacing the loaded map" in `mapa-arquivo`); the Home screen's
Mapa card keeps accepting a map drop/pick as its entry point.

## MODIFIED Requirements

### Requirement: Client-side CSV export
The app SHALL export the currently edited map as a downloadable CSV that matches the original
file's format, replacing only the VE/ignition/lambda-target lines with their current edited values
and leaving every other line unchanged.

#### Scenario: Export unavailable without a map
- **WHEN** no map has been imported
- **THEN** the export control is not shown (see `mapa-arquivo`)

#### Scenario: Export with a map
- **WHEN** a map is loaded and the user activates export
- **THEN** the browser immediately downloads a CSV named after the original file with a `_tuned`
  suffix, containing the current editable values for VE, ignition, and lambda-target lines and the
  original content for every other line, with no intermediate dialog
