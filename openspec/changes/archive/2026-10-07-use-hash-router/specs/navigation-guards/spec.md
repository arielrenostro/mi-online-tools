## ADDED Requirements

### Requirement: Routes are addressed in the URL fragment
Every route of the app SHALL be addressed by the URL fragment (the part after `#`), so that the
host only ever needs to serve the app's entry document at the site root. The route structure,
guards and index redirects defined in this capability SHALL behave identically regardless of
whether the route was reached by in-app navigation, by opening its URL directly, or by reloading.

#### Scenario: Opening a route URL directly
- **WHEN** the user opens `https://<host>/#/datalog/charts` in a new tab on a static host that
  serves only the site root
- **THEN** the app loads and renders the Gráficos route (subject to the active-log guard) instead
  of a server error

#### Scenario: Reloading on a route
- **WHEN** the user reloads the browser while on `https://<host>/#/tuning/ve`
- **THEN** the app loads again on the same route and the usual session restore and guards apply

#### Scenario: In-app navigation updates the fragment
- **WHEN** the user navigates from Home to Datalog using the TopBar
- **THEN** the address bar shows `#/datalog/logs` after the index redirect, with the path part of
  the URL unchanged

#### Scenario: Site root without a fragment
- **WHEN** the user opens `https://<host>/` with no fragment
- **THEN** the Home screen is shown

#### Scenario: Index redirects still apply
- **WHEN** the user opens `https://<host>/#/tuning` or `https://<host>/#/datalog`
- **THEN** the app redirects to `#/tuning/ve` or `#/datalog/logs` respectively
