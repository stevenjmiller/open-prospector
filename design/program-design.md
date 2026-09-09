# Open Prospector — Program Design (Living Document)

**Version:** v0.16
**Started:** 2026-07-28
**Scope:** program-level design — the institutional, economic, and
mission-assurance skeleton of the Open Prospector program. Software design
(the Rung-0 game, the twin, the autonomy stack) is deliberately downstream of
this document.

Decided foundations (owned by the mars master outline, cited not restated):
D16 (the program), D17 (the maturation ladder), D42 (the latency spectrum),
D7 (directive control), D11 (piece-meal economics), D14/D15 (the seed fleet's
first campaign and its customer), D30 (the negotiate-with-it taxonomy), D41
(bits-export economics). The contestation protocol and drone-as-role are
designed in the standalone paper (master Q18, ADVANCED).

---

## Decisions Log (PD)

| # | Decision | Date | Rationale |
|---|----------|------|-----------|
| PD1 | **This repo exists as the program's private design incubator.** Program-level design is worked here under PD/PC/PQ ledgers; the mars master remains source of truth for decided material; adoption back into the master (or the paper) is an explicit act. Repo stays private until the owner opens it to contributions. | 2026-07-28 | Section 12 of the master already notes the program "outgrows the outline"; the mars repo is public and auto-publishes to the site, so work-in-progress cannot incubate there. |
| PD2 | **Rung transitions are hard gates — criteria, not dates — and a failed gate plateaus the program at its current rung; it does not kill it.** Each gate protects the *next* rung's capital, produces the evidence a funder of that rung would need to see, and names which program-killer mitigations (Section 2) it verifies. Rungs overlap in operation: a gate opens the next rung, it never closes the current one (Rung 0 in particular never decommissions — per D17 it becomes the fleet's forward-planning tool). | 2026-07-28 | Direct application of the master's D32 gate discipline to the D17 ladder. The plateau property is D11/D17's "each rung independently valuable" made operational: the ladder has no sunk-cost trap because every rung is a stable, fundable resting state. |
| PD3 | **Program mission assurance follows the D39 discipline: an enumerated killer register (Section 2), each killer de-singularized, mitigation matched to timescale.** The program's master killer is **legitimacy** — public trust that its promises (real agency, real hardware, open access, honest record) are being kept — and the public record is its primary standing defense. Two mitigations are design-time mandates that cannot be retrofitted (the D29 pattern): governance separation of powers (PK7) and the published loss budget (PK4). | 2026-07-28 | The settlement's register names power as the master killer because every other failure cascades through it; the program's failures (scandal, capture, social rejection) cascade through legitimacy the same way. Naming the design-time mandates now, before any institution is founded, is the reason to do this early. |
| PD4 | **Every gate carries two kinds of criteria: readiness criteria (what the program must demonstrate — under its control) and availability criteria (what external actors' infrastructure must provide — not under its control). Availability is verified at gate time as a purchasable service or a signed manifest, never assumed from roadmaps or announcements.** Consequences: (a) external non-availability plateaus the program exactly like an unmet readiness criterion — the D17 ladder's rung independence is the insurance policy, and Rungs 0–1 deliberately require no space infrastructure at all; (b) fleet elements are designed to the **smallest viable payload class**, so the set of possible rides is as large as possible — a fleet only one provider can deliver inherits that provider's priorities; (c) while a rung waits at a gate, its availability criteria are re-verified every synodic window, because external infrastructure can regress as well as advance. | 2026-07-28 | The master's D5 treats launch as "an interface, not our problem" — correct for design work, dangerous for gating: an interface still has to exist before you can buy it. Caught by owner review (PC1). |
| PD5 | **Two entities, and the program owns both: the Institute (nonprofit) owns every asset the program's promises depend on — protocol specification, public record, qualification standards, allocation authority, planetary-protection ruleset, and eventually the fleet; the Studio (commercial, wholly-owned subsidiary of the Institute) builds and operates the game.** Four constitutional commitments bind both charters: (1) money flows one way — Studio profits fund the Institute on fixed terms, and no Institute decision is ever conditioned on Studio performance; (2) funders receive reports, never allocation votes; (3) the public record is continuously mirrored to independent archives so it survives even the Institute's failure; (4) the gatekeeper's rules and code are public. The Studio implements qualification measurement in-game; the criteria are Institute-owned; the Studio holds no allocation vote, ever. | 2026-07-28 | Two entities because a single entity's board can amend its own charter — the capture path PK7 blocks must be closed structurally. Wholly owned rather than licensed (owner decision): an external studio's commercial priorities would compete with the interface discipline the game exists to teach — outsourcing the program's revenue engine and training instrument is a real risk, not a hedge. D41's funded-not-profitable logic applies to the science side. |
| PD6 | **The campaign authority is an office of the Institute — a professional operations directorate — with a named individual assigned per campaign, whose override signatures appear on the public record as the paper requires.** The office answers to the Institute board; the individuals answer by name to the public record. | 2026-07-28 | The paper's separation of powers (contestation is the democratic layer, override the constitutional layer) needs a named institution behind it. Lineage: observatory director, flight director. |
| PD7 | **The Institute incorporates in the United States.** Under the Outer Space Treaty the launching state keeps jurisdiction and liability, so incorporation determines which government answers for the fleet and whose export rules bind the autonomy stack. | 2026-07-28 | Owner decision: export-regime politics can shift in any jurisdiction, so jurisdiction-shopping buys little protection — while the US offers the deepest funding pool and direct adjacency to commercial lunar delivery. Revisit only if the export regime becomes a demonstrated blocker to the openness promise (PK8, PQ10). |
| PD8 | **Allocation prices state, not time. A campaign award is a budget in five currencies — drone-hours by class, position (traverse + contractual end-positions), risk budget, instrument-consumable cycles, downlink share — with exit conditions as contract terms, twin rehearsal as award evidence, and a program-run, never-allocatable return-to-readiness interval between campaigns.** | 2026-07-28 | Drone state is path-dependent (paper Section 3); the telescope-time model breaks on it. Formalizes the design direction accumulated in paper Section 9. Risk budget as a first-class allocated quantity is what turns the PK4 loss budget from a promise into bookkeeping. |
| PD9 | **Two tracks, one campaign structure: peer-review and game-qualification tracks converge on shared campaigns with mixed rosters as the intended norm. A charter-protected minimum share of each season's allocatable state flows through the qualification track. Allocation is never sold: membership fees buy standing to propose, never outcomes; qualification cannot be bought at any price. One refinement (owner, 2026-07-28): an institutional membership may reserve team-roster *seats* — but every individual filling a reserved seat must hold current qualification, earned in the sim like anyone else's. Money reserves capacity, never competence; an unfilled reserved seat lapses back to the season's qualified pool.** | 2026-07-28 | Separate fleets would recreate the two-class system the program exists to dissolve (D16: the same directive artifact through the same interpretation layer). The protected share blocks the PK5/PK7 squeeze-out structurally. Never-sold is a legitimacy requirement (PD3): purchasable drone-hours would forfeit what every other element defends. Reserved seats are safe because institutions normally hold a large pool of qualifiers, and the platform is itself the training tool — so the seat fee purchases exactly the behavior the program wants: institutions running their people through the program's own pipeline. |
| PD10 | **Two disclosure clocks. The operational record (directives, contestations, resolutions) publishes within a short campaign window, and safety-significant events (locks, reflex saves, overrides) publish immediately, no exceptions. Science data gets an observatory-style proprietary period — long enough to protect first publication, no longer — then the permanent archive.** | 2026-07-28 | Proprietary protection exists for publication priority, never for operational accountability. One clock cannot serve both duties: the record is the program's safety and legitimacy instrument (PD3), the data is its science product. |
| PD11 | **Stewardship reputation: the tracked quantity is stewardship of granted state against the declared plan — spending budgeted risk is legitimate use, never misconduct. Consequence ladder matched to the finding: miscalibration → coaching; persistent waste → allocation penalty; adversarial conduct → qualification revocation, appealable to the campaign authority. Clean hand-offs carry forward as standing.** | 2026-07-28 | The paper's abuse analysis (4.9) requires consequences; the risk-budget distinction keeps them from teaching timidity — a reputation system that punishes all refusals selects for cowardly science. Appeals run through PD6's office: the separation that governs locks governs standing. |
| PD12 | **Revenue is instrumental and always yields to science and constituency; science and constituency are co-primary and never ranked against each other in the moment — a conflict between them is a design error, resolved structurally in the ledger (the D42 pattern), never case by case. Corollary: naming rights become explicitly informal discovery dedications on the program's own maps and record — official IAU nomenclature is not for sale and the informality is stated, never implied away.** | 2026-07-28 | The register said the three products had no conflict rule; now they do, and the one live conflict (naming rights vs. IAU nomenclature) is resolved by it. Selling "official" names would be the star-registry con at institutional scale, at the direct cost of the legitimacy (PD3) the program depends on. |
| PD13 | **The funding ladder: revenue funds the proving; proof buys the partnership. Game revenue carries Rung 0 operations and seeds Rung 1; memberships and grants carry Rung 1; Rung 2 is philanthropy-plus-agency scale; Rung 3 is agency/international-partnership scale — bought with the credibility the earlier rungs manufacture, never with consumer revenue. The Institute's charter functions run on durable streams (memberships, endowment), never on volatile consumer revenue; the endowment is sized so record custody survives indefinite revenue drought.** | 2026-07-28 | Each rung costs roughly 10× its predecessor and is fundable by a different kind of money (5.1); pretending one source spans the ladder is the kind of optimism PK1 punishes. D41's funded-not-profitable applied per rung. Endowed custody is the economic mechanism behind PD5's "record outlives the institutions." |
| PD14 | **Two downlink tiers on two physical paths: Tier 1 (the operational record — small) closes over direct-to-Earth links that every fleet asset class carries, sized for closure with zero relay assets in existence; Tier 2 (science volume) rides relay and is the only tier campaign downlink shares allocate. Relay loss can therefore throttle science but never safety, accountability, or the record.** | 2026-07-28 | The record is the program's legitimacy instrument (PD3) and Level-3/reflex events must publish immediately (PD10) — so the integrity layer cannot depend on infrastructure the program might not get. Record-tier volumes are within demonstrated Mars direct-to-Earth rates; the tiering was already PK6 doctrine, this binds it to hardware. |
| PD15 | **Tier 2 relay capacity is procured in strict preference order: buy commercial → partner with agencies (paid, contracted, never charity) → fly program-owned smallsat relays as a priced Rung 3 manifest line → treat Marslink as windfall, never plan-of-record.** The backstop option is what makes the plan close without anyone's permission. | 2026-07-28 | Owning the interface (PK6) means the last rung of the ladder is under program control. Cross-agency relay precedent exists and is purchasable in principle; Marslink (D6) is a settlement asset the seed fleet may predate (the PK11 pattern: external infrastructure is never assumed). Gives G3-5's "contracted or designed — not assumed" its concrete meaning. |
| PD16 | **Bandwidth joins latency as a simulated-then-real physical variable across the ladder: the game enforces realistic downlink scarcity from day one (data-budget craft is a taught, qualification-relevant skill, and game telemetry calibrates tier sizing); Rung 1 injects Mars-realistic downlink constraints as G2-4 injects latency; Rungs 2–3 meet real links with the discipline already trained.** | 2026-07-28 | Extends D42's logic to the second physical constraint the fleet lives under: if latency shapes the control paradigm, bandwidth shapes the science product, and both are cheap to teach in simulation and expensive to learn at Mars. Also hardens qualification: downlink budgeting failures should disqualify in the sim, not strand data on Mars. |
| PD17 | **The timeline is a pacing model, never a schedule: dates are earliest-credible projections conditioned on gates. The schedule never pressures a gate (slipping evidence slips the date, never the reverse); no hardware commits to a launch window before its gate passes (window targeting stays provisional until then); and the program runs on three clocks — calendar for Rungs 0–1, contract lead time for Rung 2, synodic (D3) for Rung 3 only — with the ~26-month synodic tick doubling as the standing program review (availability re-verification per PD4(c), pacing model refreshed).** | 2026-07-29 | A timeline that hardens into commitments reverses PD2's criteria-not-dates doctrine; window fever — thinning evidence to make a launch window — is the oldest schedule pathology in planetary exploration, and the gates exist to make it impossible. Earliest-credible arc: ~16 years founding-to-Mars, revenue from ~year 3, science from ~year 5, permanent off-Earth operations from ~year 10 (7.1). |
| PD18 | **Tiered naming: the institution is the Open Exploration Institute; the Open Prospector Program keeps its name as the Institute's first program; the Studio's working name is Open Exploration Studio; the consumer game's name is a later Studio decision inside Institute-set rules (no overpromising, no "-ify" names). Nothing renames today — the paper, corpus, site, and this repo all say "Open Prospector Program" and remain correct; the Institute name first appears when the Institute is founded.** A program fits under the umbrella when it has: a scarce or hazardous instrument, a latency or bandwidth constraint that forces autonomy, science worth doing, and a public that wants real agency. Candidate future programs (capacity, not commitments, per PD2): the permanent lunar fleet that Rung 2 becomes; deep-ocean fleets; crowd-directed orbital instruments; other bodies per master 12.6. | 2026-07-30 | Owner decision: the tiered structure gives the program room to grow into. "Prospector" is accurate for the Mars program (its first campaign literally prospects for ice) but extraction-flavored as a permanent institutional identity — the planetary-protection filing is the sentence it would read worst in. "Open Exploration Institute" is the plainest body-agnostic name, per the explain-don't-allude style rule. NASA-style agency/program/mission layering; program #2 costs a fraction of program #1 because protocol, twin engine, allocation, qualification, and record are shared. |
| PD19 | **Record escrow follows the digital-preservation model: many complete public mirrors under independent governance. Custodianship is a consortium membership function (member libraries hold full mirrors); at least three custodian classes at all times (member libraries, an independent public archive, the agency science archive for Tier 2 data); anyone may mirror. The record format is escrow-shaped by requirement: append-only, hash-chained, self-describing, open, and small — written into the G1-3 formal spec. Custody is endowment-funded (5.5) with continuation obligations that survive the Institute; agreements in force before the first Rung 1 campaign record opens.** | 2026-07-30 | An archive the Institute alone controls is a promise, not a guarantee — and the adversarial case (an authority altering or quietly dropping entries) is the one that matters, since the record is the accountability instrument (PD3). Mirrors the Institute does not control close the capture path; hash-chaining lets any mirror holder verify completeness without trusting anyone. The scholarly-publishing preservation model, applied to the program's own consortium. |

## Corrections Log (PC)

| # | Version | Correction |
|---|---------|------------|
| PC1 | v0.2 → v0.4 | **Owner review caught a silent assumption.** The v0.2 gates tested only what the *program* must demonstrate (readiness), assuming the external infrastructure each rung rides on — commercial lunar delivery, Mars-capable heavy lift, relay capacity — will exist when the program is ready for it. But lunar delivery programs get scrapped for technical or political reasons, and a Mars-capable launch provider can lose interest in Mars; none of that is under program control. **Fix:** every gate now carries availability criteria beside its readiness criteria (PD4), and the never-materializing ride is its own killer (PK11), distinct from PK10's failed launch. |
| PC2 | v0.14 → v0.15 | **2026-09-09: reconcile the supporting software baseline.** Static review identified incomplete alternative/audit transport, IPC scheduling ownership, revision semantics, budget enforcement, recovery guards, scenario truth isolation and run closure. Application draft 0.4 and implementation brief v0.2 correct these with schema changes and contract examples. These remain provisional Rung-0 engineering choices; no PD decision or master artifact is changed. The earlier software handoff pass is historical, not runtime acceptance evidence. |
| PC3 | v0.15 → v0.16 | **2026-09-09: define the first executable transport spine.** The full scenario schema requires terrain hazards and cannot honestly describe an ACK-only harness. Add the separate fake-evidence-spine-v0 profile and spine-scenario-v0 init alternative, retaining actual delayed evidence requirements for completion. Bind full observation artifacts to Tier 1 and source snapshots to manifests; document the fake checkpoint and replay limitations in first-spine-profile.md. No full-autonomy or program-policy acceptance is implied. |

## Open Questions Register (PQ)

Seeded 2026-07-28 from the program-level gap analysis: the master outline holds
itself to a program-management discipline (phase gates 0.3/0.4, killer register
0.5, who-pays economics 10.2, governance 10.4) that had never been applied to
the Prospector program itself.

| # | Question | Priority | Status |
|---|----------|----------|--------|
| PQ1 | **Rung gates.** What must each rung demonstrate before the next is worth funding? D17 asserts each rung is independently valuable, but no transition criteria exist (master D32 discipline: a gate is a criterion, not a schedule milestone). | High | **RESOLVED first pass (v0.2):** four gates designed at Section 1 under doctrine PD2 (criteria-not-dates; plateau-not-death; gates verify Section 2 mitigations). Numeric thresholds deliberately left parameterized until each gate's spec freeze. |
| PQ2 | **Program killer register.** The D39 exercise run against the *program*: game flops (funding inversion dies), sim-to-real gap discredits Rung 1, PP authority denies Candor access (no fallback campaign named), early public loss-of-asset scandal, fleet attrition breaking the "real drone-hours" promise. Enumerate and de-singularize. | High | **RESOLVED first pass (v0.2):** ten-killer register built at Section 2 under doctrine PD3 (master killer = legitimacy; public record as primary defense; two design-time mandates named). Residuals spun into PQ sub-questions where noted. |
| PQ3 | **Governance & institutional identity.** Who is the campaign authority (Level-3 locks require a named human — of what institution)? Who owns the fleet? Consumer game company vs. observatory-style allocation institution — one entity or two? Export control on a trained autonomy stack. A legal entity must exist before Rung 0 ships. | High | **RESOLVED first pass (v0.5):** two-entity structure designed at Section 3 (PD5: Institute + wholly-owned Studio, four constitutional commitments; PD6: campaign authority as an office; PD7: US incorporation). Board-seat questions deferred by owner decision (3.6). Residuals spun off: record-escrow partners (PQ9), export determination (PQ10). |
| PQ4 | **Allocation mechanics** (= master Q17). Peer-review vs. game-qualification tracks, campaign mechanics, proprietary periods. Design direction already accumulated in paper Section 9: allocation prices *state* not time; contractual exit conditions; return-to-readiness intervals; stranded-cost policy and the demotion ladder. Promote into designed prose + decision entries. | Med | **RESOLVED first pass (v0.6):** designed at Section 4 under PD8–PD11 (state-vector allocation; two tracks converging on shared campaigns with a charter-protected public share and allocation never sold; two disclosure clocks; stewardship reputation with appealable consequences). Numbers parameterized to the campaign contract template (PQ11). Master Q17 adoption deferred until repo goes public (4.8). |
| PQ5 | **Economics with numbers.** "Each rung independently fundable" has never been costed, even order-of-magnitude (game-studio scale vs. CLPS-mission scale vs. flagship scale). Also: the three program products (science, constituency, revenue) have no stated priority for conflicts — e.g. discovery naming rights (revenue) vs. IAU nomenclature rules. | Med | **RESOLVED first pass (v0.8):** designed at Section 5 under PD12–PD13. Order-of-magnitude costs anchored (each rung ~10× its predecessor, each fundable by a different kind of money); revenue streams sized from public comparables (game revenue carries Rung 0–1, never Rung 2+); conflict rule set (revenue always yields; science/constituency conflicts resolve structurally); naming rights resolved as explicitly informal dedications. Bottom-up numbers = PQ12. |
| PQ6 | **Comms & data dependency.** Public-by-default record implies serious relay capacity; Marslink (D6) is a settlement asset Rung 3 may predate; DSN time for a crowd-directed private fleet is unsolved. Nobody owns this interface. | Med | **RESOLVED first pass (v0.9):** designed at Section 6 under PD14–PD16 (two tiers on two physical paths — the record closes direct-to-Earth with zero relay; relay procurement ladder ending in a program-owned backstop; bandwidth joins latency as a taught variable across all rungs). Technical follow-through (link budgets, spectrum, ground segment, backstop design) spun off to PQ13. |
| PQ7 | **Timeline.** Map the rungs onto synodic windows, even coarsely (the D3 clock governs Rungs 2–3; Rungs 0–1 are calendar-driven). | Med | **RESOLVED first pass (v0.10):** pacing model at Section 7 under PD17 (dates condition on gates, never pressure them; no window commitment before gate passage; three clocks, with the synodic tick as standing program review). Earliest-credible arc: ~16 years founding-to-Mars surface, productive throughout. Refreshed at every synodic review rather than spun off to a new PQ. |
| PQ8 | **Program naming.** "Open Prospector" is Mars-flavored and extraction-flavored; Section 12.6 already argues the architecture is a capability, not a mission ("OpenExplorer" floated 2026-07-28). Interacts with the site's SD10 umbrella-branding deferral. No -ify names. | Low | **RESOLVED (v0.12):** tiered naming adopted at Section 8 (PD18) — Open Exploration Institute over the Open Prospector Program; nothing renames today. Name clearance before founding is PQ14. SD10 adoption deferred until repo goes public (with 4.8). |
| PQ9 | **Record escrow: which independent archives mirror the public record, and by what mechanism?** PD5's third commitment — the record survives even the Institute's failure — needs named partners (planetary-science data archives are the natural candidates; libraries have run this model for digital preservation) and a mirroring cadence and format. Couples to the Q18 public-record format spec (a Gate 0→1 deliverable, G1-3). | Med | **RESOLVED first pass (v0.13):** designed at Section 9 under PD19 — many-mirror model with custodianship as a membership function, three custodian classes minimum, escrow-shaped format requirements fed into the G1-3 spec, endowment-funded custody with continuation obligations. Named-partner selection is a founding follow-on (9.5). |
| PQ10 | **Export-control determination.** Formal classification of the trained autonomy stack and the high-fidelity twin under US export rules (PD7): what is controlled, what is publishable, and where the open-layer boundary (protocol spec, directive interface, record formats — deliberately open standards) must sit. Timing: in hand before Gate 1→2 (verified at G2-5); early enough to shape the architecture split rather than react to it. | High | Open |
| PQ11 | **Campaign contract template and first parameter set.** The numbers Section 4 deliberately leaves symbolic: risk-budget units (how expected loss is priced across drone classes — a real actuarial problem), the qualification track's charter-protected minimum share, the two disclosure-clock window lengths, membership fee schedule, readiness-grading scale. Needed as working templates before G2-2's rehearsal campaign; each number frozen per the gate discipline (1.0). | Med | Open |
| PQ12 | **Bottom-up cost and revenue model.** Section 5's anchors are public comparables, adequate for gate design, inadequate for a budget: studio budget by phase, analog-fleet and field-season costs, real lunar-delivery quotes, membership pricing against named consortium comparables, endowment sizing for indefinite record custody (5.5). Each number freezes per the gate discipline — Rung 0's before G0-3, Rung 2's before Gate 1→2. | Med | Open |
| PQ13 | **Comms interface specification.** The technical follow-through of Section 6: per-asset-class link budgets sizing the Tier-1 direct-to-Earth requirement (PD14); spectrum coordination and licensing path; ground-segment procurement options (agency networks vs. the emerging commercial deep-space fringe); preliminary design and cost of the program-owned relay backstop for the Rung 3 manifest (PD15). Lunar items verified before Gate 1→2; Mars items before Gate 2→3. | Med | Open |
| PQ14 | **Name clearance.** Before the Institute is founded (3.5): trademark and entity-name availability search for "Open Exploration Institute" and "Open Exploration Studio" in the incorporation state (PD7), domain acquisition, and a collision check in the space-science and games sectors. Cheap, but it must precede the first public use of the name. | Low | Open |

---

## 1. Rung Gates (PQ1) — FIRST PASS v0.2

### 1.0 Doctrine (per PD2)

A gate is what must be **true**, not what must have **happened by a date** —
the master's D32 discipline applied to the D17 ladder. Three standing
properties:

1. **Plateau, not death.** A failed or indefinitely-unmet gate leaves the
   program resting at its current rung, which is independently valuable per
   D11/D17. There is no sunk-cost trap anywhere on the ladder.
2. **The gate makes the funding case.** The evidence a gate demands is
   exactly the evidence a funder of the next rung would demand — so passing a
   gate and being able to fund the next rung are the same event seen from two
   sides. No separate fundraising document needs to exist.
3. **Gates and killers are duals** (the master's 0.4/0.5 pattern). Each gate
   names the Section 2 killers whose mitigations it verifies before capital
   commits; the register defends continuously between gates.
4. **Readiness and availability (per PD4, added PC1).** The numbered criteria
   below are *readiness* criteria — what the program must demonstrate. Each
   gate also carries an *availability* block: the infrastructure operated by
   external actors that the next rung rides on, which may never be built,
   whatever the program demonstrates. Availability is verified at gate
   time as something purchasable or contracted — never assumed from a roadmap
   — and re-verified every synodic window while the program waits (PK11).

Numeric thresholds below are deliberately parameterized (marked *[spec
freeze]*): first-pass gates fix *what is measured*; each threshold is set when
that gate's spec is frozen, one rung ahead of its test.

### 1.1 Gate into Rung 0 — "worth building the game"

The lightest gate; it protects a game-studio-scale commitment.

- **G0-1 Twin feasibility (master Q15).** The terrain-data survey confirms the
  digital twin is an integration problem, not a data-collection program:
  coverage map of HiRISE DTM / MOLA / CTX for the launch campaign regions, and
  a stated fidelity target for directive-level realism (vs. joystick-level,
  which the Phobos mode needs only locally).
- **G0-2 Implementable protocol.** The contestation protocol (paper Sections
  4–5) is specified tightly enough to *implement in software* — not the formal
  schema (that is a Gate 0→1 deliverable, see G1-3) but an engineering-usable
  statement of the grammar, ladder, and negotiation-window rule.
- **G0-3 Institutional seed (PQ3, PD5).** The Institute exists with the four
  constitutional commitments in its charter, and the Studio — the entity that
  ships the consumer product — is formed as its wholly-owned subsidiary. The
  separation cannot be bolted on later; it must precede the first dollar of
  game revenue.

**Availability (PD4):** already satisfied — the terrain archives (HiRISE,
MOLA, CTX) are public data, downloadable today, and a consumer game needs no
space infrastructure. This is the only gate with no external dependency.

### 1.2 Gate 0→1 — "worth buying hardware"

Protects the Earth-analog fleet commitment (university-budget scale, but the
program's first physical capital). Verifies mitigations for PK1, PK9; sets up
the measurement of PK2.

- **G1-1 Funding inversion demonstrated — or retired.** Either game
  revenue sustains ongoing operations (D17's revenue-before-hardware bet
  works), or the game has failed commercially but demonstrably succeeded as a
  citizen-science instrument — a large, active community doing real science
  work, which Foldit achieved without ever being a best-selling game — and
  Rung 1 proceeds on conventional funding (grants, university budgets,
  philanthropy). Both outcomes pass the gate; drifting between them without
  deciding does not. *(PK1)*
- **G1-2 Interface discipline validated at scale.** The directive interface
  works on real users: a measured fraction of directives are well-formed
  statements of intent with usable goal fields; the interpretation layer
  trained on the corpus meets its acceptance target *[spec freeze]*.
- **G1-3 Contestation calibrated — formal spec delivered.** Counter-proposal
  acceptance rates, escalation distributions, and rage-quit data at consumer
  scale show the protocol is socially viable *(PK9)*; on that evidence the
  **formal Q18 artifacts** (typed refusal schema, escalation state machine,
  public-record format) are written and adopted back into the master — the
  exact moment the master's Q18 deferral ("until the design has been shaken
  out at Rung-0 scale") was waiting for.
- **G1-4 Qualification funnel produces a cohort.** The vetting pathway has
  yielded a ranked population of teams qualified under the real interface
  discipline, large enough to oversubscribe Rung 1's field seasons *[spec
  freeze]*.
- **G1-5 Sim-to-real baseline frozen.** The twin's fidelity envelope is
  documented so Rung 1 can measure the gap against a stated baseline rather
  than an impression. *(Sets up PK2: Rung 1's mission is to find everything
  the sim got wrong.)*

**Availability (PD4):** modest and commercially diverse — an off-the-shelf
market for field-robot hardware (it exists and is broadening) and continued
access to analog sites through university partnerships. Low external risk;
Rung 1, like Rung 0, needs nothing launched.

### 1.3 Gate 1→2 — "worth a lunar manifest"

Protects a CLPS-class commitment — a commercial lunar delivery contract, on
the order of $100 million, the program's largest single spending decision to
that point. Verifies mitigations for PK2, PK4, PK8; begins the PK3 mitigation
via the lunar regulatory rehearsal.

- **G2-1 Sim-to-real gap closed and bounded.** Field-vs-twin discrepancies
  from Rung 1 are enumerated, fed back, and the residual quantified:
  directives that succeed in sim succeed in the field at or above threshold
  *[spec freeze]*, and — the decisive test of the vetting claim —
  **game-derived qualification predicts field performance** (leaderboard rank
  correlates with field campaign outcomes). *(PK2)*
- **G2-2 Full-stack campaign rehearsal.** At least one complete campaign cycle
  — allocation, directives, gatekeeper, contestation, public record,
  campaign hand-off with exit conditions — run end-to-end on physical
  hardware with external teams, using the same C2 software that will fly.
  Requires allocation mechanics (PQ4) designed and exercised.
- **G2-3 Contestation proven in the field.** Real Level 0–3 events on physical
  hardware, including at least one Level-3 lock exercised and released by the
  campaign authority through the full human-override path; zero assets lost
  to a directive the protocol should have caught. *(PK4)*
- **G2-4 Latency discipline pre-tested.** Artificial Mars latency injected on
  the *Earth* analog fleet first (cheap where rescue is a drive away):
  survival-relevant autonomy behaviors demonstrated before they are tested
  where rescue is impossible.
- **G2-5 Institutions exist under real constraints.** The campaign authority
  and allocation process operate as functioning institutions (PQ3/PQ4 turned
  into written operating procedures that have actually been exercised, not
  just design prose), and the export-control determination
  on the autonomy stack is in hand *(PK8)* — because Rung 2 operates under
  real regulatory and international-participation constraints, not the
  informal arrangements of analog fieldwork.

**Availability (PD4):** commercial lunar delivery exists as a *purchasable
service* at the fleet's payload class — flown missions, quoted prices, and
more than one provider if at all possible (non-US providers count). If the
CLPS-style market is scrapped for technical or political reasons and no
alternative emerges, the program waits at Rung 1 — still valuable — and
re-verifies each synodic window. *(PK11)*

### 1.4 Gate 2→3 — "worth the seed fleet"

Protects the flagship-class commitment. Verifies mitigations for PK3, PK5,
PK6, PK10.

- **G3-1 Unattended endurance.** The lunar fleet survives lunar nights —
  a survival-autonomy stress exceeding the Mars requirement (D17) — for a
  number of day/night cycles *[spec freeze]* with the supervisory abort
  channel unused for survival. The program-level echo of the master's D38
  meta-criterion (unattended endurance through the thing Earth testing cannot
  replicate).
- **G3-2 Latency discipline held for real.** Full campaigns run at injected
  Mars latency with the abort channel's use logged and audited: autonomy plus
  contestation handled every hazard within protocol; the abort channel was a
  supervisor, not a crutch.
- **G3-3 Planetary-protection certification path proven.** The gatekeeper has
  been certified by the relevant authority against lunar operations — the
  payoff of treating the lunar rung as a regulatory rehearsal — and the *Mars*
  ruleset — including Candor special-region handling — has had provisional
  review. The fallback first
  campaign (PK3) is named and designed in the Rung 3 mission plan.
- **G3-4 Fleet economics known.** Cost per delivered science-directive-hour
  from real flight operations; seed-fleet instrument suite (master Q13) and
  canyon-EDL posture (master Q12, see PK10) resolved to mission-plan level;
  the cost of replacement drones included in the Rung 3 funding request as a
  standing line item, not an afterthought. *(PK5)*
- **G3-5 Demand and data interfaces sized.** Qualified-team pipeline at the
  scale Rung 3 allocation assumes *(PK5)*, and the relay/data interface (PQ6)
  contracted or designed — not assumed. *(PK6)*

**Availability (PD4):** the ladder's largest external dependency. Mars
delivery at the seed-fleet payload class must be demonstrated *and for sale* —
a provider with proven Mars entry, descent, and landing who will carry a
paying payload (the master's D5 interface, actually existing rather than
specified). Plus relay capacity per G3-5. If the heavy-lift provider's Mars
ambitions lapse and no successor appears, Rung 3 waits indefinitely — the
scenario PD4(b) prepares for by sizing fleet elements to the smallest viable
payload class, and PK11 works by pointing the program's constituency outward
as a demand signal. *(PK11)*

## 2. Program Killer Register (PQ2) — FIRST PASS v0.2

### 2.0 Framing (per PD3)

For the settlement, death is physical. For the program, **death is the moment
its promises become unkeepable**: real agency (directives that matter), real
hardware (drone-hours that exist), open access (qualification anyone can
earn), honest record (public by default, nothing erased). Every killer below
ends the program by breaking one of those promises — and most of them cascade
through **legitimacy**, the program's master killer, the way settlement
failures cascade through power. The public record is the standing defense:
it converts incidents into audits and accusations into evidence.

D39 classification is kept: each killer is **preventable** (architecture can
make it non-fatal), **survivable-only** (cannot be prevented, must be
absorbed), or **delayable-only**; mitigation type is matched to timescale
(acute → pre-existing automatic response; delayed → margin + correction;
chronic → strategic posture).

One note before the register: today, at the design phase, the biggest
killer is that the program is a **single-author corpus** — bus factor one.
Its mitigations are already in motion (the ledger discipline makes the
reasoning reconstructible; this repo exists to mature the design toward
opening; PQ3 gives it an institutional home) and it is retired the day the
repo opens to contributions, so it is noted here rather than numbered.

### 2.1 The register

| # | Killer | Mechanism | De-singularization | Class / timescale |
|---|--------|-----------|--------------------|--------------------|
| PK1 | **The game flops** | Rung 0 fails commercially; the plan to fund later rungs from game revenue (D17's inverted funding curve) fails with it | The game is four artifacts in one (D17); only *one* of them is revenue. Design so the science value does not depend on selling millions of copies — a modest but genuinely active player community (what Foldit achieved as a free research game) is enough to keep the vetting funnel and training corpus alive. Spend the development budget in stages so a weak launch doesn't strand a large investment; G1-1 forces an explicit decision — revenue model demonstrated *or* abandoned — instead of drift. Rung 1 can be funded by universities and grants without Rung 0 revenue (D11 independence). | Survivable / delayed → margin: program proceeds on conventional funding, slower |
| PK2 | **Sim-to-real gap discredits the vetting claim** | Rung 1 shows twin success does not predict field success; game-derived qualification loses predictive validity; the program's central "play well enough and you command real hardware" promise collapses | Rung 1's *mission* is gap closure (already decided, D17) — the killer is only fatal if unmeasured. G1-5 freezes the baseline; G2-1 requires the correlation before lunar capital; qualification criteria re-weight onto field-validated skills if the correlation is weak. | Preventable (by the gates) / delayed |
| PK3 | **Planetary protection bars the flagship target** | COSPAR special-region ruling denies Candor Chaos ground truth — the highest-value first campaign (Q1) and the Phase II site gate (D15) | Cannot force the ruling — absorb it: (a) **named fallback first campaign** of independent value (leading candidate: Candidate A ice-corridor characterization, which serves D13 directly and is nobody's special region); (b) early, structural engagement — the gatekeeper demonstrated as *enforced architecture* at Rung 2 (G3-3) is the strongest case ever presented to a PP authority; (c) sterilization-capable subset of the fleet as a compliance option. | Survivable-only / chronic → strategic |
| PK4 | **Public loss-of-asset scandal** | An early, visible drone loss traced to a crowd directive — "they let gamers destroy the rover" — collapses institutional trust and agency partnership | The first loss **will** happen; the mitigation must pre-exist it (acute-class). (a) The contestation protocol is the engineering defense; (b) the public record converts the loss into an attribution audit (drone's judgment vs. team's directive vs. authority's override — the record already carries attribution as its third duty, paper Section 9); (c) **published loss budget**: every campaign carries a declared risk budget (already in the Q17 design direction) so losses land as budgeted events, not betrayals. Design-time mandate per PD3. | Preventable (as scandal; the loss itself is survivable) / acute |
| PK5 | **Fleet attrition breaks the drone-hours promise** | Attrition plus no replenishment shrinks real allocation until qualification becomes decorative; the constituency sours into the program's loudest critics | (a) Demotion ladder keeps degraded assets productive (mobile → fixed station → parts donor, per the Q17 direction, Spirit-at-Troy precedent); (b) sim-tier campaigns are *real* allocation (forward-planning reconnaissance is real contribution, not a consolation prize — D17); (c) buying replacement drones is standing program policy, written into every rung's funding request (G3-4); (d) the allocation design says plainly that more teams will qualify than can ever be served, rather than letting each team discover it (designed at 4.5). | Preventable / chronic → strategic |
| PK6 | **The comms bottleneck starves campaigns** | Public-by-default record + imagery-hungry science vs. thin relay capacity: DSN allocation for a private crowd fleet is tiny, and Marslink (D6) is a settlement asset Rung 3 may predate | (a) Own the interface early (designed at Section 6: the record closes direct-to-Earth per PD14; relay ends in a program-owned backstop per PD15); (b) tier the data budget: the *record* (directives, contestations, resolutions — small) has absolute priority over raw data volume, so the program's integrity never throttles even when its bandwidth does; (c) commercial deep-space relay services are an emerging market — capacity can increasingly be bought rather than built; (d) onboard summarization rides the same autonomy stack. | Preventable / chronic |
| PK7 | **Institutional capture** | A funder, partner agency, or the game company's commercial owner captures allocation; the public tier is squeezed out; "Open" becomes marketing | The DMS-descended separation of powers already inside the protocol extends to institutions: **the revenue entity never controls allocation; the allocation authority never depends on revenue performance** — decided as two bodies, the Studio wholly owned by the Institute, with four charter-level commitments (PD5, Section 3). Founding-document material, the D29 pattern: cannot be retrofitted (PD3 design-time mandate). The public record makes capture visible; visibility plus a constituency of thousands is the enforcement mechanism. | Preventable at founding only / chronic |
| PK8 | **Export control closes the "Open"** | ITAR/EAR classification of the trained autonomy stack or twin blocks international teams — or blocks launch integration — gutting open access | (a) Early formal determination (PQ10, verified at G2-5); (b) architectural split: the *directive interface and record* are open by construction; the flight stack can be controlled without closing the program's front door; (c) international-payload precedents exist today. Worst case: openness lives at the directive layer while the stack stays domestic — degraded, not dead. | Survivable / chronic |
| PK9 | **The protocol fails socially** | Rung 0 reveals humans hate being refused by machines at scale: counter-proposal acceptance is low, rage-quit dominates, the cultural bet (paper 4.7) inverts into resentment | This is what Rung 0 exists to discover at the cost of a video game rather than the cost of flight hardware (the game corpus is the spec's test suite — decided, D17). Iterate the grammar at game speed: ladder tuning (more Level-1 auto-substitute, less Level-2 hold), counter-proposal phrasing, the five-move family's learnability. G1-3 makes social viability a *gate criterion*, so the bet is never carried to hardware unexamined. | Preventable (by Rung-0 iteration) / delayed |
| PK10 | **Seed-fleet delivery loss** | One launch failure or EDL failure — canyon EDL (Q12) being the hard case — erases the entire Rung 3 investment in a single event | Classic single-point failure; de-singularize the manifest: (a) fleet split across ≥2 launches/landers (the multi-modal fleet splits naturally); (b) first campaign designed to be scientifically viable with a partial fleet; (c) EDL risk isolated from fleet risk — land on benign terrain and traverse in, vs. canyon EDL, is a Q12 trade the mission plan must close (G3-4); (d) insurance and a replenishment slot in the next window (the D3 clock as recovery margin). | Preventable / acute |
| PK11 | **The ride never materializes** | The external infrastructure a rung depends on is never built, rather than failing on the pad (contrast PK10): lunar delivery programs scrapped for technical or political reasons; the Mars heavy-lift provider loses interest in Mars and no successor appears; relay capacity never deployed. The program is ready; the infrastructure never arrives. | The program cannot build heavy lift; absorb and hedge: (a) the plateau doctrine (PD2) is the main insurance — Rungs 0–1 need nothing launched, every rung is a stable resting state, and waiting costs the program its schedule but not its existence; (b) maximize the set of possible rides — design fleet elements to the smallest viable payload class (PD4) so any delivery vehicle above that class is a candidate, and treat non-US providers as real options; (c) the program is itself a demand signal — a funded, manifest-ready payload, a qualified user base in the thousands, and a public constituency are arguments *to* a wavering provider that a Mars (or lunar) market exists; (d) re-verify availability every synodic window rather than assuming it once (PD4) — infrastructure regresses as well as advances. | Survivable-only / chronic → strategic |

### 2.2 Reading the register

- **The cascade check (D39's power test):** PK4, PK7, and PK9 kill through
  legitimacy directly; PK2, PK5, and PK8 kill through it at one remove (each
  breaks a promise the constituency was recruited on). Only PK10 and PK11
  kill without touching legitimacy — one by losing the ride, one by never
  getting a ride at all — and PK11 is the register's only killer wholly
  outside program control. Defending the public record — its
  completeness, its priority on the downlink (PK6(b)), its independence from
  the revenue entity (PK7) — is therefore the most effective mission-assurance
  investment the program can make.
- **The two design-time mandates (PD3):** governance separation (PK7) and the
  published loss budget (PK4) must exist in founding documents and first
  campaign contracts respectively. Everything else in the register can be
  built when its rung arrives; these two cannot. A third joins them the day
  fleet hardware design begins: the smallest-viable-payload-class rule
  (PD4(b), serving PK11) — a fleet designed around one provider's unique
  vehicle cannot be re-designed when that provider's priorities change.
- **Residuals spun off:** the fallback-first-campaign design (PK3) belongs to
  the Rung 3 mission plan; the export-determination work item (PK8) is now
  PQ10; the data-budget tiering (PK6) joins PQ6. The register tracks them; the
  design work happens in those sections.

## 3. Governance & Institutional Identity (PQ3) — FIRST PASS v0.5

### 3.0 The structure (PD5)

Two entities, and the program owns both.

**The Institute** — formally the Open Exploration Institute (PD18), a
nonprofit — owns every asset the program's promises depend on: the protocol specification, the public record, the qualification
standards, the allocation authority (peer panels it convenes,
observatory-style — the lineage of university consortia operating shared
scientific facilities under charter), the campaign-authority office (3.2),
the planetary-protection ruleset, and eventually the fleet.

**The Studio** — a commercial company, wholly owned by the Institute — builds
and sells the game and runs its live operations. It implements the
qualification measurement in-game, but the criteria are Institute-owned, and
the Studio holds no allocation vote, ever.

Why two entities: a single organization's board can amend its own charter, so
any separation of powers inside one entity is only as durable as the current
board's goodwill — exactly the capture path PK7 must close structurally. Why
wholly owned rather than licensed to an existing studio (owner decision,
2026-07-28): the game is the program's revenue engine, vetting funnel, and
training instrument at once, and an external studio's commercial priorities
would compete with the interface discipline the game exists to teach.
Outsourcing it is a risk, not a hedge.

### 3.1 The four constitutional commitments (PD5)

Written into both charters at founding, because none can be retrofitted:

1. **Money flows one way; authority never flows back.** Studio profits fund
   the Institute on fixed terms. No Institute decision — allocation,
   qualification, campaign, override — is ever conditioned on Studio
   performance. (D41's funded-not-profitable logic, applied to the science
   side of the program.)
2. **Funders receive reports, never allocation votes.** The observatory norm,
   stated in charter so it binds future boards, not just present intentions.
3. **The record outlives the institutions.** "Nothing is erased" is a policy
   until it is a guarantee: the public record is continuously mirrored to
   independent archives so that it survives even the Institute's own failure.
   Partner selection and mechanism are PQ9.
4. **The gatekeeper is public code.** The planetary-protection layer is
   statute, not judgment (paper Section 3) — and statutes are published.
   Anyone can audit the rules their directive was screened against; that
   auditability is also the strongest case the program can present at
   certification time (G3-3).

### 3.2 The campaign authority (PD6)

An office, not a person: a professional operations directorate inside the
Institute, in the lineage of the observatory director and the flight
director. A named individual is assigned per campaign; their Level-3 override
signatures appear on the public record exactly as the paper requires. The
office answers to the Institute board; the individuals answer by name to the
public record. This gives the paper's separation of powers — contestation as
the democratic layer, override as the constitutional layer — a named
institution to live in.

### 3.3 Fleet ownership, liability, and the launching state

Under the Outer Space Treaty, the launching state retains jurisdiction over
and liability for space assets — so incorporation (3.4) decides which
government answers for the fleet. The Institute owns the fleet, through
per-mission subsidiaries where launch practice requires them. Directing teams
never carry asset liability: their exposure is capped by the stranded-cost
policy already sketched in paper Section 9, with the contestation record as
the attribution instrument. Rung 1 hardware can be university-owned
under program standards — cheaper, and it seeds the consortium relationships
the Institute's board will later draw on.

### 3.4 Jurisdiction and the export split (PD7)

The Institute incorporates in the **United States** (owner decision,
2026-07-28): export-regime politics can shift in any jurisdiction, so
choosing a country for its current export rules buys little lasting
protection — while the US offers the deepest funding pool and direct
adjacency to commercial lunar delivery. Revisit only if the export regime
becomes a demonstrated blocker to the openness promise.

The export split (PK8): the Institute publishes the **open layer** as open
standards — protocol specification, directive interface, record formats.
This is simultaneously the openness guarantee and what keeps the
architecture extensible (Section 12.6: a capability, not a mission — and
open standards are how a capability outlives its first program). The trained flight autonomy stack
and the high-fidelity twin live with whichever entity can lawfully hold
controlled technology; the formal determination is PQ10, in hand before
Gate 1→2.

### 3.5 Phasing

- **Now:** one lightweight nonprofit — the Institute — holding the corpus,
  the protocol, and the charter commitments of 3.1. Creating it retires the
  bus-factor note of Section 2.0 by giving the design an institutional home.
- **At Gate into Rung 0 (G0-3):** the Studio is formed as game development
  capitalizes.
- **At Gate 1→2 (G2-5):** both operate as functioning institutions with
  written, exercised procedures.

### 3.6 Deferred governance items (owner decisions, 2026-07-28)

- **University board seat.** Inviting a university to take a board seat adds
  credibility with other institutions — a real benefit, deferred until there
  is a board worth joining.
- **Constituency governance.** The program's thesis is that directing the
  fleet confers real agency; an elected board seat for qualified teams would
  align governance with that thesis and is itself a capture defense (a
  constituency with standing is harder to squeeze out). Deferred as a
  possibility — revisit after Gate 0→1, when a qualified population exists
  to elect from. Not a founding requirement.
- Board composition beyond these two levers (independent scientists,
  planetary-protection or ethics seat) is design work for the Institute's
  actual founding documents, not for this pass.

## 4. Allocation (PQ4, master Q17) — FIRST PASS v0.6

### 4.0 Doctrine: allocation prices state, not time (PD8)

Telescope allocation is stateless: one team's observation leaves the
instrument where the next team needs it. Drone allocation is
**path-dependent**: Team A's five-kilometer eastward drive is Team B's
starting position, A's drill cycles are gone forever, and A's near-misses are
wear on B's asset. So the unit of allocation is not hours of access but a
**grant of state** — and everything else in this section follows from that
one substitution.

### 4.1 The state vector (PD8)

A campaign award is a budget in five currencies:

- **Drone-hours, by drone class** — a spelunker-hour and a copter-hour are
  different goods.
- **Position** — a traverse budget and contractual end-positions, because
  where the fleet stands at campaign end is the next campaign's opening state.
- **Risk budget** — the declared, published expected-loss allowance (the PK4
  loss budget, made a first-class allocated quantity). Spending budgeted risk
  is legitimate use, not misconduct; see 4.6.
- **Instrument-consumable cycles** — drill bits, sample chambers, anything
  finite. A drill cycle spent is gone for the fleet's lifetime.
- **Downlink share** — the campaign's slice of the relay budget (PQ6), with
  the operational record always outranking science imagery (PK6).

### 4.2 Campaigns: award, exit conditions, hand-off (PD8)

- **The proposal declares its whole footprint:** science goals, region and
  season, state-vector request, risk budget, and **exit conditions** — the
  end-state the campaign contractually promises (fleet positions, consumable
  floors, data delivered). Path dependence is managed by making the hand-off
  a contract term, not a courtesy.
- **Twin rehearsal before award.** Simulation-first execution applies at
  campaign scale, not just directive scale: proposals are rehearsed in the
  digital twin, and rehearsal results are award evidence — the
  forward-planning function of Rung 0, used here for award decisions.
- **Between campaigns sits a return-to-operational-readiness interval** —
  program-run by the ops directorate (PD6), never allocatable, ending in a
  readiness grade per asset. Drones self-report fitness in the same grammar
  they contest in; the grade is public, so the next campaign knows exactly
  what it is inheriting.

### 4.3 Two tracks, one campaign structure (PD9)

The peer-review track (institutional proposals, panel-reviewed —
observatory lineage) and the game-qualification track (standing earned in
the sim, criteria Institute-owned per PD5) do not get separate fleets or
separate seasons. They converge on the **same campaigns**: a campaign's team
roster can mix institutional members and game-qualified members, and mixed
rosters are the intended norm, not an accommodation — the institutional
track brings method, the qualification track brings fleet fluency.

Two safeguards:

- **A charter-protected minimum share** of each season's allocatable state is
  awarded through the qualification track (fraction parameterized, set at
  spec freeze; protected in the Institute charter so a future board cannot
  zero it — the PK7 squeeze-out, blocked structurally).
- **Allocation is never sold.** Institutional membership fees buy *standing
  to propose* — a seat at the review process — never outcomes; qualification
  is earned in the sim and cannot be bought at any price. Money enters the
  program through membership, game revenue, and philanthropy (PQ5), and
  stops at the review-panel door. A program whose drone-hours could be
  purchased would forfeit the legitimacy (PD3) every other design element
  defends.

  One refinement keeps this rule compatible with a real institutional
  membership product (owner, 2026-07-28): a membership may **reserve
  team-roster seats** for a season — but a reserved seat is only a slot, and
  every individual who fills one must hold current qualification, earned in
  the sim under the same criteria as everyone else. Money reserves
  *capacity*, never *competence*: if an institution cannot field qualified
  members, its reserved seats lapse back to the season's qualified pool,
  unsold and untransferable. This is safe for two reasons — an institution
  normally holds a deep pool of qualifiers, and the platform is itself the
  training tool — and it aligns incentives: the seat fee is only worth
  paying if the institution runs its people through the program's own
  training pipeline. Reserved seats are roster capacity only;
  the campaign's state-vector award (4.1) still flows exclusively through
  the review and qualification tracks.

### 4.4 Proprietary periods: two clocks (PD10)

The observatory proprietary period is adapted, not adopted, because the
program has two different products with different disclosure duties:

- **The operational record** — directives, contestations, counter-proposals,
  resolutions — becomes public within the campaign's short operational
  window, and **safety-significant events (Level 3 locks, reflex saves,
  authority overrides) publish immediately**, no exceptions. Proprietary
  protection exists for publication priority, never for operational
  accountability.
- **Science data** gets an observatory-style proprietary period for the
  directing team — long enough to protect first publication, no longer —
  then joins the permanent public archive (mirrored per PQ9).

Window lengths are parameterized; set at spec freeze with the campaign
contract template (PQ11).

### 4.5 Oversubscription (PD9, PK5)

More teams will qualify than the fleet can ever serve, and the design states
it up front rather than letting each team discover it: published
seats-per-season against cohort size, published expected wait, and a
**sim-tier campaign track that is real allocation** — forward-planning
reconnaissance campaigns in the twin, feeding award evidence for real
campaigns (4.2), credited and recorded like any other contribution. The sim
tier is the program's real answer to scarcity, not a waiting room.

### 4.6 Stewardship and consequences (PD11)

The public record enables a reputation system, and the paper's abuse
analysis (4.9) requires one. Design principles:

- **The tracked quantity is stewardship of granted state against the
  declared plan** — not refusal counts in isolation. A team that spends its
  entire risk budget on a hard, declared objective is doing science; a team
  that generates unbudgeted hazard exposure is the anomaly. This distinction
  is what keeps the reputation system from teaching timidity.
- **Consequence ladder, matched to the finding:** miscalibration earns
  coaching (the program *wants* ambitious teams calibrated, not deterred);
  persistent waste earns allocation penalty; adversarial conduct earns
  qualification revocation. Revocation is appealable to the campaign
  authority (PD6) — the same separation of powers that governs locks governs
  standing.
- **Stewardship is symmetric:** teams that hand off clean state — exit
  conditions met, consumables banked, assets undamaged — carry that record
  into their next proposal. The incentive points at the program's scarce
  good: fleet state.

### 4.7 Stranded assets (PD8, paper Section 9)

When a campaign ends with an asset stranded or degraded: attribution runs
through the contestation record (its third duty — safety, discovery
priority, attribution); team liability is capped (teams never carry asset
liability, 3.3 — their exposure is reputational and allocative, per 4.6);
and the asset enters the demotion ladder — mobile asset → fixed station →
parts donor → write-off — so that even a stranded drone keeps producing
(the Spirit-at-Troy precedent: a rover that cannot rove is a weather
station).

### 4.8 Adoption note

This section is the proposed resolution of master Q17. Adoption back into
the master (marking Q17 advanced with a pointer here) is deferred until this
repo goes public — a private pointer in a public ledger serves nobody. The
same deferral applies to the PD5–PD7 governance material. Tracked here so
the adoption debt is visible.

## 5. Economics (PQ5) — FIRST PASS v0.8

### 5.0 Doctrine (PD13)

The master's D41 frame — *funded, not profitable* — applies to this program
with one clarification. "Revenue before hardware" (D17's inverted funding
curve) has sometimes been read as *the game pays for the fleet*. It does
not, and the design should never imply it: at the scales below, consumer
revenue can carry the program's institution and its proving, not its
flagship. Restated:

> **Revenue funds the proving; proof buys the partnership.** Game revenue
> and memberships carry Rungs 0–1 and keep the Institute alive; what Rungs
> 0–2 manufacture — a proven ops doctrine, a certified gatekeeper, a
> qualified public in the thousands, an auditable record — is the asset
> that persuades agencies, international partners, and major philanthropy
> to buy Rung 3 the way science infrastructure is always bought.

### 5.1 Order-of-magnitude costs (2026 dollars, public comparables)

First-pass anchors, deliberately coarse; the bottom-up model is PQ12.

| Rung | Scale class | Order of magnitude | Comparable |
|---|---|---|---|
| 0 — Game | Independent-to-mid studio | ~$5–30M development over 2–4 years, plus ongoing live operations | Successful simulation games have shipped at this scale; the terrain data is free (public archives), which is unusual cost relief for a sim |
| 1 — Earth analog fleet | University consortium program | ~$2–10M/year for a fleet of 5–15 off-the-shelf field robots, field seasons, and staff; ~$10–30M over its life | Existing analog programs (Devon Island-class) plus research-robotics fleet costs |
| 2 — Lunar fleet | Commercial lunar delivery mission | ~$150–500M all-in: delivery (reported commercial lunar task orders have ranged roughly $75–350M) plus payload development and operations | CLPS-class task orders, small-rover payload programs |
| 3 — Mars seed fleet | Agency-partnership mission | ~$1–3B for a multi-asset fleet with Mars entry, descent, and landing plus relay and multi-year operations | Between New-Frontiers-class (~$1B) and flagship-class (~$2.5B+) Mars missions |

Each rung costs roughly 10× its predecessor, and each is fundable by a
different *kind* of money. No single source spans the ladder, and the plan
does not pretend otherwise.

### 5.2 Revenue streams

- **Game revenue.** A well-executed niche simulation with a real-hardware
  hook is plausibly a 1–5M-lifetime-unit product over years (successful
  space sims have reached this range) — order $30–200M gross lifetime, most
  of it years after launch, against studio and live-ops costs. Capacity:
  **carries Rung 0 operations and can seed Rung 1; cannot carry Rung 2,
  ever.** Stating this plainly is a PK1 defense — no gate ever
  depends on the optimistic tail of the sales curve.
- **Institutional memberships and reserved seats (PD9).** Observatory-
  consortium comparables put mature membership programs in the $1–20M/year
  range across dozens-to-hundreds of institutions at tiered rates. Carries:
  allocation operations and a growing share of Rung 1. The reserved-seat
  product (4.3) makes the membership concretely valuable without touching
  outcomes.
- **Philanthropy.** Space-science philanthropy operates at $10–100M-gift
  scale today. The program's case to it is unusually strong: people who
  have *personally* directed exploration hardware on another world make
  unusually committed donors. Primary role: bridging Rung 2 alongside
  agency partnership.
- **Agency and international partnership.** The primary source for Rung 3.
  What the program sells an agency is not access but *efficiency and
  constituency*: directed science per dollar with a trained public
  attached, plus a flight-proven autonomy-and-contestation stack. This is
  the Antarctica model (D41): bought as infrastructure, justified by
  output.
- **Discovery dedications (naming rights, resolved).** Official planetary
  nomenclature belongs to the IAU and is not for sale — a program that
  sold "official" names would be running the star-registry con at
  institutional scale, and legitimacy (PD3) forbids it. What the program
  can sell: **explicitly informal dedications** — a donor's name
  attached to a feature *on the program's own maps and record*, in the
  tradition of mission teams' informal feature nicknames, marketed with
  the informality stated, never implied away. Modest revenue, zero
  legitimacy cost. (PD12.)

### 5.3 The funding ladder: source mix per rung (PD13)

| Rung | Primary money | Secondary | Never |
|---|---|---|---|
| 0 | Founding investment + game revenue as it arrives | Philanthropy for the Institute's charter functions | — |
| 1 | Game surplus + memberships + university research grants | Philanthropy | — |
| 2 | Philanthropy + agency partnership + memberships | Game surplus (contributes, does not carry) | Game revenue as the plan of record |
| 3 | Agency/international partnership + major philanthropy | All continuing streams | Any claim that consumer revenue reaches this rung |

### 5.4 When the three products conflict (PD12)

The program produces three things: science, constituency, and revenue. The
standing rule:

- **Revenue is instrumental and always yields.** When a revenue opportunity
  conflicts with scientific integrity or the constituency's trust, the
  revenue loses — automatically. Naming rights (above) is the worked
  example: the informal-dedications version was adopted, the lucrative
  version was not.
- **Science and constituency are co-primary and are never ranked against
  each other in the moment.** A conflict between them is treated as a
  design error to be resolved structurally — the way D42 resolved
  fun-versus-honesty by finding the physically-accurate fun mode, and the
  way the charter-protected share (PD9) resolved throughput-versus-openness
  with a number fixed in advance. If a genuinely new science/constituency
  conflict appears, it goes to the ledger as design work rather than being
  decided case by case.

### 5.5 Institutional durability

PD5's one-way-money commitment gets its economic mechanism here: the
Institute's charter functions — record custody, allocation, the campaign
authority — must run on the *durable* streams (memberships, endowment
income), never on volatile consumer revenue. Target: an endowment sized so
that record custody and archive mirroring (PQ9) survive a total revenue
drought indefinitely — the economic expression of "the record outlives the
institutions." Sizing belongs to PQ12.

### 5.6 Residual

The numbers above are anchors from public comparables, adequate for gate
design, inadequate for a budget. **PQ12** holds the
bottom-up work: studio budget, fleet and field-season costs, real delivery
quotes, membership pricing against named consortium comparables, endowment
sizing. Each number freezes per the gate discipline (1.0) — Rung 0's before
G0-3, Rung 2's before Gate 1→2.

## 6. Communications & Data Interface (PQ6) — FIRST PASS v0.9

### 6.0 The dependency, stated

A public-by-default program is a data-return program: no downlink, no
record; no record, no legitimacy (PD3). Yet the plan's comms assumptions
were inherited, not designed — Marslink (D6) is a settlement asset the seed
fleet may predate, agency deep-space network time is scarce and allocated
through priority processes the program does not control, and a
crowd-directed private fleet is a customer existing arrangements were not
written for. This section designs the interface instead of inheriting it.

### 6.1 Two tiers, two physical paths (PD14)

The PK6 tiering becomes an architecture rule by mapping the tiers onto
different links:

- **Tier 1 — the operational record** (directives, contestations,
  resolutions, health telemetry, event summaries). Kilobytes to a few
  megabits per sol per asset — within demonstrated direct-to-Earth rates
  for Mars surface vehicles. Doctrine: **every fleet asset class carries
  direct-to-Earth capability sized so that Tier 1 closes with zero relay
  assets in existence.** Tier 1 is never allocatable (4.1 allocates only
  Tier 2) and never throttled below closure.
- **Tier 2 — science volume** (imagery, spectrometry, mapping products).
  Hundreds of megabits per sol and up; physically requires relay. This is
  what campaign downlink shares (4.1) divide, and what grows or shrinks
  with the relay situation.

The consequence: **losing relay capacity degrades science throughput; it
can never degrade safety, accountability, or the record's completeness.** The program's integrity layer runs on the link the
program itself carries.

### 6.2 The relay procurement ladder (PD15)

Tier 2 capacity is an availability item (PD4) with a procurement order:

1. **Buy commercial** relay service where a market exists (emerging at the
   Moon now; speculative at Mars on Rung 3's horizon).
2. **Partner with agencies — paid and contracted, not charity.** Precedent
   exists: agencies already cross-relay for each other's landers; the
   program buys passes the same way, as a contracted service with defined
   volumes.
3. **Fly the backstop:** program-owned smallsat relays as a priced line
   item in the Rung 3 manifest (order $50–150M within the 5.1 envelope —
   PQ13 refines). With the backstop, the plan does not depend on anyone's
   permission.
4. **Marslink is windfall, never plan-of-record.** If the settlement
   program's constellation exists by Rung 3, Tier 2 gets cheap and
   abundant — but no gate criterion and no campaign promise may assume it.

G3-5 already demands the relay interface "contracted or designed — not
assumed"; the ladder says what those words mean in order of preference.

### 6.3 Bandwidth is the second taught variable (PD16)

D42 made latency a gameplay variable because latency shapes the control
paradigm. Bandwidth shapes the science product, and it gets the same
treatment:

- **Rung 0:** the game enforces realistic downlink scarcity from day one —
  campaign data budgets, Tier 1/Tier 2 split, the choice of what to send
  home as a core gameplay decision. Data-budget craft becomes a taught,
  tested, qualification-relevant skill (a team that cannot manage a
  downlink budget is not fleet-ready), and game telemetry calibrates the
  real tier sizing (feeds PQ11's parameter set).
- **Rung 1:** analog fleets operate under injected Mars-realistic downlink
  constraints, as latency is injected per G2-4 — the full communications
  discipline rehearsed where bandwidth is actually abundant.
- **Rungs 2–3:** the discipline meets real links; Rung 2's lunar campaigns
  prove Tier 1 closure and tier arbitration on actual deep-space
  infrastructure before Mars distance raises the stakes.

### 6.4 Ground segment and spectrum

The less visible half of the interface: deep-space-capable ground stations
are scarce (a handful of agency networks and an emerging commercial
fringe), and a private fleet needs spectrum
coordination through the same international machinery agency missions use.
Both are procurement-and-licensing work items with long lead times, not
engineering novelties. They live in PQ13 and are verified at the same gates
as the capacity they serve (ground/spectrum for the Moon before Gate 1→2;
for Mars before Gate 2→3).

### 6.5 Residual

**PQ13** holds the technical follow-through: link budgets per asset class
(sizing the Tier-1 direct-to-Earth requirement each drone must carry),
spectrum and licensing path, ground-segment procurement options, and the
preliminary design and cost of the relay backstop for the Rung 3 manifest.

## 7. Timeline (PQ7) — FIRST PASS v0.10

### 7.0 Doctrine: a pacing model, not a schedule (PD17)

Section 1 made rung transitions criteria, not dates; a timeline must not
reverse that. So the dates below are **earliest-credible
projections, conditioned on every intervening gate passing** — a pacing
model that answers "how fast *could* this responsibly go," never a
commitment. Three standing rules:

1. **The schedule never pressures a gate.** Slipping evidence slips the
   date; a date never thins the evidence.
2. **No hardware commits to a launch window before its gate passes.**
   Window targeting stays provisional — studies and long-lead design may
   look at a window, but the manifest commitment (the capital each gate
   protects) follows gate passage, never anticipates it. This is the
   defense against window fever, the oldest schedule pathology in
   planetary exploration.
3. **Three clocks.** Rungs 0–1 run on the calendar (software and field
   seasons). Rung 2 runs on contract lead times (lunar delivery is
   available roughly monthly; the 2–3-year procurement lead is the real
   clock). Only Rung 3 runs on the synodic clock (D3) — and the synodic
   tick doubles as the program's standing review: every ~26 months,
   availability criteria re-verified (PD4(c)), pacing model refreshed, the
   whole ladder re-dated.

### 7.1 The earliest-credible arc

Anchored today (mid-2026); Mars windows fall roughly at 2026, 2029, 2031,
2033, 2035, 2037–38, 2040, and 2042.

| Years | What happens (and what it is conditioned on) |
|---|---|
| 2026–27 | Institute founded (3.5); export determination begun (PQ10); twin data survey (G0-1); Studio formed when game development capitalizes (G0-3) |
| 2027–30 | Game development (~2–4 years per 5.1); early access mid-stream; revenue begins (5.3). Contestation and interface telemetry accumulate at consumer scale |
| 2030–31 | **Gate 0→1**: funding model demonstrated or retired; formal Q18 schema written from Rung-0 evidence and adopted back into the master; first qualified cohort exists |
| 2031–34 | Rung 1 analog fleet: two to three field seasons under injected latency and downlink constraints; full-stack campaign rehearsal (G2-2); sim-to-real gap measured and fed back. **Gate 1→2** around 2034 |
| 2034–37 | Lunar delivery procured (~2–3-year lead); lunar fleet flies ≈2036–37; a year-plus of operations: lunar-night survivals, injected-Mars-latency campaigns, gatekeeper certification on real regulatory ground. **Gate 2→3** around 2038 |
| 2036 → | The lunar fleet never decommissions (master 12.6): from here the program permanently operates exploration hardware off Earth, regardless of what happens at Mars |
| 2038–42 | Seed-fleet and relay-backstop development; provisional targeting of the 2040 window, **committed only after Gate 2→3**; earliest-credible Mars launch at the 2040–42 windows, arrival ~7–9 months later. First campaign: Candor Chaos ground truth (Q1) or the PK3 fallback |

### 7.2 Reading the arc

Founding to Mars surface is roughly **sixteen years** at earliest-credible
pace — flagship-program timescale, and the design says so rather than
promising better. The ladder's answer to "why so long" is that the wait is
not empty: the program is revenue-producing from about year three,
science-producing (analog fleets, published sim-to-real research) from
about year five, and permanently operating hardware off Earth from about
year ten. Every intermediate state is a stable, valuable resting point
(PD2): no rung needs the next one to justify itself, so no date needs
defending with thin evidence.

The model's largest variable is Rung 0's duration (game development plus
evidence accumulation, ~4–5 years of the sixteen); its largest external
risk is PK11 at the 2040–42 windows. Both get re-examined at every synodic
review.

## 8. Naming (PQ8) — RESOLVED v0.12

### 8.0 The tiered architecture (PD18)

Three levels, in the agency/program/mission pattern:

- **Institution: the Open Exploration Institute.** The permanent,
  body-agnostic entity of Section 3. Chosen for plainness — an agency, a
  university, or a donor understands it without a decoder — and because the
  institution is the thing Section 12.6 says outlives any one mission.
- **Program: the Open Prospector Program.** Keeps its name. "Prospector" is
  accurate for this program — its first Mars campaign literally prospects
  for ice (D14/Q1) — and everything already published under the name stays
  correct. The name was wrong only as a *permanent institutional* identity:
  extraction-flavored in exactly the contexts that matter most, a
  planetary-protection filing being the worst of them.
- **Product: named later by the Studio** (working name: Open Exploration
  Studio), inside Institute-set rules — no overpromising, no "-ify" names,
  and the informality rules of PD12 where dedications appear in-product.

Nothing renames today. The paper, the master outline, the site, and this
repo all say "Open Prospector Program" and remain correct; the Institute
name first appears on the founding documents (3.5), after name clearance
(PQ14).

### 8.1 What fits under the umbrella

A program belongs under the Institute when it has all four: a scarce or
hazardous instrument; a latency or bandwidth constraint that forces
autonomy; science worth doing; and a public that wants real agency. The
machinery the Institute owns — protocol, gatekeeper, campaign allocation,
qualification, public record, sim-first pipeline — applies wherever those
four hold, which is why program #2 costs a fraction of program #1.

Candidate future programs, recorded as **capacity, not commitments** (PD2's
discipline — none of these starts until someone gates it): the permanent
lunar fleet that Rung 2 becomes around 2038; deep-ocean fleets (acoustic
links give real latency and bandwidth scarcity, hardware is off the shelf,
and the seafloor is mapped worse than Mars); crowd-directed orbital
instruments (the HiWish precedent, D16, with no mobility at all); and the
other bodies of master 12.6. Beneath the programs sit three standing
functions that are naturally Institute-level rather than program-level: the
open standards, the cross-program archive (PQ9), and education built on the
sim.

### 8.2 Adoption note

The site's SD10 umbrella-branding deferral now has a candidate answer (the
Institute as the umbrella over the Mars Colonization and Open Prospector
cards). Like 4.8, adoption into the public corpus waits until this repo
goes public.

## 9. Record Escrow (PQ9) — FIRST PASS v0.13

### 9.0 The requirement

PD5's third commitment — the record outlives the institutions — must hold
against four failure modes: the Institute's systems fail; the Institute
itself fails (bankruptcy, dissolution, capture); revenue stops for years
(the endowment case, 5.5); or someone with authority tries to alter or
quietly drop part of the record. The last one matters most: the record is
the program's accountability instrument, and an archive the Institute alone
controls is a promise, not a guarantee.

### 9.1 Many custodians, one verifiable chain (PD19)

Digital preservation solved this problem for scholarly publishing years
ago, and the answer is copies: many complete mirrors, held by institutions
with different governance, funding, and failure modes, under agreements
that survive the depositor. The program applies that model with one
addition it is uniquely positioned to make:

- **Custodianship is a membership function.** Consortium member
  institutions (PD9) hold full public mirrors of the record as part of
  membership — their libraries already run digital preservation
  infrastructure, and it puts the archive in the hands of the same
  institutions that use the fleet. A captured or failing Institute cannot
  recall mirrors it does not control.
- **At least three custodian classes** at all times, so no single kind of
  failure takes them all: member university libraries; an independent
  public digital archive; and, for Rung 3 science data, the planetary
  science archive an agency partnership would require anyway (Tier 2 data
  follows agency archiving norms; the operational record is the part that
  needs the program's own arrangements).
- **Anyone may mirror.** The record is public; formal custodians carry
  obligations, but nothing stops a university course, a newspaper, or an
  individual from holding a full copy. Ubiquity is the last line of
  defense.

### 9.2 Format requirements (feeds the G1-3 spec)

Escrow works only if the format cooperates, so these are requirements on
the formal Q18 record specification, stated now so the spec is written
against them:

- **Append-only and hash-chained:** every entry references the hash of its
  predecessor, so any mirror holder can verify completeness and detect
  tampering or silent gaps without trusting the Institute.
- **Self-describing and open:** documented format, no proprietary reader;
  a mirror must be readable in fifty years by someone with no help.
- **Small by construction:** the operational record is Tier 1 (PD14) —
  kilobytes to megabits per sol per asset. Years of fleet operations fit
  on storage a university library will not notice. Smallness is a
  preservation feature, not just a bandwidth one.

### 9.3 Mechanism, cadence, succession

- **Continuous replication**, not periodic dumps — the record is an
  append-only stream and mirrors follow it live. Verification audit (every
  mirror confirms chain integrity) at each synodic review (7.0).
- **Custodian agreements** name the obligation plainly: retain
  indefinitely, serve publicly, and continue both if the Institute ceases.
  Custodial costs are small and funded from the endowment (5.5), so
  custody survives the same revenue drought the Institute might not.
- **Timing:** the guarantee must be in force before the first Rung 1 field
  campaign opens its record — which is why the format spec is a Gate 0→1
  deliverable (G1-3) and the first custodian agreements are a founding
  follow-on task, not a someday item.

### 9.4 Scope

Covered by the guarantee: everything the allocation system produces —
directives, contestations, resolutions, readiness grades, override
signatures — including sim-tier campaigns (4.5), which are real allocation.
Not covered: casual gameplay telemetry, which is Studio product data, not
the record.

### 9.5 Residual

Named-partner selection is conversations, not design, and it needs the
Institute to exist first. The candidate classes above bound the search;
the agreements are drafted against 9.3's obligations at founding.

## 10. Application Software Design — SEPARATE WORKING DOCUMENT

The Rung-0 game, evolving world/belief model, simulation core, Blender boundary,
autonomy runtime, directive workflow, and later fleet-software seams are worked
in [`application-software-design.md`](application-software-design.md). That
document implements the constraints established here and in the mars master and
standalone paper; it does not own or silently revise program decisions.
The first executable baseline is [implementation brief v0.2](vertical-slice-implementation-brief.md),
with [v0 contracts and examples](contracts/v0/README.md); PC2 records its
2026-09-09 reconciliation. Runtime acceptance remains a separate gate.
The [first executable spine profile](first-spine-profile.md) records its explicit
transport-only scope and provenance rules (PC3).

---

## Session Log

- **2026-07-28 (v0.1):** Repo established (PD1). PQ register seeded from the
  program-level gap analysis conducted against the master outline and the
  standalone paper (draft 0.1).
- **2026-07-28 (v0.2):** PQ1 and PQ2 resolved first pass. Rung gates built at
  Section 1 (PD2: criteria-not-dates, plateau-not-death, gates make the
  funding case; four gates, thresholds parameterized to spec freeze). Ten-killer register
  built at Section 2 (PD3: legitimacy as master killer, public record as
  primary defense, two design-time mandates — governance separation PK7,
  published loss budget PK4). Gates and register cross-referenced as duals,
  mirroring the master's 0.4/0.5 structure. Notable couplings surfaced: the
  formal Q18 schema becomes a Gate 0→1 deliverable (G1-3); Candidate A
  ice-corridor characterization named as leading PK3 fallback campaign;
  record-over-imagery downlink priority (PK6) protects legitimacy under any
  bandwidth.
- **2026-07-28 (v0.3):** Wording pass on Sections 1–2 after owner review:
  replaced finance/marketing shorthand ("prospectus," "hit-scale sales,"
  "the ask," "eight-figure," "cashed in," "Foldit-class") with explanatory
  language. No claims or criteria changed — phrasing only, so no PC entry.
- **2026-07-28 (v0.4):** Availability criteria added (PC1, PD4) after owner
  review caught the silent assumption that externally-operated infrastructure
  (commercial lunar delivery, Mars-capable heavy lift, relay) will exist when
  the program is ready for it. Every gate now carries an availability block
  beside its readiness criteria; PK11 ("the ride never materializes") added
  to the register as its only killer wholly outside program control;
  smallest-viable-payload-class named as the third design-time mandate,
  effective when fleet hardware design begins.
- **2026-07-28 (v0.5):** PQ3 resolved first pass at Section 3, after
  discussion closed three forks by owner decision: Studio wholly owned, never
  licensed (PD5); board-seat questions (university for credibility,
  constituency for the agency thesis) deferred, not dropped (3.6); US
  incorporation (PD7). Campaign authority designed as an office of the
  Institute (PD6). Four constitutional commitments named as founding-document
  material. Residuals: record-escrow partners (PQ9), export determination
  (PQ10, raised to High — it shapes the architecture split and gates G2-5).
- **2026-07-28 (v0.6):** PQ4 resolved first pass at Section 4 (PD8–PD11),
  promoting the paper's Section 9 design direction into designed prose:
  state-vector allocation (five currencies, risk budget first-class); two
  tracks converging on shared campaigns with mixed rosters, a
  charter-protected qualification-track share, and allocation never sold;
  two disclosure clocks (operational record fast + safety events immediate;
  science data observatory-style); stewardship reputation tracking granted
  state against declared plan, with an appealable consequence ladder.
  Numbers parameterized to the campaign contract template (new PQ11).
  Master Q17 adoption deliberately deferred until the repo goes public (4.8).
- **2026-07-28 (v0.7):** Owner review of Section 4's defaults: both upheld,
  with one refinement to PD9 — institutional memberships may reserve
  team-roster seats, filled only by individuals holding current
  qualification (money reserves capacity, never competence; unfilled seats
  lapse to the qualified pool). Rationale: institutions hold deep qualifier
  pools, and the platform is the training tool, so the seat fee purchases
  training-pipeline adoption — revenue coupled to the program's own
  instrument without touching outcomes. Charter-protected share (PD9)
  confirmed as-is.
- **2026-07-28 (v0.8):** PQ5 resolved first pass at Section 5 (PD12–PD13).
  Order-of-magnitude cost anchors from public comparables (each rung ~10×
  its predecessor; each fundable by a different kind of money); revenue
  streams sized honestly — the funding inversion restated as "revenue funds
  the proving; proof buys the partnership," with game revenue capped at
  carrying Rungs 0–1 in the plan of record. Conflict doctrine set (PD12):
  revenue always yields; science/constituency conflicts are design errors
  resolved structurally. Naming rights resolved as explicitly informal
  discovery dedications (IAU nomenclature is not for sale). Institutional
  durability: charter functions on durable streams, endowment sized for
  indefinite record custody. Bottom-up numbers spun off to PQ12.
- **2026-07-29 (v0.9):** PQ6 resolved first pass at Section 6 (PD14–PD16).
  The central decision: the PK6 data tiers bind to different physical
  links — Tier 1 (the record) closes over direct-to-Earth capability every
  asset class carries, with zero relay in existence, so relay loss can
  throttle science but never accountability. Relay procurement ladder ends
  in a program-owned smallsat backstop (the plan closes without anyone's
  permission); Marslink is windfall, never plan-of-record. Bandwidth joins
  latency (D42 pattern) as a taught variable: downlink scarcity is gameplay
  from Rung 0, injected at Rung 1, real at Rungs 2–3. Technical
  follow-through spun off to PQ13.
- **2026-07-30 (v0.10):** PQ7 resolved first pass at Section 7 (PD17) —
  the last of the seven founding gaps. Timeline framed as a pacing model
  so it cannot reverse the criteria-not-dates doctrine: earliest-credible
  arc of ~16 years founding-to-Mars (Gate 0→1 ≈2030–31, Gate 1→2 ≈2034,
  lunar fleet ≈2036–37, Gate 2→3 ≈2038, Mars launch at the 2040–42
  windows), with the honest reading stated — revenue from ~year 3, science
  from ~year 5, permanent off-Earth operations from ~year 10, every
  intermediate state a stable resting point. Window-fever rule: no
  manifest commitment before gate passage. Synodic tick = standing program
  review. No new PQ; the model refreshes at every review.
- **2026-07-30 (v0.11):** Cold read-through of the full document after the
  seven-gap sweep (owner-requested). Replaced stock metaphors with everyday
  wording ("load-bearing," "street address," "the X is the point," "lever,"
  "the extensibility play," repeated "honest/honestly") and cut phrases
  that carried no meaning ("precisely," "quietly," "simply," decorative
  clauses). Standardized reference forms (PD4(c), PK6(b)). Section titles
  4.5, 5.2, and 7.2 simplified. No claims, criteria, or ledger meaning
  changed — phrasing only, so no PC entry. "Honest record" kept where it
  names one of the program's four promises (PD3, 2.0).
- **2026-07-30 (v0.12):** PQ8 resolved at Section 8 (PD18) after working
  the naming through concrete usage examples with the owner. Tiered
  architecture adopted (owner: "room to grow into"): Open Exploration
  Institute over the Open Prospector Program, game named later by the
  Studio inside Institute rules. Nothing renames today. Umbrella membership
  test recorded (scarce/hazardous instrument + latency/bandwidth constraint
  + science + public agency), with candidate future programs noted as
  capacity, not commitments — deep ocean the strongest non-space case.
  Name clearance spun off as PQ14; SD10 adoption deferred with 4.8.
- **2026-07-30 (v0.13):** PQ9 resolved first pass at Section 9 (PD19).
  Record escrow follows the digital-preservation many-mirror model, with
  one addition the program is positioned to make: custodianship is a
  consortium membership function — member libraries hold full mirrors, so
  a captured or failed Institute cannot recall the record. Three custodian
  classes minimum; anyone may mirror. Format requirements (append-only,
  hash-chained, self-describing, open, small) written as constraints on
  the G1-3 formal spec. Custody endowment-funded with continuation
  obligations; agreements in force before the first Rung 1 campaign
  record opens. Named partners deferred to founding (9.5).
- **2026-09-07 (v0.14):** Added Section 10's pointer to the separate application
  software design discussion draft. No program decisions or ledger entries
  changed; the pointer preserves the program/software scope boundary while
  making the downstream design discoverable from the governing document.

- **2026-09-09 (v0.15):** Reconciled supporting software contracts and handoff
  language (PC2); added static contract examples and validation. No program
  policy adoption or implementation acceptance is implied.

- **2026-09-09 (v0.16):** Created milestone 1 and ten dependency-linked issues;
  implemented the first fake-endpoint transport spine (PC3). Full scenario and
  human/terrain gates remain separate.
