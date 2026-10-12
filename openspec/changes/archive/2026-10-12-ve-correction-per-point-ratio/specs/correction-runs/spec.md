## RENAMED Requirements

- FROM: `### Requirement: A run is a compiled result, independent of the logs and the map's values`
- TO: `### Requirement: A run is a compiled set of samples, independent of the logs`

## MODIFIED Requirements

### Requirement: A run is a compiled set of samples, independent of the logs
Each generation SHALL create a correction run holding the samples of every qualifying point that
falls inside the map's MAP and RPM range — its MAP, its RPM and its VE Lambda — plus the MAP and RPM
breakpoints of the map it was generated against, its creation instant, its name, and — for display
only — the filenames of the logs used, the time range used per log, and the filter settings used. A
run SHALL NOT store per-cell statistics or correction factors: per-cell effective sample counts,
means, medians, modes and factors are always derived on display from the samples and the map
currently loaded (see `mapa-ve-correction`). After generation a run SHALL NOT depend on the logs:
removing, deactivating or reordering a log, or changing the filter or the time selection, SHALL NOT
change or flag any existing run.

#### Scenario: Factors follow the loaded map
- **WHEN** a run is selected and the user edits the editable map or loads another map with the same
  breakpoints
- **THEN** the displayed factors are recomputed from the run's stored samples and the map's current
  values, with no regeneration

#### Scenario: Removing a log used by a run
- **WHEN** the user removes or deactivates a log that was used to generate a run
- **THEN** the run is unchanged and still selectable, showing the filenames it was generated from

#### Scenario: Changing filters after generating
- **WHEN** the user changes the filter or the time selection after a run exists
- **THEN** no existing run changes and none is flagged as outdated

#### Scenario: Points outside the map are not kept
- **WHEN** a qualifying point's MAP or RPM falls outside the map's range
- **THEN** it is not part of the run's samples

## ADDED Requirements

### Requirement: Runs without samples are listed but not usable
A run that holds no samples, such as one generated before runs stored samples or the one migrated from
the former single snapshot, SHALL remain in the history with its name, creation time and recipe, and
SHALL be listed and selectable, but SHALL be shown as generated with a previous method that must be
generated again, with no factors displayed and no correction applicable. It SHALL NOT be converted or
reinterpreted, and it SHALL NOT be deleted automatically. The selector SHALL distinguish it from a run
that is merely incompatible with the loaded map.

#### Scenario: Selecting a run without samples
- **WHEN** the user selects a run that has no samples
- **THEN** the correction section states that the run was generated with a previous method and must be
  generated again, shows no factors, offers no apply action, and the run stays in the history

#### Scenario: Newest usable run is preferred after deleting the selected one
- **WHEN** the selected run is deleted and the history holds runs without samples and a run with samples
  compatible with the loaded map
- **THEN** the most recent run that is both compatible and has samples becomes the selected run, or none
  if there is none

#### Scenario: Generating a new run
- **WHEN** the user generates a run
- **THEN** it holds samples, becomes the selected run and displays factors against the loaded map

#### Scenario: Run without samples still renames and deletes
- **WHEN** the user renames or deletes a run without samples
- **THEN** it behaves as any other run in the history
