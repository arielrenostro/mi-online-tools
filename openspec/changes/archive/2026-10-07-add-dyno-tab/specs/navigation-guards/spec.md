## MODIFIED Requirements

### Requirement: Active-log prerequisite guard
The Dashboard, Gráficos, Dados, and Dinamômetro routes SHALL each individually require at least one
active log, redirecting to the Logs tab otherwise; the Logs tab itself has no such requirement.

#### Scenario: Accessing Dashboard/Charts/Data with no active logs
- **WHEN** the user navigates to `/datalog/dashboard`, `/datalog/charts`, or `/datalog/data` with
  zero active logs
- **THEN** the app redirects to `/datalog/logs`

#### Scenario: Accessing Dinamômetro with no active logs
- **WHEN** the user navigates to `/datalog/dyno` with zero active logs
- **THEN** the app redirects to `/datalog/logs`

#### Scenario: Logs tab has no prerequisite
- **WHEN** the user navigates to `/datalog/logs` with no logs imported
- **THEN** the tab renders normally, acting as the entry point for importing logs
