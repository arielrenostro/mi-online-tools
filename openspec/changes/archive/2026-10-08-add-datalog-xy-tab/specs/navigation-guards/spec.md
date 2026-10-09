## MODIFIED Requirements

### Requirement: Active-log prerequisite guard
The Dashboard, Gráficos, Dados, Dinamômetro, and XY routes SHALL each individually require at least one
active log, redirecting to the Logs tab otherwise; the Logs tab itself has no such requirement.

#### Scenario: Accessing Dashboard/Charts/Data with no active logs
- **WHEN** the user navigates to `/datalog/dashboard`, `/datalog/charts`, or `/datalog/data` with
  zero active logs
- **THEN** the app redirects to `/datalog/logs`

#### Scenario: Accessing Dinamômetro with no active logs
- **WHEN** the user navigates to `/datalog/dyno` with zero active logs
- **THEN** the app redirects to `/datalog/logs`

#### Scenario: Accessing XY with no active logs
- **WHEN** the user navigates to `/datalog/xy` with zero active logs
- **THEN** the app redirects to `/datalog/logs`

#### Scenario: Logs tab has no prerequisite
- **WHEN** the user navigates to `/datalog/logs` with no logs imported
- **THEN** the tab renders normally, acting as the entry point for importing logs

## ADDED Requirements

### Requirement: Datalog tab order
The Datalog screen's tab bar SHALL list its tabs, from left to right, in this order: Logs, Dados,
Dashboard, Gráficos, XY, Dinamômetro. The order SHALL NOT depend on whether logs are loaded, and the
routes and guards of each tab are unaffected by it.

#### Scenario: Viewing the Datalog tab bar
- **WHEN** the user opens any Datalog tab
- **THEN** the tab bar shows Logs, Dados, Dashboard, Gráficos, XY and Dinamômetro in that order
