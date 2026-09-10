# Open Prospector Headless Vertical Slice — Implementation Brief

**Version:** Working freeze v0.2
**Date:** 2026-09-09
**Status:** Executable engineering baseline; provisional Rung-0 policy  
**Parent design:** `application-software-design.md`, Section 14

## 1. Purpose and authority

This brief freezes enough reversible choices for an implementation agent to
build the first headless slice without inventing product policy. It is not the
formal Q18 contestation artifact, flight software, or an adopted program
decision. Every threshold below is namespaced `slice-v0`; evidence from the
slice may replace it without rewriting old runs.

The brief resolves implementation ambiguity in favor of one testable reference
path. The parent design and the program ledgers remain authoritative. A conflict
with D/PD material is a defect in this brief.

## 2. Handoff verdict

Scaffolding may begin now. Endpoint integration is gated on the contract and
protocol conformance cases in Section 11 and `contracts/v0/examples/README.md`.
This reconciliation is a working baseline, not evidence that those runtime
acceptance tests have passed.
The following work packages use the shared contracts and ordered gates below:

1. contracts and canonical serialization;
2. deterministic clock, channel, and append-only record;
3. grid world, belief projections, sensor footprints, and leak tests;
4. asset-side planner, policy, and finite-state controller;
5. two-process scenario runner and audit replay;
6. synthetic fixture generation;
7. HiRISE fixture materialization after the data-preparation prerequisite.

PC9 subsequently permits the local read-only archive viewer described in
`archive-viewer-profile.md`; the headless runtime remains unchanged.

The command-capable interactive client, Blender worker, campaign rehearsal sampling, account
identity, signing infrastructure, real classifier calls, and real-time engine
remain out of scope. No work package may silently add them.

## 3. Reference implementation stack

The slice reference implementation uses:

- Node.js 24 LTS and TypeScript, ECMAScript modules;
- npm workspaces and a committed `package-lock.json`;
- Node's built-in `node:test`, `crypto`, streams, and child-process APIs;
- Ajv 8 for JSON Schema draft 2020-12 validation;
- no web framework, database, renderer, physics engine, or network service.

This is a Rung-0 reference-stack decision, not a choice of language for future
flight autonomy. The open boundary is the JSON contract and process protocol,
not TypeScript types. The scaffold must pin the exact Node, npm, TypeScript, and
Ajv versions it actually installs. The current workstation has Node 24.12.0 and
npm 11.6.2. Rust and GDAL are not installed and are not prerequisites for work
packages 1-6.

Proposed workspace layout:

```text
packages/
  contracts/          schema loader, validators, canonical JSON
  deterministic/      ids, hashing, integer math, seeded PRNG
  belief/             observer-scoped belief state and patches
  simulation-world/   truth fixtures and sensor adapters
  channel/            tick-scheduled Tier-1/Tier-2 delivery
  record/             append-only chain and audit reader
  autonomy/           policy, A*, alternatives, state machine
apps/
  mission-control/    scenario owner and test runner
  fleet-endpoint/     separate asset-side process
fixtures/
  synthetic-v0/       generated contract fixture
  candor-sw-v0/       materialized real-data-derived fixture
tests/
  contract/ integration/ acceptance/
```

Packages form a directed dependency graph enforced by lint and build tests:

| Consumer | Permitted project packages | Forbidden project packages |
|---|---|---|
| `mission-control` | contracts, deterministic, belief, channel, record | simulation-world, autonomy |
| `fleet-endpoint` | contracts, deterministic, belief, autonomy, simulation-world | channel, record, mission-control |
| `simulation-world` | contracts, deterministic, belief | channel, record, mission-control |
| `autonomy` | contracts, deterministic, belief | simulation-world, channel, record, mission-control |

The fleet-endpoint executable is the composition root. It may construct the
simulator adapter, but the adapter is the only object allowed to hold truth and
produce endpoint-facing observations; it never passes a truth handle into
autonomy or belief. Future hardware replaces that adapter.

## 4. Determinism profile

### 4.1 Numeric domain

- JSON numbers are integers in the JavaScript safe range; schemas reject
  fractions and values outside `[-9007199254740991, 9007199254740991]`.
- authoritative horizontal positions and elevations are signed millimetres;
- grid coordinates are zero-based integer row and column;
- time is an unsigned campaign tick, with 100 ms per tick;
- confidence and probabilities are integer parts per million (`0..1000000`);
- slope is signed rise/run in parts per thousand;
- cost and energy are dimensionless non-negative integer units;
- authoritative logic must not call wall-clock time or use floating-point
  values, trigonometry, locale-sensitive formatting, or object iteration order.
- `.gitattributes` forces LF for JSON, NDJSON, schemas, and golden files.

The 100 ms tick is simulation time. Faster-than-real-time execution changes how
quickly ticks are computed, never `L`, `T`, deadlines, or delivery times.

### 4.2 Ordering, identifiers, and random draws

At one tick, work occurs in this order:

1. the parent advances the campaign clock to the next tick of interest;
2. it delivers every message due at that tick in `(tier, link_start_tick,
   creation_ordinal ascending)` order, Tier 1 before Tier 2;
