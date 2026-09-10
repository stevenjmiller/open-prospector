# Synthetic campaign archive

Issue #8 integrates the real synthetic endpoint with the delayed channel and
single-writer campaign record. `npm run campaign -- run artifacts/campaign-run`
creates a new archive; `verify`, `audit`, and `replay` operate on that archive.
The fake transport spine and the shorter controller evidence profile remain
separate commands and carry separate profile labels.

## Ownership and closure

The privileged runner archives validated fixture bytes and initializes the child.
Its mission actor uses the mission projection and mission belief only. The actor
accepts a delivered alternative after the configured delay, records that local
acceptance, preserves the original directive, records the linked revision,
rechecks the gatekeeper and transmits the revision through the channel.

Only delivered full observations update mission belief. Endpoint occurrence time
and mission receipt time remain distinct in the chain. All delivered channel
messages, including Tier 2 and ignored-terminal telemetry, are in telemetry.ndjson.
Observation and science bytes are stored under their SHA-256 digest. Tier-1
summaries bind observations and contestations refer to their supporting evidence.
The archive contains every fixture layer, immutable initialization inputs,
schemas, source snapshot/build identity, dependency lock and validation report.

On learning an endpoint terminal state the actor stops issuing commands. The
runner continues advancing until both links are empty, requests a checkpoint,
verifies mandatory delivered evidence and only then appends run-completed.
Failure never implies success; an unavailable endpoint supplies no invented
checkpoint or safe-state acknowledgement. A missing closure is incomplete.

## Independent audit and replay

The audit reader imports no autonomy or simulator implementation. It validates
the chain, archived provenance and rasters, reconstructs channel serialization
and delivery ordering, checks directive/acceptance/evidence links and reconstructs
mission belief from deliveries. It checks cumulative budget accounting and the
structured evidence explaining the Level-2 hold and Level-0 reflex.
The audit checks cumulative counters and exact Tier-2 bytes; it does not rerun
kinematics or decode the checkpoint hash. Executable replay supplies the separate
check of endpoint-state reproduction.

Replay preserves the original manifest and uses its archived fixture bytes. A
source-identity mismatch fails rather than silently using different software.
Actual host details live in verification.json outside the authoritative chain.
The portable build profile permits fresh Windows/Linux exact-byte comparisons;
CI also replays the archived run from the other platform. No numeric tolerance
is allowed. This profile introduces no random draws: the declared PRNG seed is
unchanged and the draw count remains zero. Known-answer PRNG qualification is
required before introducing draws.

The archive is inspectable evidence, not cryptographic attestation: an actor who
rewrites all bytes and hashes can manufacture a new archive. Replay provides an
additional executable check. No signing or physical rover claims are made.

## Human review

Follow [the human testing tutorial](human-testing.md) to run, inspect and replay
the scenario and deliberately test a damaged copy. That walkthrough does not
claim the facilitated participant-understanding gate in issue #10. Terrain
ingestion remains issue #9. Full slice acceptance still requires those gates.
