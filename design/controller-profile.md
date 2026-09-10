# Endpoint controller profile

Issue #7 adds the v0 endpoint controller, its state machine, contestations,
linked revisions, reflex recovery, recorded classifier consumption and mandatory
onboard science checks. The real endpoint executable selects this profile for
`scenario-v0` initialization. The fake transport profile remains available for
the original fault-injection and transport regression suite.

Run `npm run controller -- artifacts/my-controller-run` to start the actual
endpoint child process with the synthetic fixture and frozen classifier record.
The directory must be new. It contains canonical initialization inputs, the
materialized fixture, endpoint intent trace and a controller report. The script
uses the channel and a mission-observer actor to accept the delivered alternative
after the configured delay, repeating gatekeeper evaluation before transmission.

This is controller evidence, not a campaign archive: it stops after receiving a
terminal Tier-1 notification and requesting an endpoint checkpoint. It does not
drain both links, prove that mandatory science arrived, write a hash-chained
record, or verify closure/replay custody. The received-belief hash is explicitly
at terminal notification. Those acceptance gates remain issue #8.
The separate [campaign command](campaign-profile.md), added by issue #8, now
drains and verifies the complete archive; this shorter controller command
retains its original boundary.

## Authority and observer boundaries

The privileged executable shell validates fixture/scenario hashes and IDs and
supported versions, reads the canonical materialized manifest, constructs the
simulator and projects asset-visible configuration. The controller receives
only its belief, visible catalog, sensor port, seed, directive identity, latency
and recorded classifier port. It has no filesystem, world object, full scenario,
channel queue or external model provider. The evidence actor uses mission belief
and the mission projection, never endpoint belief or hidden scenario metadata.

The shared gatekeeper examines the target, observation cell, every expanded
advisory cell and every operating-envelope cell against public geofence. Rejection
has no alternatives. Receiving a supposedly cleared directive that fails local
validation is a controller fault, not a terrain contestation.

Accepted revisions must exactly match the retained offer's transformation,
including actor/time/contestation/alternative links. Vantage acceptance preserves
the science target and changes the observation cell. The source text is removed;
budget, goal, author, envelope and lineage fields remain bound. Every revision
is checked by gatekeeper and the lineage ledger before it changes controller
state. Signing and external identity services are not present in this slice.

## State, ordering and failure rules

The pure transition table covers all ten states and twelve semantic events;
unlisted pairs fail. The controller determines their actual guards from planning,
observations, authority and budgets. Level 2 embeds offers; Level 3 has none and
has no Studio release. Empty offers produce `no-safe-permitted-alternative` in
the linked transition. Controller checkpoints include outstanding offers,
classifier state, received message IDs, counters, pose, belief/catalog state,
directive linkage, plan and pinned PRNG state with zero draws.

Time limits are checked before sensing and before processing delivered commands
when a lineage exists. At a time-limit boundary, failure takes precedence even
over an invalid pending command. The first directive's submitted tick comes from
its original sent tick. A route that is safe under terrain/reserve constraints
but impossible under directive ceilings fails as a budget refusal rather than
becoming a Level-3 policy lock.

Reflex detection emits Level 0 and enters safe-hold before any motion or
classifier consumption. The detection tick performs no body step. It abandons
the current edge, retaining full entry energy and actual traverse, then sweeps
on safe-hold entry. Classification occurs on the following safe-hold tick and
does not alter hazard belief or the reflex decision. Recovery plans from the
occupied cell and starts moving no earlier than the next tick.

Terminal failures freeze the exact stopped pose and budget counters. An
open-window runtime hold also retains its stopped pose while waiting. On a valid
revision, grid replanning abandons that held edge from its occupied from_cell
without refunding debits. Late commands in a terminal state generate only
`ignored-terminal` status telemetry; they cannot restart the controller.

## Sensors, classifier and science

Samples validate their complete hazard metadata and contact footprint before
belief updates. Summary footprints and first-sixteen hazard cells are sorted
row then column regardless of adapter array order. Full observations retain
their own canonical content and cross Tier 2 before mission belief changes.

The synthetic standoff adapter samples the full Bresenham sightline. It reports
integer millimetre range rounded upward using integer square root, line of sight
and the truth target's spectral class. Its footprint covers all sampled cells;
it emits no invented elevation patch. Final evidence must be a standoff
observation with unique, correctly typed/unit-labelled measurements. Position
safety is checked after applying final patches. All named success criteria must
pass, and both mandatory full observation and science artifact must be reserved
and emitted before the controller can complete.

The classifier input binds the runtime detection observation ID, sensor ID and
hash of the full detection observation. The frozen qualification record lives in
`fixtures/controller-v0/model-results.json`; its exact input/output binding is
checked without fallback or regeneration. A test-only preparation probe was used
to create this record; the executable runtime consumes recorded results only.
Mismatch faults after stopping. Classifier output satisfies no science criterion.

## Evidence limits

Tests cover the complete transition matrix, actual closed/open-window paths,
valid and forged acceptance, no-release locks, budget versus policy failure,
terminal pose preservation, malformed samples, mandatory evidence refusal and
recorded-seam ordering. The real child process matches direct-controller output
and checkpoint. Full synthetic runs preserve the frozen vantage and rock path,
repeat deterministically and ignore independent unsensed truth/metadata changes.
CI compares controller initialization, intent trace and report across Windows
and Linux alongside existing spine and planner evidence. No physical-rover or
full campaign-acceptance claim follows from these component checks.