3. the endpoint applies transitions caused by delivered messages;
4. it takes the scheduled sensor sample;
5. it plans or advances one body step;
6. it applies resulting transitions and belief updates;
7. it emits outbound messages and accountable events in creation order, then
   returns `done` for that tick.

Fixture, scenario, directive, and run identifiers come from their manifests.
Generated identifiers are `kind:` plus the first 24 lowercase hexadecimal
characters of SHA-256 over the canonical tuple of run id, object kind, creation
tick, and per-kind creation ordinal. Random draws use a documented xoshiro128**
implementation over four `uint32` words. The run manifest supplies the four
seed words, which must not all be zero. Each draw records stream name and draw
index. A library PRNG
must not replace this algorithm under the same compatibility version.
The scripted `slice-v0` scenario makes zero random draws; the pinned algorithm
and seed exist to make accidental randomness detectable and future additions
versionable. JavaScript implementations use `Math.imul` and unsigned shifts and
must pass published xoshiro128** known-answer vectors.

### 4.3 Canonical JSON and hashes

The compatibility profile `op-jcs-int-v0` is RFC 8785 JSON Canonicalization
restricted to the integer/string/boolean/null domain in Section 4.1. Schemas
reject values outside that profile. SHA-256 hashes are lowercase and written as
`sha256:<64 hex characters>`.

Parsers reject duplicate object keys and any source token that canonical
round-trip comparison changes, including `1.0`, exponent notation, `-0`,
non-LF line endings, or insignificant whitespace in a canonical/golden stream.
`JSON.parse` alone is therefore not an acceptable input validator.

The canonical id tuple is the JSON array `[run_id, kind, creation_tick, ordinal]`.
Array order is significant. Ordinals start at zero per kind across the run,
not once per tick, except the explicitly global channel-message counter.

For record event sequence `n`:

- `prev_event_hash` is null only for sequence zero and otherwise equals event
  `n-1`'s `event_hash`;
- compute `event_hash` from canonical UTF-8 bytes of the entire event with the
  `event_hash` member omitted;
- the event is durable only after validation, sequence checking, recomputation,
  and an atomic append followed by flush;
- replay rejects duplicate sequence numbers, broken predecessors, invalid
  payload hashes, or non-canonical input.

High-rate ticks, poses, and sensor samples are telemetry unless a policy or
state change refers to them as evidence. The Tier-1 chain contains decisions,
not every simulation mutation.

## 5. Process and channel contract

The mission-control executable is the scenario runner and campaign-clock owner.
It starts exactly one fleet-endpoint child process. The two processes exchange
one canonical JSON object per UTF-8 line over standard input/output. Standard
error is diagnostic only and never affects results.

Control frames are not record events. The protocol is request/response at tick
boundaries:

```json
{"frame":"init","run_manifest":{},"scenario":{},"fixture_root":"fixtures/synthetic-v0"}
{"frame":"ready","run_id":"run:slice-v0"}
{"frame":"advance","to_tick":42,"deliveries":[]}
{"frame":"emit","intent":{}}
{"frame":"done","at_tick":42}
{"frame":"checkpoint","at_tick":42}
{"frame":"checkpoint-result","at_tick":42,"state_hash":"sha256:..."}
{"frame":"shutdown"}
{"frame":"stopped","at_tick":42}
```

`init` is first and receives exactly one `ready`. It supplies validated values,
not paths to mission-control-private state. Every `advance` must have
`to_tick == current_tick + 1`; the reference runner advances one tick at a time
even while holding. It contains all and only mission-to-asset messages with
`deliver_at_tick == to_tick`, already sorted by Section 4.2. The endpoint
advances its clock, applies those deliveries, takes the scheduled step, emits
zero or more `emit` intent frames, and terminates the reply with exactly one `done`.
Frames validate against `ipc-frame.schema.json`; the sketches above omit required
payload members and are not validation examples.
The parent sends no next request before `done`. Early, late, duplicate,
skipped-tick, or omitted delivery is a protocol fault. The endpoint cannot
inspect the channel queue. State hashes are computed only for explicit
checkpoints and run closure, not every `done`.

Tier 1 and Tier 2 are independent FIFO serial links, consistent with PD14's two
paths. Within one tier, messages queue by `(sent_tick, creation_ordinal)`. The
ordinal is a run-global, zero-based message creation counter assigned by the
parent. It is covered when the complete channel message is hashed as record
payload; `payload_hash` hashes only the payload, not scheduling metadata.
For each message:

```text
link_start_tick = max(sent_tick, previous_link_finish_tick)
transmission_ticks = max(1, ceil(payload_bytes / bytes_per_tick))
link_finish_tick = link_start_tick + transmission_ticks
deliver_at_tick = link_finish_tick + one_way_latency_ticks
```

The slice channel profile is:

- one-way latency: 3,000 ticks (300 seconds);
- round-trip latency `L`: 6,000 ticks (600 seconds);
- Tier 1: 4,096 bytes per tick;
- Tier 2: 1,024 bytes per tick;
- no loss, contact gaps, retransmission, or clock drift in v0.

