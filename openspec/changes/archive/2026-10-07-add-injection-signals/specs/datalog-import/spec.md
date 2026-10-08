## ADDED Requirements

### Requirement: Injection, electrical and pressure signals
Importing a datalog CSV SHALL read, when their columns are present, the injector pulse width, injector
dead time, battery voltage, A/C compressor pressure, oil pressure and accelerator-change columns, and
expose each as a signal converted to its real unit, like any other signal:

| Signal | CSV column | Raw → real | Unit |
|--------|------------|------------|------|
| Inj. Pulse | `Inj. Pulse` | raw ÷ 100 (1337 → 13.37) | ms |
| Inj. DT | `Inj. DT` | raw ÷ 1000 (1100 → 1.1) | ms |
| ACP | `ACP %` | raw (the header says `%` but the value is a pressure) | kPa |
| dACC | `dACC %` | (raw − 5000) ÷ 100 | % |
| Batt Volt. | `Batt Volt.` | raw ÷ 10 | V |
| Pressão Óleo | `Lambda 2` | raw ÷ 100 (173 → 1.73) | bar |

Every one of these columns SHALL be optional: a log without a column SHALL still import, and its
rows and signal list simply have no such signal. A row whose field for one of them is empty or not
numeric SHALL be kept, without that signal's value, instead of being discarded.

The raw value 5000 of `dACC %` means "no accelerator change"; a positive dACC means the pedal is
rising and a negative one that it is being released. The divisor of dACC is the best available
reading and has not been verified against the ECU: it is a display scale, not a calibrated
percentage, and SHALL NOT be used by any computation.

#### Scenario: Log with all the columns
- **WHEN** a row has `Inj. Pulse` 1337, `Inj. DT` 1100, `ACP %` 734, `dACC %` 5000, `Batt Volt.` 140
  and `Lambda 2` 173
- **THEN** that row's Inj. Pulse is 13.37 ms, Inj. DT is 1.1 ms, ACP is 734 kPa, dACC is 0 %, Batt
  Volt. is 14.0 V and Pressão Óleo is 1.73 bar, and all six are listed among the log's signals

#### Scenario: Pedal released
- **WHEN** a row has `dACC %` 4900
- **THEN** that row's dACC is -1 %

#### Scenario: Log without one of the columns
- **WHEN** the CSV header has no `ACP %` column
- **THEN** the log imports normally, without an ACP signal, and its other signals are unaffected

#### Scenario: Value is not a number
- **WHEN** a row's `Inj. DT` field is empty or not numeric
- **THEN** that row is kept, without an Inj. DT value, instead of being discarded

### Requirement: Effective injection time signal
The app SHALL provide a derived "Inj. Efetivo" signal, in ms, equal to Inj. Pulse minus Inj. DT — the
part of the logged pulse that delivers fuel, since the logged pulse already includes the dead time.
It SHALL exist only for logs that carry both Inj. Pulse and Inj. DT, and be listed among a log's
signals only then.

#### Scenario: Both inputs present
- **WHEN** a row has Inj. Pulse 2.69 ms and Inj. DT 1.10 ms
- **THEN** that row's Inj. Efetivo is 1.59 ms

#### Scenario: A log lacks one of the inputs
- **WHEN** the CSV has no `Inj. DT` column
- **THEN** the log imports normally and has no Inj. Efetivo signal

#### Scenario: A row lacks one of the inputs
- **WHEN** a row's Inj. Pulse or Inj. DT value is missing because the field was not numeric
- **THEN** that row has no Inj. Efetivo value, and the row is still kept

### Requirement: Related signals are listed together
Every place that lists the available signals — the Dashboard cards, the Gráficos signal sidebar and
signal picker, and the Dados columns and column menu — SHALL list them in one shared order in which
related signals are adjacent, regardless of the order in which the CSV columns appear or in which a
log was saved. The groups, in order, are:

1. RPM, MAP, Boost, Turbo Target
2. Pedal, dACC
3. Lambda 1, Lambda Target, Lambda Corr, Lambda Loop
4. VE, VE Lambda, VE Lambda Corrigido
5. Inj. Pulse, Inj. DT, Inj. Efetivo, Inj. Utiliz.
6. Ign. Adv.
7. CLT, IAT
8. Batt Volt., ACP, Pressão Óleo
9. KM/H, Marcha
10. Potência, Torque

A signal that is not available (a log without its column, or a runtime signal without its inputs)
is simply absent from the list; the others keep their relative order. A signal not named above is
listed after all the named ones.

#### Scenario: VE signals are adjacent
- **WHEN** the user opens any signal list with VE, VE Lambda and VE Lambda Corrigido available
- **THEN** those three appear consecutively, in that order

#### Scenario: Runtime signals sit with their group
- **WHEN** the Constantes-derived signals are available
- **THEN** VE Lambda Corrigido is listed right after VE Lambda, and Potência and Torque are
  listed together after the other signals' groups, not mixed into them

#### Scenario: Log saved before the grouped order existed
- **WHEN** a log restored from a previous session had its signals stored in a different order
- **THEN** the lists still show the grouped order

#### Scenario: Missing signal does not break its group
- **WHEN** a log has no Inj. DT column
- **THEN** the injection group shows Inj. Pulse and Inj. Utiliz. adjacent, with no gap or placeholder
