# navigation-guards Specification

## Purpose
Defines the app's route structure, the prerequisite guards that protect routes needing a map or
active logs, and the locked-tab pattern used for features not yet available in v1.

## Requirements

### Requirement: Route structure and index redirects
The Mapa and Datalog sections SHALL each redirect their index route to the tab the user was last on
in that section (or to a default sub-route when there is none), and the global TopBar SHALL remain
visible across every route.

#### Scenario: Visiting the Mapa index
- **WHEN** the user navigates to `/mapa` and has not opened any Mapa tab before
- **THEN** the app redirects to `/mapa/ve`

#### Scenario: Visiting the Datalog index
- **WHEN** the user navigates to `/datalog` and has not opened any Datalog tab before
- **THEN** the app redirects to `/datalog/logs`

#### Scenario: Returning to a section reopens the tab last used there
- **WHEN** the user was on a Datalog tab (for example XY), moved to Mapa or Home, and activates the
  TopBar's Datalog entry
- **THEN** the app opens `/datalog/xy`, and likewise the TopBar's Mapa entry reopens the Mapa tab
  last used

#### Scenario: Legacy Tuning URLs
- **WHEN** the user opens a route under the former `#/tuning` prefix (for example `#/tuning/ve`)
- **THEN** the app redirects to `#/mapa`, which in turn redirects to the Mapa tab last used (by
  default `#/mapa/ve`)

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

### Requirement: Guards wait for session restore before redirecting
A guard SHALL show a restoring indicator instead of evaluating its prerequisite while the session
is still being restored, to avoid redirecting away from data that is about to be restored.

#### Scenario: Reloading a guarded route
- **WHEN** the user reloads the browser on a guarded route while session restore is still in
  progress
- **THEN** the guard shows a restoring indicator instead of redirecting, then evaluates its
  prerequisite once restore completes

### Requirement: Locked-tab pattern
A tab representing a feature not available in the current version SHALL remain visible in
navigation, be non-interactive, and communicate that it is not yet available.

#### Scenario: Hovering a locked tab
- **WHEN** the user hovers a locked tab
- **THEN** a tooltip explains the feature is not yet available

#### Scenario: Clicking a locked tab
- **WHEN** the user clicks a locked tab
- **THEN** the URL does not change and no navigation occurs

#### Scenario: Direct URL access to a locked route
- **WHEN** the user navigates directly to a locked route's URL
- **THEN** the same locked/unavailable state is rendered as if reached through the tab

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

### Requirement: Datalog tab order
The Datalog screen's tab bar SHALL list its tabs, from left to right, in this order: Logs, Dados,
Dashboard, Gráficos, XY, Dinamômetro. The order SHALL NOT depend on whether logs are loaded, and the
routes and guards of each tab are unaffected by it.

#### Scenario: Viewing the Datalog tab bar
- **WHEN** the user opens any Datalog tab
- **THEN** the tab bar shows Logs, Dados, Dashboard, Gráficos, XY and Dinamômetro in that order