| Payload kind | Direction | Tier | Priority |
|---|---|---:|---:|
| cleared directive / directive revision | mission to asset | 1 | 220 |
| contestation | asset to mission | 1 | 240 |
| endpoint status / endpoint audit event (including fault) | asset to mission | 1 | 230 |
| plan summary | asset to mission | 1 | 200 |
| observation summary | asset to mission | 1 | 180 |
| full observation and belief patch | asset to mission | 2 | 160 |
| science artifact | asset to mission | 2 | 100 |

Priority is record/display metadata in v0; it does not reorder a tier's FIFO
link. Tier-1 observation summaries are capped at 4,096 canonical bytes and do
not contain a cell patch. Only a delivered Tier-2 full observation updates
mission control's cell-level belief.

Messages are immutable after enqueue. Mission control retains only delivered
asset information in `received belief`. Scene and audit projections for the
operator consume received belief, never endpoint belief.

### 5.1 Scheduling ownership and tick commit

Only the parent constructs `channel-message-v0`. The endpoint emits an
`outbound-intent` containing sent tick, direction, tier, priority, kind, and typed
payload; it never supplies delivery time, message id, global ordinal, or hashes.
The parent validates and buffers intents until `done`, then assigns ordinals,
message ids, canonical payload hashes/lengths, and delivery times. A message id
uses Section 4.2 with kind `message` and the global message ordinal.

At tick t, the parent first processes due asset-to-mission deliveries in Section
4.2 order, then due local script actions in action-creation order, assigning ordinals to resulting mission
messages. It then sends only due mission-to-asset deliveries in `advance`.
Endpoint intents receive ordinals afterward in emitted order. The two FIFO links
are shared across directions within each tier (half-duplex v0); they have
independent finish ticks, initially the manifest start tick. Even zero latency
delivers no earlier than t+1. The first advance is start_tick+1; the initial
directive is submitted and enqueued at start_tick.

Malformed output, child exit, or a 30-second wall-time watchdog before `done`
discards that tick's buffered intents, terminates the simulated child, and closes
the run as incomplete. Previously delivered parent-side events remain durable.
This is a simulation abort, not a physical safe-state acknowledgement. Wall time
never enters a successful chain; timeout failures are not reproducibility runs.
An endpoint cannot detect an omitted delivery without queue access; that check
belongs to the parent/channel conformance harness.

### 5.2 Endpoint audit and science transport

`endpoint-event` carries the unchained envelope in `endpoint-event.schema.json`
on Tier 1. It transports directive receipt, accountable state transitions,
classifier consumption, and endpoint faults. On delivery the parent preserves
event id, actor, subject, occurred tick and payload; it assigns sequence,
received/recorded ticks and chain hashes. Payload kinds are respectively
`directive`, `state-transition`, `classifier-result`, and `fault`. The other
asset payloads map once each: contestation to `contestation-opened`, plan summary
to `plan-proposed`, observation summary to `observation-summarized`; their event
ids use kind `message-event` and the source message creation ordinal at sent tick.
They occur at sent tick, with asset as actor and directive/observation as subject.
`status` is optional telemetry, never a substitute for an accountable transition.
Full observations produce `received-belief-updated` locally on delivery. Receipt
is an acknowledgement only; it does not duplicate directive submission.

Every transition listed in Section 9 emits an endpoint state event, including
planning, scheduled, and failed. Its cause is the directive id for receipt,
scheduling, deadline or budget failure; contestation id for holds/locks; plan id
for execution/recovery; final observation id for completion; endpoint-fault
event id for faults. Record the reason code and cumulative budget snapshot.
Emit the cause before its transition; emit classifier consumption after reflex
and before recovery. Generated unchained endpoint event ids use kind
`endpoint-event`; locally
generated record ids use kind `mission-event`, preventing same-tick ordinal
collisions between sources. No control frame publishes endpoint knowledge to
operators. The parent records received-belief-updated as a local event at delivery
tick (received_tick=null); the linked observation preserves its source tick.

A `science-artifact` payload contains an evidence reference and canonical base64
content. Decoded bytes must match the required reference byte_length and SHA-256;
base64 must re-encode identically. Transmission and budget count the entire
canonical JSON payload (including base64 expansion), exactly once per enqueue.
References in other messages do not grant access to content. Mission control
exposes content only after the artifact message is delivered and verified.

## 6. Spatial, fixture, and belief contract

### 6.1 Grid

The slice uses one 256 by 256 grid at 1,000 mm per cell. Row zero is the north
edge; column zero is the west edge. Local coordinates are east (`e_mm`), north
(`n_mm`), and up (`u_mm`) from the fixture origin. Cell centres are:

```text
e_mm = (column * 1000) + 500
n_mm = ((255 - row) * 1000) + 500
```

The source latitude/longitude and projection transform are provenance only.
Authoritative slice movement and hashing use local integers.

### 6.2 Raster encoding

Each raster is a headerless, row-major binary file with no padding:

- elevation: little-endian signed `int32`, millimetres relative to fixture
  datum;
- obstacles and geofence: one byte per cell, `0` false and `1` true;
- known mask: one byte per cell, `0` unknown and `1` known;
- uncertainty: little-endian unsigned `uint32`, millimetres at 95% bound.

