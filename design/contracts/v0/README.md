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

Reconciliation rules added on 2026-09-09 (working brief v0.2):

- embedded alternative ids exactly match alternative_ids in order; goal,
  contestation and hazard links agree; no duplicate alternatives; Level 3 is empty;
- reflex_inputs reproduce stopping distance and T using the brief's formula,
  with positive braking decrement; Level 0 requires those inputs;
- accepted revisions match a previously offered and delivered alternative,
  preserve lineage ceilings and the original science target for vantage, and
  carry the exact acceptance; observation_cell is checked by gatekeeper/planner;
- outbound intents contain no parent scheduling fields, match the active tick,
  and are committed only after done; endpoint event occurred_tick equals sent_tick;
- endpoint-event payloads map to the exact record event/payload pair in Section
  5.2; duplicate source event ids fail; statuses do not duplicate state events;
- channel capacities are positive; FIFO state is per tier, shared across directions;
- science base64 is canonical, decoded bytes match reference hash and required
  byte_length, and transmission/budget count the entire canonical payload;
- all budget counters survive revision and replan; stored offered alternatives,
  acceptance links and counters participate in checkpoints;
- scenario truth metadata remains in privileged orchestration/simulator scopes;
  only explicit observer projections reach controllers;
- closure requires queue drain and verified mandatory evidence; its embedded head
  is its predecessor, and EOF without closure means incomplete;
- cross-platform replay retains the archived manifest; replay-host metadata is
  written separately, outside the event chain.

`ipc-frame.schema.json`, `outbound-intent.schema.json`, and
`endpoint-event.schema.json` define the process boundary. Runnable static review
checks and protocol examples are described in [examples/README.md](examples/README.md).
The v0 schemas were reconciled before any runtime release; archive the exact
bundle with runs and use a new version for incompatible changes after release.

The transport-only `spine-scenario-v0` alternative in IPC init is documented in
`../../first-spine-profile.md`. It preserves the full scenario's target/hazard
requirements. Its completion is an explicitly fake evidence-delivery test.

The implementation package should compile schemas once, expose one validator per
top-level artifact, and run all example documents through those validators in
continuous integration.

## Materialized terrain provenance

PC8 adds a required hashed `preparation.json` reference for `status: materialized`.
Such manifests also require non-null source, crop-offset and layer hashes.
Synthetic manifests keep their existing representation. Preparation metadata is
verified by terrain tooling; observer loaders retain access to only their own
initial layers and public geofence.
