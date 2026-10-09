## MODIFIED Requirements

### Requirement: Skip-first-N-after-loop-transition filter definitions
Four independent skip filters SHALL each count points around a Lambda Loop transition, independently
per log. There are two kinds of transition — into closed loop (open to either closed state, plain
closed or closed with auto-correção) and into open loop (either closed state to open) — and, for
each, two windows: **after** the transition (the first N points counted from the transition point,
inclusive) and **before** it (the N points immediately preceding the transition point, which itself
is not part of the window). Each filter excludes the points of its own window for its own kind of
transition, with N configured separately per filter. Toggling between the two closed states without
passing through open SHALL NOT restart or create any window.

#### Scenario: Entering closed loop mid-log
- **WHEN** a log's Lambda Loop value transitions from open to either closed state
- **THEN** the following N points (as configured for the closed-loop "after" filter) are excluded,
  after which points qualify normally with respect to this filter

#### Scenario: Entering open loop mid-log
- **WHEN** a log's Lambda Loop value transitions from either closed state to open
- **THEN** the following N points (as configured for the open-loop "after" filter) are excluded,
  after which points qualify normally with respect to this filter

#### Scenario: Points before entering closed loop
- **WHEN** a log's Lambda Loop value transitions from open to either closed state and the closed-loop
  "before" filter is set to N
- **THEN** the N points immediately preceding the first closed point (all of them in open loop,
  unless a shorter stretch precedes) are excluded, and the first closed point itself is not excluded
  by this filter

#### Scenario: Points before entering open loop
- **WHEN** a log's Lambda Loop value transitions from either closed state to open and the open-loop
  "before" filter is set to N
- **THEN** the N points immediately preceding the first open point are excluded, and the first open
  point itself is not excluded by this filter

#### Scenario: Fewer than N points before the transition
- **WHEN** a "before" window would extend past the start of the log
- **THEN** only the points that exist are excluded, and no other point is affected

#### Scenario: Toggling auto-correção while staying closed
- **WHEN** Lambda Loop changes between the two closed states (with or without auto-correção) without
  returning to open in between
- **THEN** no "before" or "after" window is created, and neither "after" countdown already in
  progress (if any) is restarted

#### Scenario: Counters reset per log
- **WHEN** two logs are active and each has its own loop transitions
- **THEN** all four skip windows are computed independently for each log, not carried across the
  concatenated timeline — in particular a "before" window never reaches into the previous log and the
  first point of a log is never treated as a transition