Each layer declares one scope: `truth`, `public`, `asset-initial`, or
`mission-initial`. The fixture manifest gives byte length and SHA-256 for every
layer. Loaders reject a wrong byte count, hash, value domain, scope/name pair,
duplicate layer, or grid shape.

### 6.3 Truth and beliefs

The simulator owns frozen truth. The endpoint receives only the four
`asset-initial` belief rasters plus observations produced by its sensor adapter.
Mission control receives only the four `mission-initial` belief rasters, the
public geofence, and delivered observation messages. Its loader refuses any
`truth`-scoped path before opening the file; a compile-time import test and a
runtime refusal test enforce that boundary. Neither belief store has an API that
accepts a truth object.

For either initial belief, elevation equals truth elevation on known cells and
is zero on unknown cells; initial obstacle is truth obstacle except that any
hazard flagged unknown to that observer is false; uncertainty is zero on known
cells and the manifest value on unknown cells. `uncertainty_mm` is recorded and
displayable but does not alter v0 planning cost. Slump and rock hazards are
authored overlays in truth obstacles, not changes to source terrain elevation.

An observation's `footprint_cells` is the complete sensed region for that
sample. A belief patch may mention only cells in that footprint. The acceptance
test's total sensed region is the union of footprints from observations whose
sensor model reports `truth_contact=true`; planner look-ahead and route searches
do not count as sensing.

The parent executable has a privileged orchestration shell and an unprivileged
mission controller. The shell may read the complete scenario solely to validate,
archive, and initialize the simulator; it never passes that object to the
controller, gatekeeper, or scripted actor. Those receive public policy, asset
identity, public geofence, their initial belief and initially-known target
entities, plus delivered messages. The endpoint composition root similarly
passes all hidden hazard cells and truth entity mappings only to its simulator
adapter; autonomy receives an observer-scoped catalog and observations. Explicit
projection functions and runtime tests cover scenario metadata as well as raster
paths. Mutating hidden scenario cells must not alter either controller's inputs.

### 6.4 Sensor geometry and visibility

- The local sweep runs once on entry to `planning` and again on entry to
  `safe-hold`. Its footprint contains cells whose squared row/column distance
  from the rover cell is at most 400, clipped to the grid.
- During each `executing` tick, the obstacle sensor checks planned path cells
  whose remaining along-path distance begins at 1 mm and is at most 3,000 mm.
  Its footprint is exactly those cells. Distance to contact is the remaining
  integer path distance to the entry boundary of the first truth-obstacle cell.
- Line of sight and advisory expansion use this exact all-octant Bresenham
  sequence, with `x=column` and `y=row`: set `dx=abs(x1-x0)`, `sx=1 if x0<x1
  else -1`, `dy=-abs(y1-y0)`, `sy=1 if y0<y1 else -1`, and `err=dx+dy`; emit the
  current cell; stop after emitting the destination; otherwise set `e2=2*err`,
  then if `e2>=dy` set `err+=dy,x0+=sx`, and if `e2<=dx` set
  `err+=dx,y0+=sy`. Both conditions use the same saved `e2`. The endpoints do
  not occlude; any intermediate cell believed to be an obstacle occludes.
  Elevation occlusion is deferred. For line of sight, the observer is `(x0,y0)`
  and the target is `(x1,y1)`; advisory segments run from each earlier waypoint
  to the next.
- A standoff observation succeeds at a range of at most 20,000 mm when the
  target cell is known and has line of sight under that rule.

### 6.5 Two fixture tracks

`synthetic-v0` is generated from integer formulas in the repository, contains
the authored slump and runtime rock, and is required for continuous tests.

`candor-sw-v0` derives from HiRISE stereo DTM product
`DTEEC_001918_1735_001984_1735_U01` (centre approximately 6.46 degrees south,
283.0 degrees east, source scale 1.01 m/pixel). Its source `.IMG` is converted
once, a valid 256 by 256 window is selected, and each source pixel is treated as
one 1,000 mm slice cell by the declared `nearest-pixel-1to1` prototype
convention. The resulting approximately one-percent local scale distortion is
accepted only for `slice-v0`. PC8 corrects the precision of the catalog value:
the downloaded PDS
label gives 1.0115995086777 m/pixel. Preparation metadata preserves that exact
scale; the materialized manifest rounds it to 1,012 mm. The prototype maps it
to 1,000 mm without resampling (about 1.15 percent shorter horizontal distances).
Elevations are rounded to millimetres and source/crop/tool hashes are
recorded. GDAL installation and the 274 MB source download are explicit
data-preparation prerequisites, not runtime dependencies. The first
materialization pull request freezes the crop offsets; until then, runtime work
uses `synthetic-v0` and must not invent those offsets.

## 7. Directive and gatekeeper behavior

The scenario supplies one already-confirmed structured directive. Free-text
interpretation is outside the slice. The directive goal is to characterize a
hydrated-mineral candidate from a safe standoff while remaining outside the
named no-go zone and above the energy reserve.

The gatekeeper rule `pp.no-go.slice-v0` rejects when a target cell, advisory
route cell, or operating-envelope cell intersects the scenario's no-go mask.
It returns accepted or rejected plus the rule id and evidence cells. It never
returns an alternative. The endpoint independently treats that same mask as a
hard planning constraint; this defense in depth does not move law into the
contestation subsystem.

