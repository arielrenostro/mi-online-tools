## MODIFIED Requirements

### Requirement: Route structure and index redirects
The Mapa and Datalog sections SHALL each redirect their index route to a default sub-route, and
the global TopBar SHALL remain visible across every route.

#### Scenario: Visiting the Mapa index
- **WHEN** the user navigates to `/mapa`
- **THEN** the app redirects to `/mapa/ve`

#### Scenario: Visiting the Datalog index
- **WHEN** the user navigates to `/datalog`
- **THEN** the app redirects to `/datalog/logs`

#### Scenario: Legacy Tuning URLs
- **WHEN** the user opens a route under the former `#/tuning` prefix (for example `#/tuning/ve`)
- **THEN** the app redirects to `#/mapa`, which in turn redirects to `#/mapa/ve`

### Requirement: Map prerequisite guard
The Eficiência Volumétrica, Ignition and Lambda routes under Mapa SHALL each individually require a map to have been
imported; without one they SHALL render a notice that no map is loaded, with a link to the Arquivo
tab, instead of their content. The Arquivo tab (`/mapa/arquivo`) SHALL NOT have this requirement, and
the Mapa tab bar SHALL remain visible regardless of whether a map is loaded.

#### Scenario: Accessing Mapa without a map
- **WHEN** the user navigates to `/mapa/ve`, `/mapa/ignition` or `/mapa/lambda` without a map
  imported
- **THEN** the route renders a "no map loaded" notice with a link to `/mapa/arquivo`, the URL does
  not change, and the Mapa tab bar is still shown

#### Scenario: Arquivo tab has no prerequisite
- **WHEN** the user navigates to `/mapa/arquivo` without a map imported
- **THEN** the tab renders normally, acting as the entry point for importing a map

#### Scenario: Map removed while on Eficiência Volumétrica
- **WHEN** the map becomes unavailable while the user is on `/mapa/ve`
- **THEN** the route shows the same "no map loaded" notice instead of its content

### Requirement: No automatic navigation
The app SHALL never change the current route on its own, except for the index redirects defined
above.

#### Scenario: Importing a map does not navigate
- **WHEN** the user imports a map while on the Home screen
- **THEN** the app stays on the Home screen; navigating to Mapa requires an explicit action

### Requirement: Global navigation affordances
The TopBar SHALL provide a way back to Home from any screen. The TopBar SHALL NOT display the
imported map's file name or any other map indicator; the map is shown in the Arquivo tab of Mapa.

#### Scenario: Returning to Home
- **WHEN** the user activates the TopBar logo/name from any screen
- **THEN** the app navigates to the Home screen

#### Scenario: Map badge
- **WHEN** a map is currently imported, or none is
- **THEN** the TopBar shows no map file name or map badge in either case

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
- **WHEN** the user reloads the browser while on `https://<host>/#/mapa/ve`
- **THEN** the app loads again on the same route and the usual session restore and guards apply

#### Scenario: In-app navigation updates the fragment
- **WHEN** the user navigates from Home to Datalog using the TopBar
- **THEN** the address bar shows `#/datalog/logs` after the index redirect, with the path part of
  the URL unchanged

#### Scenario: Site root without a fragment
- **WHEN** the user opens `https://<host>/` with no fragment
- **THEN** the Home screen is shown

#### Scenario: Index redirects still apply
- **WHEN** the user opens `https://<host>/#/mapa` or `https://<host>/#/datalog`
- **THEN** the app redirects to `#/mapa/ve` or `#/datalog/logs` respectively
