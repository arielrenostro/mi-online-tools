## ADDED Requirements

### Requirement: The last open tab of Mapa and Datalog persists
The app SHALL persist, across reloads, the tab the user last had open in the Mapa section and in the
Datalog section, so that entering either section from the TopBar reopens it (see `navigation-guards`).
A saved tab the app no longer knows SHALL be ignored in favour of the section's default.

#### Scenario: Reopening a section after a reload
- **WHEN** the user reloads after leaving Datalog on the Gráficos tab and then opens Datalog from
  the TopBar
- **THEN** the Gráficos tab is shown

#### Scenario: Saved tab is unknown
- **WHEN** the stored last tab is missing or names a tab that no longer exists
- **THEN** the section's default tab opens and no error is shown