An advisory route is an ordered waypoint list. Gatekeeper and preflight checks
expand each adjacent pair with the exact all-octant Bresenham rule in Section
6.4, including both endpoints.

Every linked revision, including an accepted alternative, repeats schema,
authority, budget, and gatekeeper evaluation before transmission. An accepted
alternative is not itself a clearance. Alternative generation excludes every
no-go cell.

### 7.1 Accepted revision transformation

The complete contestation embeds `alternatives` in Tier 1. Its `alternative_ids`
must exactly equal the embedded ids in order, without duplicates. Each alternative
must reference this contestation, goal, and hazard. Levels 0 and 3 contain none;
Level 2 contains one or two, ordered vantage then target. The scripted actor's
ten-tick response starts only when this complete message is delivered.

Acceptance is a local record event, not a second command in this scenario. The
cleared revision carries `accepted_alternative` (the exact acceptance object),
increments revision, links the immediately preceding directive, and gets a new
generated directive id. Preserve campaign, asset, author, goal, envelope,
substitution permissions, budget ceilings, earliest start, deadline and safe idle.
Remove source_text, which described the original, and replace advisory_route with
the proposed route if present (otherwise remove it). For vantage, preserve target
and set `observation_cell` to proposed_cell. For target substitution, replace
target with proposed_entity_id and set observation_cell to proposed_cell.
The endpoint checks the link against its stored offered alternative and replans
to observation_cell; it still gathers science about target. Neither acceptance
nor an advisory route authorizes bypassing local planning. Gatekeeper checks
observation_cell too. For accepted revisions, preflight tests reachability of
observation_cell rather than requiring a path onto the science target cell.
A standalone acceptance wire message is invalid in v0; the acceptance payload
schema is used by the local record and the linked revision only.

## 8. Asset-side planning and policy

### 8.1 Motion and energy

The rover plans over eight-connected cells. Cardinal edge cost is 1,000;
diagonal cost is 1,414. The octile heuristic is
`1000 * max(dx,dy) + 414 * min(dx,dy)`. Open nodes sort by lowest total `f`,
then highest incurred `g`, then row ascending, then column ascending. Neighbour generation order is
north, northeast, east, southeast, south, southwest, west, northwest. A
diagonal is forbidden when either adjacent orthogonal cell is blocked; the
planner does not cut corners.

Per-edge energy is `ceil(edge_cost / 10)` plus
`ceil(max(0, delta_elevation_mm) / 10)`. A plan is invalid if its estimated
completion leaves less than 20% of starting energy. If either endpoint is
unknown in asset belief, the edge skips slope and climb-energy calculation and
adds 5,000 route cost; it remains traversable unless another rule blocks it.

Slope grade is `abs(delta_elevation_mm) * 1000 / horizontal_mm`, rounded up:

- `0..250`: nominal;
- `251..350`: caution; add 3,000 route cost;
- above `350`: blocked for ordinary planning.

These are game-policy thresholds, not claims about a physical rover and not a
resolution of program Q18. Their policy id is `terrain.slice-v0`.

Authoritative pose during an edge is `{from_cell,to_cell,progress_mm}`.
`progress_mm` increases by `min(100, edge_length_mm-progress_mm)` per executing
tick. Cell occupancy changes only when progress reaches 1,000 or 1,414. No
fractional east/north diagonal coordinate is computed and unused progress does
not carry to the next edge.

### 8.1.1 Budget lifecycle

Counters belong to the original directive lineage and never reset on revision,
hold or replan. The parent fixes submitted_tick when recording the original
directive; the endpoint derives it from that directive's original sent_tick.
Later revisions must preserve the original budget/deadline and cannot arrive
before the original. V0 safe_idle is hold-position only; return-to-start requires
a separately specified recovery planner and is rejected by the v0 schema.

| Counter | Debit and enforcement |
|---|---|
| duration_ticks | Current tick minus original submitted_tick, including transit and holds; fail at submitted_tick+limit before work, just like deadline. |
| traverse_mm | Actual positive edge progress, checked before each step; abandoned progress remains charged. |
| energy_units | Full edge energy before first positive progress, including abandoned edges; no idle/sensor energy in v0. |
| tier2_bytes | Entire canonical payload bytes of observation and science-artifact intents, reserved before emission; summaries and Tier-1 audit are exempt. |

All prospective debits must leave cumulative usage at or below their ceiling;
energy must also leave at least the starting reserve. Deadline/duration checks
precede sensing; other checks precede the operation they charge. Reaching a
non-time ceiling is allowed; attempting to exceed it fails without performing
that operation. Failure holds position and emits an exempt Tier-1 state event
with reason `budget:<counter>` and pre-debit usage. Mandatory final evidence that
cannot be enqueued cannot complete the directive. Optional science is omitted
before attempting a debit; the v0 final artifact and full observation are mandatory.
Reserve exhaustion after a new hazard follows the alternatives/lock policy;
explicit directive-ceiling exhaustion is `failed`, not Level 3.

