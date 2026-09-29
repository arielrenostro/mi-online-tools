## REMOVED Requirements

### Requirement: Form is generated from the engine's schema
**Reason**: There is no backend engine left to expose a config schema — the client-side correction
algorithm has one fixed constant and a small set of filters, both edited inline.
**Migration**: See `tuning-ve-correction`'s correction filter panel on the Logs tab.

### Requirement: Field type determines its control
**Reason**: Same as above — no schema-driven form remains.
**Migration**: See `tuning-ve-correction`.

### Requirement: Dependent fields
**Reason**: Same as above — no schema-driven form remains.
**Migration**: None; the correction filter panel has no controller/dependent field relationships.

### Requirement: Real-time validation
**Reason**: Same as above — no schema-driven form remains.
**Migration**: None; each correction filter validates independently, inline, as part of
`tuning-ve-correction`.

### Requirement: Save, cancel, and restore-defaults semantics
**Reason**: The correction filter panel applies its values live (see `tuning-ve-correction`) —
there is no separate save/cancel step or engine defaults to restore.
**Migration**: None.

### Requirement: Saved config does not retroactively affect a prior run
**Reason**: Superseded by `tuning-ve-correction`'s own staleness rule, which covers filter changes
made after a correction snapshot exists.
**Migration**: See `tuning-ve-correction`'s "Snapshot staleness" requirement.
