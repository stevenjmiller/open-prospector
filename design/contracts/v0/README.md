# Open Prospector working contracts v0

These JSON Schemas are the executable working forms for the headless vertical
slice in `../../vertical-slice-implementation-brief.md`. They are deliberately
versioned `v0`: they do not freeze the formal Q18 protocol or create a program
decision.

Cross-schema rules that JSON Schema alone does not express are mandatory domain
validation:

- directive deadlines follow earliest-start ticks;
- rectangles have ordered bounds;
- observation belief-patch cells are a subset of footprint cells;
- `payload_hash` and `payload_bytes` match canonical payload bytes;
- channel delivery ticks match the configured per-tier FIFO queue calculation,
  and negotiation round-trip `L` is twice the run manifest's one-way latency;
- record sequence, predecessor, and event hashes form one valid chain;
- four PRNG seed words are not all zero;
- fixture layer names are unique; all eleven required layers exist; scope,
  encoding, and length match each name; mission-control loading refuses truth;
- a materialized fixture has non-null source, layer, and crop hashes/offsets;
- scenario hazard mappings are slump/significant-if-open,
  rock/reflex-if-closed, and no-go-zone/gatekeeper;
- record `payload_kind` selects the matching member of the payload union and
  `occurred_tick <= received_tick <= recorded_tick` for delivered events,
  while local mission-control events have null `received_tick` and equal
  occurred/recorded ticks;
- contestation level, severity, window, alternatives, and disposition obey the
  implementation brief; executable v0 deliberately has no Level 1.

The implementation package should compile schemas once, expose one validator per
top-level artifact, and run all example documents through those validators in
continuous integration.