Planning enforces the operating envelope, remaining traverse/energy ceilings,
reserve and time limits for candidate routes. Alternative budget_delta is
candidate estimated usage minus the original advisory route's estimated usage
(expanded as in Section 7, using the same costs even on hazard cells); if no
advisory route exists use the Bresenham cell sequence from current cell to target,
ignoring blocks for this comparison baseline only. Duration is
sum of ceil(edge length/100); Tier-2 delta is zero in v0 because both alternatives
request the same evidence. These are estimates, never a budget grant.

### 8.2 Preflight alternatives

The initial asset sweep reveals the authored slump on the advisory route.
`slice-v0` maps slump to `significant`. Preflight treats the submitted approach
as invalid when an expanded advisory route intersects a significant believed
hazard. When no advisory route exists, the submitted approach is invalid when
no safe path to the requested target exists. An invalid approach becomes Level
2 when at least one permitted, safe, goal-preserving alternative exists and
Level 3 when none exists. A Level-2 case generates up to two structured
alternatives:

1. `substitute-vantage`: reachable cells 10-20 metres from the original target
   with line of sight; the annulus is squared cell-centre distance `100..400` in
   cell units; minimize route cost plus octile target distance, then row and
   column ascending;
2. `substitute-target`: a reachable entity with the same `science_class` within
   250,000 mm of octile path distance from the requested target; minimize route
   cost, then entity id ascending. Its `proposed_cell` is the entity's known
   cell; synthetic-v0 therefore proposes `{row:185,column:95}`.

Candidate paths and cells must avoid the public no-go mask and all
asset-believed blocked cells. If either candidate set is empty, the alternative remains absent and the
contestation records why. The authored v0 scenario must make both non-empty.
Under the frozen synthetic fixture and planner, the selected vantage is
`{row:180,column:70}` and its route passes through the still-hidden rock at
`{row:205,column:45}`; these are golden assertions, not values the implementation
may tune to make a test pass.
Human-readable summaries are deterministic templates over structured fields:

```text
Vantage {cell}: preserves {goal_id}; avoids {hazard_id}; +{energy_delta} energy.
Target {entity_id}: same class {science_class}; avoids {hazard_id}; route {distance_mm} mm.
```

There is no language-model call. At exactly ten ticks after the complete
contestation message is delivered, the scripted mission-control actor accepts
the `substitute-vantage` alternative. It creates a linked directive revision,
re-runs the gatekeeper, and enqueues the cleared revision on Tier 1. The endpoint
remains holding until that revision crosses the delayed channel. Both the delay
and selected kind are versioned in `scenario.scripted_mission_control`.

Synthetic detections are certain: the slump contestation uses hazard class
`terrain` and `confidence_ppm=1000000`; the rock reflex uses hazard class
`obstacle` and `confidence_ppm=1000000`. A footprint hash is SHA-256 over the
canonical array of footprint cells sorted by row then column ascending. When a
summary sees more than sixteen hazard cells, it includes the first sixteen in
that same order; the full observation retains the complete footprint and patch.

### 8.3 Negotiation window and runtime reflex

For `slice-v0`, the window is open exactly when `4 * L <= T`. Stationary
preflight hazards use `T = null`, meaning unbounded time and an open window.

During motion, the runtime rock sensor reports remaining along-path distance to
the entry boundary of the first obstacle cell. For a path of cell centres, that
boundary is `floor(final_edge_length_mm / 2)` before the obstacle centre: 500 mm
on a cardinal edge and 707 mm on a diagonal. With current speed `v` in
millimetres per tick, reaction time `r=1` tick, and braking decrement `a=25`
millimetres per tick per tick:

```text
stopping_distance_mm = (v * r) + ceil(v * v / (2 * a))
T = max(0, floor((distance_mm - stopping_distance_mm) / max(v, 1)))
```

The scenario rover moves at `v=100` mm/tick and the obstacle sensor range is
3,000 mm. Since `T` is far below `L=6000`, the window is shut. The endpoint
performs a Level-0 stop before contact, records all formula inputs, creates an
observation and asset-belief patch, then resumes only after a safe local replan.
Detection suppresses motion on that tick. If detection occurs mid-edge, the
replan begins at `from_cell`, resets progress to zero, retains all energy already
debited for entering the abandoned edge, and retains the abandoned progress in
the traverse budget. Edge energy is debited in full on its first positive
progress; traverse is debited by actual progress each tick. The reflex path must
not call the classifier stub.

The classifier seam runs once after the rover is safely stopped. Its input is
`{observation_id,sensor_id,artifact_hash}`. Its pinned output is
`{model_id,label,confidence_ppm}`, where label is `rock`, `not-rock`, or
`indeterminate`. Synthetic-v0 pins `{model_id:"model:stub-rock-v0",
label:"rock",confidence_ppm:900000}`. The exact canonical input hash and output are in the run
manifest; replay injects that response without invoking external code. The
result demonstrates a nondeterministic seam but satisfies no directive success
criterion and never participates in the reflex.

