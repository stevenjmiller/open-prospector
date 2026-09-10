# First executable spine: fake-evidence-spine-v0

Date: 2026-09-09. Implements GitHub issues 1-4 as a transport and audit milestone,
not the full headless science scenario. Parent: vertical-slice-implementation-brief.md.

## Scope and explicit seam

The fake endpoint uses actual canonical JSON, schemas, process framing, parent
clock, tiered channel, durable record and archive verifier. Its directive asks
for the known `synthetic-transport-marker` from a separately identified public
fixture. The endpoint returns stipulated measurements, a full observation and
base64 artifact through Tier 2. Completion requires those exact bytes and the
linked acknowledgement to reach mission control. No terrain is loaded and
`truth_contact` is false. A pass proves transport, ordering and audit behavior;
it proves no scientific inference, planner, belief fusion or hardware safety.

The existing `scenario-v0` requires two targets and two hazards. The new
`spine-scenario-v0` is an explicit alternative only in IPC init, paired with
`versions.body`, `versions.sensor` and `versions.autonomy` set to
`fake-evidence-spine-v0`. It does not relax the full scenario. The fake driver
rejects other body profiles. Full autonomy and terrain remain issues 5-8.

The scripted state trace (idle → planning → scheduled → executing → completed)
is test behavior, not the production controller. The fake checkpoint hashes
implementation id, current tick, state, terminal tick, directive id/hash, endpoint
event ordinal and received message ids. Its counters/poses are not a claim to
implement the Section 10 real endpoint checkpoint. Budget enforcement, PRNG draws,
local planning and gatekeeper geometry remain their named downstream work. The
fake fixture's gatekeeper checks its single public target against its empty
public mask; it is not the general envelope/route gatekeeper implementation.

## Strengthened archive binding

Observation summaries contain an EvidenceRef for the canonical full observation
in addition to the science artifact reference. That gives Tier 1 a hash binding
without exposing Tier-2 content. Bundle verification checks the full hash and
length, observation context, receipt event and science bytes. A mutable external
observation file cannot be substituted under a stable observation id.

Local event identifiers use the mission-event counter, independently of endpoint
and message-event entries. All terminal outcomes drain pending messages; only a
verified completed outcome gets run-completed. Failure has no invented checkpoint
or physical safe-state acknowledgement. An interrupted tick cannot commit its
buffered endpoint intents.

## Build and replay

The build identity contains normalized UTF-8/LF source texts, including schemas,
fixture files, lockfile and build scripts. `source_revision` is their canonical
SHA-256, not a Git revision. `source_dirty=false` means this exact content snapshot
is identified; it makes no assertion about the Git worktree. The portable build
profile is Node 24.12.0/npm 11.6.2, JavaScript architecture. Actual execution host
and Node version are outside the chain in verification.json.

Replay accepts only an identical current build identity and reuses the archived
manifest unchanged. The archive includes the source snapshot and dependency
lock, not an embedded Node distribution or installed dependencies. Reconstructing
an old build requires restoring those files and installing the pinned toolchain;
full offline executable escrow is a later acceptance deliverable. Never silently
run changed code under an old manifest. The archive verifier checks schema and
lock bytes against the source snapshot before claiming success.

## Operational limits and tests

Wire frames have a 4 MiB bound and at most 256 outbound intents per tick. These
are fake-spine resource limits, not permanent protocol limits. Raw framing checks
UTF-8 and LF before parsing, without newline/BOM normalization. The production
watchdog is 30 seconds; tests use an explicit override for failure injection.
Fault selection is a fake executable argument, not a production wire command.

Tests cover canonical ambiguities, independently frozen identifier/wire answers,
FIFO and byte boundaries, sequence/hash/closure corruption, observation/provenance
tampering, real child failures, partial transactions, shutdown ticks and exact
fresh-process replay. CI executes the same suite on Windows and Linux and compares
the canonical manifest, event chain and observation bytes. A workflow definition
alone is not evidence of a cross-platform pass.
