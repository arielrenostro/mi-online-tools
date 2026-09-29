## ADDED Requirements

### Requirement: Restored snapshot without a mode
A correction snapshot restored from a session saved before the Mode statistic existed SHALL remain
displayable and usable with Mean and Median, and the Mode option SHALL be unavailable for it until a
new snapshot is generated.

#### Scenario: Restoring an older snapshot
- **WHEN** the user reloads and the restored snapshot's cells have no mode value
- **THEN** the snapshot is shown normally with Mean and Median working, the Mode option is disabled
  with a hint that regenerating the correction factor enables it, and the snapshot is not discarded
  or flagged as outdated on that account alone

#### Scenario: Regenerating enables Mode
- **WHEN** the user runs "Gerar fator de correção" again
- **THEN** the new snapshot carries a mode for every cell with data and the Mode option is enabled

#### Scenario: Selected statistic no longer available
- **WHEN** Mode was the selected statistic and an older snapshot without mode is displayed
- **THEN** the selection falls back to Median instead of showing empty factors