The final standoff observation contains integer measurements
`target_range_mm`, `line_of_sight`, and `spectral_class`, with the synthetic-v0
instrument returning `hydrated-mineral-candidate`. Its canonical
measurement array is the Tier-2 artifact bytes. `standoff-image` is satisfied by
range at most 20,000 mm plus line of sight; `spectral-characterization` by a
non-`indeterminate` spectral class; `position-safe` by no occupied/no-go cell;
and `energy-reserve-met` by at least 20% of starting energy. Completion requires
every success-evidence item named in the directive.

## 9. Endpoint finite-state machine

The endpoint starts `idle`. Unlisted event/state pairs are errors and cannot
silently leave state unchanged.

The executable slice supports Levels 0, 2, and 3; Level 1 is deliberately
absent. A detected runtime hazard with a shut window is Level 0. A plan-time or
open-window hazard is Level 2 when the submitted approach defined in Section
8.2 is invalid and at
least one permitted, safe, goal-preserving alternative exists. It is Level 3
when terrain, energy reserve, or asset-envelope policy makes the goal unsafe and
both permitted candidate sets are empty. Planetary-protection violations remain
gatekeeper rejections and never become Level 3. The golden integration scenario
exercises Levels 0 and 2; a component fixture exercises Level 3.

| From | Event and guard | To | Required output |
|---|---|---|---|
| idle | cleared directive delivered | planning | directive-received event |
| planning | safe original plan | scheduled | plan summary |
| planning | significant hazard and alternatives | holding | Level-2 contestation |
| planning | critical hazard | locked | Level-3 contestation |
| holding | accepted linked revision delivered | planning | resolution link |
| holding | revised directive delivered | planning | supersession link |
| scheduled | start tick reached | executing | execution-started |
| executing | reflex hazard, window shut | safe-hold | Level-0 event before motion |
| safe-hold | safe local replan exists | executing | recovery plan link |
| safe-hold | no safe local replan, permitted safe alternative exists | holding | Level-2 contestation with `T=null` |
| safe-hold | no safe local replan and no permitted safe alternative | locked | Level-3 contestation with no alternatives |
| executing | significant hazard, window open | holding | Level-2 contestation |
| executing | critical hazard | locked | Level-3 contestation |
| executing | success evidence complete | completed | completion summary |
| any nonterminal | deadline/duration limit reached before success, or next debit exceeds budget | failed | hold-position and state event with budget snapshot |
| any nonterminal | invariant or protocol failure | faulted | fault event |

At a tick boundary, deadline and duration are checked before sensor or motion
work; a success completed on the preceding tick wins, otherwise the time limit
fails. `locked`,
`completed`, `failed`, and `faulted` are terminal in the casual slice. Level-3
release requires a future Institute-supervised campaign authority and is not
represented by a Studio-side command.

A safe plan uses `planned_start_tick = max(current_tick + 1,
directive.earliest_start_tick)`. This removes same-tick ambiguity between plan
creation and execution.

## 10. Record boundary

The slice has one local Tier-1 chain for the accountable campaign and a separate
NDJSON telemetry file. Tier-1 event types are limited to:

- directive submitted, gatekeeper evaluated, directive transmitted/received;
- plan proposed, contestation opened, alternative accepted, directive revised;
- endpoint state changed for every transition in Section 9;
- observation summarized and received-belief updated;
- classifier result consumed;
- run started, checkpointed, completed, or failed.

| Event type | Required payload kind |
|---|---|
| run-started | run-manifest |
| directive-submitted, directive-received, directive-revised | directive |
| gatekeeper-evaluated | gatekeeper-result |
| directive-transmitted | channel-message |
| plan-proposed | plan-summary |
| contestation-opened | contestation |
| alternative-accepted | alternative-acceptance |
| endpoint-state-changed | state-transition |
| observation-summarized | observation-summary |
| received-belief-updated | belief-update-summary |
| classifier-result-consumed | classifier-result |
| checkpoint-created | checkpoint |
| run-completed | run-summary |
| endpoint-fault, run-failed | fault |

The record stores payloads inline for this slice. Science bytes are immutable
artifacts referenced by hash and counted against Tier 2. Casual-play telemetry
is not promoted into the operational record; this scenario is explicitly an
accountable qualification-style run so its decision chain is recorded.

Every record event distinguishes:

- `occurred_tick`: when the source process says the event happened;
- `received_tick`: when it crossed into the recording process, null for a local
  mission-control event;
- `recorded_tick`: when mission control appended it, equal to `received_tick`
  for a delivered endpoint event in v0 and equal to `occurred_tick` locally.

Checkpoint `state_hash` is SHA-256 over canonical JSON containing current tick,
FSM state, current directive id/hash, `{from_cell,to_cell,progress_mm}`, energy,
remaining plan, hashes of all asset-belief rasters, per-kind creation ordinals,
PRNG state/draw indices, original submitted tick, cumulative budget counters,
accepted-alternative linkage and stored offered alternatives. It excludes
diagnostics, wall time, process ids,
file paths, and record-chain hash.

### 10.1 Closure and replay identity

