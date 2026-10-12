## ADDED Requirements

### Requirement: Event hold-off filter definitions
Three independent hold-off filters SHALL each exclude the points that follow a transient, so the lambda
has time to settle. Each one defines an event per log row and a hold count N (an integer greater than or
equal to zero, in log points), and SHALL exclude every event row and the N points that follow the
**last** event row, so that a transient lasting several rows only starts counting its N when it ends.
A new event inside a running hold-off extends it.

- **Pedal step**: a row is an event when the amplitude (max − min) of Pedal within the trailing 200 ms
  ending at its timestamp is greater than the filter's own step limit (the step itself is still detected
  over 200 ms; only the hold counts in points).
- **MAP step**: the same, for MAP, with its own step limit.
- **Gear change**: a row is an event when its Marcha value differs from the previous row's, both being
  numbers.

The step limits of the Pedal and MAP hold-offs are independent of the maximum TPS delta and maximum MAP
delta filters, and each hold-off works whether or not those are enabled. Windows are computed
independently per log, and a hold-off SHALL NOT reach from one log into the next.

#### Scenario: Pedal step, then settling
- **WHEN** the Pedal hold-off is enabled with step limit 5 and N = 25, and the pedal moves 20 % in
  about 300 ms
- **THEN** every point from the first row where the 200 ms amplitude exceeded 5 until the 25th point
  after the last such row is excluded, and later points qualify normally with respect to this filter

#### Scenario: Hold counts from the end of the step
- **WHEN** a pedal step keeps the 200 ms amplitude above the limit for 6 consecutive rows
- **THEN** the N points of hold-off are counted after the sixth of those rows, not after the first

#### Scenario: Slow ramp is not an event
- **WHEN** the MAP rises steadily so that its amplitude within any 200 ms stays at or below the MAP
  step limit, for many points
- **THEN** the MAP hold-off excludes none of those points

#### Scenario: Second event extends the hold-off
- **WHEN** a second pedal step happens 10 points after the end of a first one, with N = 25
- **THEN** the points are excluded until the 25th point after the end of the second step

#### Scenario: Gear change
- **WHEN** the Marcha hold-off is enabled with N = 30 and Marcha goes from 2 to 3 at a row
- **THEN** that row and the 30 points after it are excluded

#### Scenario: Passing through neutral
- **WHEN** Marcha goes 2, 0, 0, 3 across consecutive rows
- **THEN** both changes (2 to 0 and 0 to 3) are events, and the hold-off ends N points after the
  second

#### Scenario: Log without the Marcha column
- **WHEN** the Marcha hold-off is enabled and a log has no Marcha signal
- **THEN** that log has no gear event and this filter excludes none of its points

#### Scenario: Marcha missing on a single row
- **WHEN** a row has no numeric Marcha value
- **THEN** it is not an event by itself, and the next row with a number is compared with the last
  numeric Marcha

#### Scenario: Hold-off does not cross logs
- **WHEN** two logs are active and an event happens at the last point of the first one
- **THEN** no point of the second log is excluded for it

#### Scenario: Independent of the delta filters
- **WHEN** the Pedal hold-off is enabled and the maximum TPS delta is disabled
- **THEN** the hold-off still detects steps with its own limit

### Requirement: Stability window filter definitions
Two independent stability filters, one for Pedal and one for MAP, SHALL each exclude a point when the
amplitude (max − min) of the signal within the trailing window of N points of its log (the point itself
and the N − 1 before it, N an integer greater than or equal to 2) is greater than the filter's own
limit. Each has its own limit and its own window length. A point with fewer than N points in its log up
to itself (near the start) SHALL NOT be excluded by it for lack of a full window. Windows are computed
independently per log.

#### Scenario: Steady cruise
- **WHEN** the MAP stability filter is enabled with limit 5 kPa and N = 25, and the MAP stays within
  3 kPa over the 25 points ending at a point
- **THEN** that point passes this filter

#### Scenario: Slow drift
- **WHEN** the pedal drifts 8 % over 25 points without any quick step, and the Pedal stability limit is
  5 % with N = 25
- **THEN** the points whose 25-point window holds that drift are excluded, even though no 200 ms amplitude
  was large

#### Scenario: Short history at the start of a log
- **WHEN** a point has fewer than N points in its log up to itself
- **THEN** this filter does not exclude it

#### Scenario: Different window per signal
- **WHEN** Pedal stability uses N = 20 and MAP stability uses N = 30
- **THEN** each filter measures its own signal over its own window

#### Scenario: Windows do not cross logs
- **WHEN** two logs are active
- **THEN** the window of a point in the second log never includes rows of the first
