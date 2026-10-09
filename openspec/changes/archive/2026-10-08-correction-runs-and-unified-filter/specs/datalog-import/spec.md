## MODIFIED Requirements

### Requirement: Logs tab sections
The Logs tab SHALL contain only the log import area and the list of imported logs. It SHALL NOT host
the filter (see `datalog-filter`), the correction generation action (see `correction-runs`) or the
engine constants (see `app-settings`).

#### Scenario: Logs tab with logs loaded
- **WHEN** the user opens the Logs tab with one or more logs imported
- **THEN** the import area and the log list are shown, with no filter panel and no Constantes section

#### Scenario: Logs tab with nothing loaded
- **WHEN** the user opens the Logs tab before importing anything
- **THEN** the import area and an empty-state message are shown
