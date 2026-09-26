# tuning-config Specification

## Purpose
Lets the user view and adjust the selected tuning engine's parameters through a form built
entirely from the engine's own schema, without any frontend-hardcoded knowledge of what those
parameters mean.

## Requirements

### Requirement: Form is generated from the engine's schema
The config modal SHALL render its fields dynamically from the currently selected engine's schema,
with no field hardcoded in the frontend, grouped into sections as the schema specifies.

#### Scenario: Opening the modal
- **WHEN** the user opens the config modal
- **THEN** every field shown, its type, label, description, and grouping into collapsible sections
  come from the engine's schema, not from frontend code

#### Scenario: Schema defines no grouping
- **WHEN** the engine's schema provides no explicit field grouping
- **THEN** all fields are shown together under a single default section

### Requirement: Field type determines its control
Each schema field's declared type SHALL determine which input control renders for it (numeric input
with unit and range, boolean switch, nullable numeric with an enable/disable toggle, select for
enumerated values, or plain text).

#### Scenario: Numeric field with min/max
- **WHEN** a field declares a minimum and maximum
- **THEN** its control shows the valid range alongside the input

#### Scenario: Nullable numeric field
- **WHEN** a field accepts both a number and "disabled" (null)
- **THEN** its control offers a toggle to enable/disable the field, showing a disabled-state label
  when off

#### Scenario: Enumerated field
- **WHEN** a field declares a fixed set of allowed values
- **THEN** its control is a selector limited to those values

### Requirement: Dependent fields
A field the schema marks as controlling another SHALL visually nest the controlled field beneath
it and disable it when the controller is off.

#### Scenario: Controller off
- **WHEN** a boolean controller field is switched off
- **THEN** the field(s) it controls are shown indented beneath it and disabled

#### Scenario: Controller on
- **WHEN** the controller field is switched on
- **THEN** the controlled field(s) become editable

### Requirement: Real-time validation
The form SHALL validate each field as it changes, and prevent saving while any field is invalid.

#### Scenario: Invalid value entered
- **WHEN** the user enters a value outside a field's declared type or range
- **THEN** an inline error is shown for that field and the Save control is disabled

#### Scenario: Saving with errors present
- **WHEN** the user attempts to save while any field has an error
- **THEN** saving is blocked and the view scrolls to the first invalid field

### Requirement: Save, cancel, and restore-defaults semantics
The modal SHALL only affect the stored config when the user explicitly saves; canceling discards
edits, and restoring defaults reloads the schema's default values into the form without saving.

#### Scenario: Editing without saving
- **WHEN** the user changes fields but has not yet saved
- **THEN** the stored config used by the next auto-tuning run is unchanged

#### Scenario: Saving
- **WHEN** the user saves with a fully valid form
- **THEN** the stored config updates to the new values, to be used by the next auto-tuning run,
  and the modal closes

#### Scenario: Canceling
- **WHEN** the user cancels, presses Escape, or clicks outside the modal
- **THEN** all local edits are discarded and the stored config remains as it was

#### Scenario: Restoring defaults
- **WHEN** the user activates "Restore defaults"
- **THEN** every field in the open form reloads to the engine's default values, without saving
  automatically

### Requirement: Saved config does not retroactively affect a prior run
Changing the config SHALL not alter a tuning result that was already produced; it SHALL instead
mark that result as outdated until auto-tuning runs again.

#### Scenario: Changing config after a run
- **WHEN** the user saves a config change after auto-tuning has already produced a result
- **THEN** the existing result is left as-is, but an indicator shows that it no longer reflects the
  current config
