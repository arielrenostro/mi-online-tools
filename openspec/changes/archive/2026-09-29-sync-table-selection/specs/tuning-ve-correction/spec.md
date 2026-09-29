## MODIFIED Requirements

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
