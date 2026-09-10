# Open Prospector — Program Design

Crowd-directed, AI-executed planetary exploration: university teams and qualified
members of the public direct a multi-modal fleet of exploration drones — issuing
*directives*, not joystick commands — with every result, and every disagreement
between human and machine, on the public record. The program matures along a
four-rung ladder (consumer simulation → Earth analog fleet → lunar fleet under
artificial Mars latency → Mars seed fleet), each rung independently fundable.

**Status: private incubation.** This repo is where program-level design is
fleshed out before the program is opened to contributions. Nothing here is
published anywhere.

## Relationship to `mars-colonization`

The program was born inside the [mars-colonization](https://github.com/stevenjmiller/mars-colonization)
corpus and remains anchored to it:

- The **master outline** (`mars-colonization/outline/mars-colonization-outline.md`)
  is the source of truth for all *decided* material. The program's founding
  decisions live in its ledgers: D16 (the program), D17 (the maturation ladder),
  D42 (the latency spectrum), plus inherited D7, D11, D14, D15, D30, D41.
- The **standalone paper** (`mars-colonization/papers/open-prospector-program.md`,
  draft 0.1) holds the reviewed-and-approved contestation protocol (master Q18)
  and drone-as-role design. It is published on the program portal site and stays
  in that repo.
- **This repo** holds new program-level design work — until a piece is mature,
  at which point it is adopted back into the master (new D/Q entries, Section 12
  updates) and/or published, as an explicit act.

## Ledger discipline

Same discipline as the master — decisions, corrections, open questions;
contiguous numbering; cross-referenced; nothing erased, only corrected — with a
namespaced prefix so references stay unambiguous:

- **PD** — program decisions made in this repo
- **PC** — corrections to this repo's material
- **PQ** — this repo's open questions

Bare `D` / `C` / `Q` tokens always refer to the mars master's ledgers (the same
convention the paper uses). The ledgers live in `design/program-design.md`.

## Repo layout

- `design/program-design.md` — the living program-design document: ledgers plus
  the design sections as they are worked. Single source of truth *for this
  repo's* material.
- `design/` — supporting documents as sections outgrow the main document.

## First executable spine

The transport-only implementation uses Node **24.12.0**, npm **11.6.2**,
TypeScript **5.9.3**, and Ajv **8.20.0**. It runs a separate fake endpoint using
the actual channel and audit contracts. The runner does not yet integrate terrain,
planner, budget policy, contestations or the full science scenario.

```text
npm ci
npm run check
npm run spine
npm run verify -- artifacts/spine-run
npm run replay -- artifacts/spine-run artifacts/spine-replay
```

Output directories must be new; existing archives are never overwritten. Use
`npm run spine -- artifacts/another-run` for subsequent runs. Each bundle includes
canonical inputs, source/build identity, schemas, lockfile, event chain, delivered
observation/science bytes and a verification report. The terminal output reports
the chain head and checkpoint hash. Failed runs exit nonzero and retain evidence.

[Implementation profile](design/first-spine-profile.md) explains the fake behavior
and archive limitations. [Milestone 1](https://github.com/stevenjmiller/open-prospector/milestone/1)
tracks delivery. Issues [1](https://github.com/stevenjmiller/open-prospector/issues/1)–
[4](https://github.com/stevenjmiller/open-prospector/issues/4) establish the spine;
issues 5–10 add world/belief, planner, controller, full acceptance, terrain ingest
and a human understanding check. CI tests Windows/Linux separately and compares
authoritative output bytes before the spine's cross-platform gate passes.

Issue #5 adds synthetic terrain generation and separate asset/mission belief
components. Run `npm run fixture` to materialize all eleven frozen layers in a
new `artifacts/synthetic-v0` directory. Scoped loaders, hidden scenario projections,
and atomic observation updates are tested independently of the fake runner.
See the [runtime belief profile](design/synthetic-belief-profile.md) for boundaries
and the remaining sensor/planner integration work.

Issue #6 adds deterministic A*, structured alternatives, sensor geometry and
lineage budgets. `npm run planning` writes a component evidence report that
reproduces the frozen vantage, detects the rock before contact and finds a safe
recovery without refunding movement. See the [planning profile](design/planning-components-profile.md)
for APIs and limits; controller/clearance/science integration remains separate.

Issue #7 adds the actual v0 endpoint controller. `npm run controller` runs it as
a child process through delayed negotiation, reflex recovery and mandatory
onboard science, using a frozen recorded classifier result. See the
[controller profile](design/controller-profile.md). Its report stops at terminal
notification; full campaign record, delivered-evidence closure and replay remain
issue #8. The fake transport runner remains a separate regression fixture.

## Full synthetic campaign and human testing

Issue #8 archives the real controller's delayed negotiation, reflex recovery and
delivered science, closes the campaign record and supports exact replay:

```text
npm run campaign -- run artifacts/campaign-run
npm run campaign -- verify artifacts/campaign-run
npm run campaign -- audit artifacts/campaign-run
npm run campaign -- replay artifacts/campaign-run artifacts/campaign-replay
```

Follow the [human testing tutorial](design/human-testing.md) for a guided run,
expected transitions, budget interpretation, science inspection and a deliberate
corruption test. The [campaign profile](design/campaign-profile.md) explains the
archive and its verification limits. The facilitated human-check gate remains #10.

## Visual archive viewer

Browse your campaign runs in the local web library:

```text
npm run viewer
```

Open the printed localhost address, search the archive cards, and choose a run.
The library scans `artifacts`, including nested campaign folders. Create another
run with `npm run campaign -- run artifacts/human-run-2`, then click **Refresh runs**
to open it without restarting the server. Use a new directory name for each run.
An optional root and port select another collection: `npm run viewer -- <archive-root> 4174`.

Compare **Rover** and **Mission control** at
the same tick, follow the decision chapters, and inspect the map and science.
The server verifies the archive first. Routes are proposed plans; the archive
does not contain a continuous position trace. Use the synthetic campaign archive
from the tutorial or any other completed synthetic campaign.
See the [viewer guide](design/archive-viewer-profile.md) for timing, controls and limits.

## Reviewed Candor terrain

Issue #9 adds the approved HiRISE-derived crop and eleven scoped rasters.
Run `npm run terrain` to verify the source, preparation and layer identities and
load both observer views. No GDAL installation or download is needed for this
check. See the [crop preview and preparation instructions](fixtures/candor-sw-v0/README.md).
The existing campaign command continues to use its frozen synthetic scenario.

## Style

- Never use the section symbol (§). Write "Section 4" or "(4.5)".
- Convert relative dates to absolute dates in all ledger entries.