Endpoint terminal state freezes all budget counters at the terminal tick and
stops sensing, movement and new science generation;
subsequent advances only acknowledge ticks and consume in-flight commands as
telemetry `ignored-terminal`. The parent learns terminal state through the
delivered Tier-1 state event, disables future scripted commands, then drains
both links, applying all delivered evidence. It requests a final checkpoint
after both queues are empty and the current done has arrived, at that tick.
Append run-completed only for endpoint completed plus verified mandatory delivered
evidence. Its event_chain_head equals the closure event's prev_event_hash; the
closure event's own hash is the final bundle head. Failed/locked/faulted outcomes
append run-failed with a stable reason, never run-completed. An abnormal child
exit, timeout, malformed frame, missing artifact or truncated log is incomplete;
run-failed records safe_state=not-applicable if no endpoint acknowledgement exists.
Do not fabricate a final state hash for an unavailable endpoint. A clean EOF
without a valid closure event is incomplete even if every preceding hash verifies.

On-disk append uses one writer and flush-before-acknowledgement. A partial final
line after interruption is retained as evidence and rejected; v0 replays from
the start and does not resume or silently repair that archive.

Cross-platform replay uses the original immutable manifest, including its original
build platform fields. Record actual replay host/toolchain in a separate validation
report, outside the chain. A newly authored run on another host is a compatibility
comparison, not a claim that different provenance hashes match.

## 11. Test matrix and definition of done

### 11.1 Contract tests

- every example validates against exactly one schema version;
- unknown properties, fractions, unsafe integers, malformed hashes, and bad
  enums fail;
- canonicalization fixtures are byte-identical on Windows and one second OS;
- every record mutation breaks verification at the first changed sequence.

### 11.2 Component tests

- A* golden routes cover ties, diagonal movement, unknown penalty, slope,
  geofence, and reserve exhaustion;
- channel golden tests cover latency, serialization delay, queue priority, and
  same-tick ordering;
- every listed state transition has a positive test and every unlisted pair a
  rejection test;
- observation patches outside their footprint are rejected;
- alternatives are stable under repeated generation and input reordering.

### 11.3 End-to-end acceptance

One command runs the parent-design Section 14 scenario and must prove:

1. two fresh runs produce byte-identical Tier-1 chains and final state hashes;
2. changing only truth-scoped cells outside the accumulated sensed region,
   while leaving generated initial-belief layers unchanged, leaves the
   no-leak projection byte-identical through the last delivery before that
   region is sensed; the projection is canonical JSON of asset-to-mission
   payload kind/timing/payload plus received-belief state, excluding run,
   fixture, scenario, source, artifact, and chain provenance hashes that are
   expected to identify different inputs;
3. the PP rejection path contains no contestation and the hazard path contains
   no gatekeeper decision masquerading as an alternative;
4. the original directive remains in the chain beside the linked accepted
   revision;
5. the endpoint belief changes at observation tick and mission-control belief
   changes only at message delivery tick;
6. changing latency or Tier-2 capacity changes delivery timing but not hidden
   access;
7. the audit reader explains both the Level-2 hold and Level-0 reflex from
   structured evidence;
8. replacing the simulator adapter with a fake endpoint preserves mission
   control schemas;
9. process exit, malformed frames, and timeouts lead to a recorded fault/safe
   state rather than implicit success;
10. a second platform either matches exactly or fails the compatibility test;
    v0 declares no numeric tolerance because authoritative arithmetic is integer.

The slice is done only when all tests run in a clean checkout from one documented
command, the real-data-derived fixture passes the same loader tests, and an
audit bundle contains manifest, schemas, event chain, telemetry, referenced
artifacts, build identity, and final verification report.

## 12. Work-package order and review gates

1. **Scaffold:** toolchain pins, workspace graph, lint/type/test commands.
2. **Contracts:** copy the v0 schemas from `design/contracts/v0` into the
   implementation package without semantic edits; add golden examples.
3. **Deterministic substrate:** canonical JSON, hash chain, ids, integer helpers,
   PRNG, synthetic fixture.
4. **Channel and record:** complete their golden tests before autonomy exists.
5. **World and beliefs:** enforce truth/belief type separation and leak tests.
6. **Endpoint:** state machine, planner, policy, observations, alternatives.
7. **Integration:** separate child process, full delayed negotiation, replay.
8. **Terrain ingest:** install GDAL, materialize and review `candor-sw-v0`.
9. **Human check:** facilitated alternative-understanding test.

The human check presents the Tier-1 contestation and observation summary before
the Tier-2 full sweep arrives. If that bounded summary is insufficient for a
participant to understand the hazard and choose, the test fails; the client may
not reveal Tier-2 or hidden truth to rescue it.

An agent may start packages 2-6 after package 1, but no integration merge may
waive a contract or truth-leak test. Renderer and UI work begin only after the
headless chain is deterministic.

## 13. Deliberately deferred decisions

- engine and graphics stack;
- production service topology and database;
- formal Q18 thresholds and confidence calibration;
- stochastic campaign-rehearsal sampling and aggregation;
- physical-rover mobility limits;
- signed identity, hardware attestation, and archive mirroring transport;
- real perception model and model-update policy;
- Level-1 auto-substitution, appeals, signed clearance, and Level-3 release;
- public/proprietary disclosure durations from PQ11;
- exact HiRISE crop offsets, frozen by the reviewed ingest artifact.

Deferral is not permission for an implementation agent to choose these. Code
must expose a versioned seam or omit the capability.
