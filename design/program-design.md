# Open Prospector — Program Design (Living Document)

**Version:** v0.4
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
| PD3 | **Program mission assurance follows the D39 discipline: an enumerated killer register (Section 2), each killer de-singularized, mitigation matched to timescale.** The program's master killer is **legitimacy** — public trust that its promises (real agency, real hardware, open access, honest record) are being kept — and the public record is its primary standing defense. Two mitigations are design-time mandates that cannot be retrofitted (the D29 pattern): governance separation of powers (PK7) and the published loss budget (PK4). | 2026-07-28 | The settlement's register names power as the master killer because every other failure cascades through it; the program's failures (scandal, capture, social rejection) cascade through legitimacy the same way. Naming the design-time mandates now, before any institution is founded, is the whole value of doing this early. |
| PD4 | **Every gate carries two kinds of criteria: readiness criteria (what the program must demonstrate — under its control) and availability criteria (what external actors' infrastructure must provide — not under its control). Availability is verified at gate time as a purchasable service or a signed manifest, never assumed from roadmaps or announcements.** Consequences: (a) external non-availability plateaus the program exactly like an unmet readiness criterion — the D17 ladder's rung independence is the insurance policy, and Rungs 0–1 deliberately require no space infrastructure at all; (b) fleet elements are designed to the **smallest viable payload class**, so the set of possible rides is as large as possible — a fleet only one provider can deliver inherits that provider's priorities; (c) while a rung waits at a gate, its availability criteria are re-verified every synodic window, because external infrastructure can regress as well as advance. | 2026-07-28 | The master's D5 treats launch as "an interface, not our problem" — correct for design work, dangerous for gating: an interface still has to exist before you can buy it. Caught by owner review (PC1). |

## Corrections Log (PC)

| # | Version | Correction |
|---|---------|------------|
| PC1 | v0.2 → v0.4 | **Owner review caught a silent assumption.** The v0.2 gates tested only what the *program* must demonstrate (readiness), assuming the external infrastructure each rung rides on — commercial lunar delivery, Mars-capable heavy lift, relay capacity — will exist when the program is ready for it. But lunar delivery programs get scrapped for technical or political reasons, and a Mars-capable launch provider can lose interest in Mars; none of that is under program control. **Fix:** every gate now carries availability criteria beside its readiness criteria (PD4), and the never-materializing ride is its own killer (PK11), distinct from PK10's failed launch. |

## Open Questions Register (PQ)

Seeded 2026-07-28 from the program-level gap analysis: the master outline holds
itself to a program-management discipline (phase gates 0.3/0.4, killer register
0.5, who-pays economics 10.2, governance 10.4) that had never been applied to
the Prospector program itself.

| # | Question | Priority | Status |
|---|----------|----------|--------|
| PQ1 | **Rung gates.** What must each rung demonstrate before the next is worth funding? D17 asserts each rung is independently valuable, but no transition criteria exist (master D32 discipline: a gate is a criterion, not a schedule milestone). | High | **RESOLVED first pass (v0.2):** four gates designed at Section 1 under doctrine PD2 (criteria-not-dates; plateau-not-death; gates verify Section 2 mitigations). Numeric thresholds deliberately left parameterized until each gate's spec freeze. |
| PQ2 | **Program killer register.** The D39 exercise run against the *program*: game flops (funding inversion dies), sim-to-real gap discredits Rung 1, PP authority denies Candor access (no fallback campaign named), early public loss-of-asset scandal, fleet attrition breaking the "real drone-hours" promise. Enumerate and de-singularize. | High | **RESOLVED first pass (v0.2):** ten-killer register built at Section 2 under doctrine PD3 (master killer = legitimacy; public record as primary defense; two design-time mandates named). Residuals spun into PQ sub-questions where noted. |
| PQ3 | **Governance & institutional identity.** Who is the campaign authority (Level-3 locks require a named human — of what institution)? Who owns the fleet? Consumer game company vs. observatory-style allocation institution — one entity or two? Export control on a trained autonomy stack. A legal entity must exist before Rung 0 ships. | High | Open |
| PQ4 | **Allocation mechanics** (= master Q17). Peer-review vs. game-qualification tracks, campaign mechanics, proprietary periods. Design direction already accumulated in paper Section 9: allocation prices *state* not time; contractual exit conditions; return-to-readiness intervals; stranded-cost policy and the demotion ladder. Promote into designed prose + decision entries. | Med | Open — raw material in paper Section 9 |
| PQ5 | **Economics with numbers.** "Each rung independently fundable" has never been costed, even order-of-magnitude (game-studio scale vs. CLPS-mission scale vs. flagship scale). Also: the three program products (science, constituency, revenue) have no stated priority for conflicts — e.g. discovery naming rights (revenue) vs. IAU nomenclature rules. | Med | Open |
| PQ6 | **Comms & data dependency.** Public-by-default record implies serious relay capacity; Marslink (D6) is a settlement asset Rung 3 may predate; DSN time for a crowd-directed private fleet is unsolved. Nobody owns this interface. | Med | Open |
| PQ7 | **Timeline.** Map the rungs onto synodic windows, even coarsely (the D3 clock governs Rungs 2–3; Rungs 0–1 are calendar-driven). | Med | Open |
| PQ8 | **Program naming.** "Open Prospector" is Mars-flavored and extraction-flavored; Section 12.6 already argues the architecture is a capability, not a mission ("OpenExplorer" floated 2026-07-28). Interacts with the site's SD10 umbrella-branding deferral. No -ify names. | Low | Open |

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
   external actors that the next rung rides on, which may simply never be
   built, whatever the program demonstrates. Availability is verified at gate
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
- **G0-3 Institutional seed (PQ3).** A legal entity able to ship a consumer
  product exists, with the governance separation of PK7 reflected in its
  founding documents — the one thing that cannot be bolted on later.

**Availability (PD4):** already satisfied — the terrain archives (HiRISE,
MOLA, CTX) are public data, downloadable today, and a consumer game needs no
space infrastructure. This is the only gate with no external dependency, which
is precisely why the ladder starts here.

### 1.2 Gate 0→1 — "worth buying hardware"

Protects the Earth-analog fleet commitment (university-budget scale, but the
program's first physical capital). Verifies mitigations for PK1, PK9; sets up
the measurement of PK2.

- **G1-1 Funding inversion demonstrated — or honestly retired.** Either game
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
  than an impression. *(Sets up PK2 — Rung 1's mission is to find everything
  the sim got wrong; that mission needs a ruler.)*

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
  *[spec freeze]*, and — the vetting claim's load-bearing test — **game-derived
  qualification predicts field performance** (leaderboard rank correlates with
  field campaign outcomes). *(PK2)*
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
  real regulatory and international-participation constraints, not analog
  courtesy.

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

One present-tense note before the register: at the design phase the realest
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
| PK5 | **Fleet attrition breaks the drone-hours promise** | Attrition plus no replenishment shrinks real allocation until qualification becomes decorative; the constituency sours into the program's loudest critics | (a) Demotion ladder keeps degraded assets productive (mobile → fixed station → parts donor, per the Q17 direction, Spirit-at-Troy precedent); (b) sim-tier campaigns are *honest* allocation (forward-planning reconnaissance is real contribution, not a consolation prize — D17); (c) buying replacement drones is standing program policy, written into every rung's funding request (G3-4); (d) the allocation design says plainly that more teams will qualify than can ever be served, rather than letting each team discover it (PQ4). | Preventable / chronic → strategic |
| PK6 | **The comms bottleneck starves campaigns** | Public-by-default record + imagery-hungry science vs. thin relay capacity: DSN allocation for a private crowd fleet is tiny, and Marslink (D6) is a settlement asset Rung 3 may predate | (a) Own the interface early (PQ6 remains the design vehicle); (b) tier the data budget: the *record* (directives, contestations, resolutions — small) has absolute priority over raw data volume, so the program's integrity never throttles even when its bandwidth does; (c) commercial deep-space relay services are an emerging market — capacity can increasingly be bought rather than built; (d) onboard summarization rides the same autonomy stack. | Preventable / chronic |
| PK7 | **Institutional capture** | A funder, partner agency, or the game company's commercial owner captures allocation; the public tier is squeezed out; "Open" becomes marketing | The DMS-descended separation of powers already inside the protocol extends to institutions: **the revenue entity never controls allocation; the allocation authority never depends on revenue performance** — two bodies, or one body with constitutionally separated organs (PQ3 decides which). Founding-document material, the D29 pattern: cannot be retrofitted (PD3 design-time mandate). The public record makes capture visible; visibility plus a constituency of thousands is the enforcement mechanism. | Preventable at founding only / chronic |
| PK8 | **Export control closes the "Open"** | ITAR/EAR classification of the trained autonomy stack or twin blocks international teams — or blocks launch integration — gutting open access | (a) Early formal determination (PQ3 work item, verified at G2-5); (b) architectural split: the *directive interface and record* are open by construction; the flight stack can be controlled without closing the program's front door; (c) international-payload precedents exist today. Worst case: openness lives at the directive layer while the stack stays domestic — degraded, not dead. | Survivable / chronic |
| PK9 | **The protocol fails socially** | Rung 0 reveals humans hate being refused by machines at scale: counter-proposal acceptance is low, rage-quit dominates, the cultural bet (paper 4.7) inverts into resentment | This is precisely what Rung 0 exists to discover at the cost of a video game rather than the cost of flight hardware (the game corpus is the spec's test suite — decided, D17). Iterate the grammar at game speed: ladder tuning (more Level-1 auto-substitute, less Level-2 hold), counter-proposal phrasing, the five-move family's learnability. G1-3 makes social viability a *gate criterion*, so the bet is never carried to hardware unexamined. | Preventable (by Rung-0 iteration) / delayed |
| PK10 | **Seed-fleet delivery loss** | One launch failure or EDL failure — canyon EDL (Q12) being the hard case — erases the entire Rung 3 investment in a single event | Classic single-point failure; de-singularize the manifest: (a) fleet split across ≥2 launches/landers (the multi-modal fleet splits naturally); (b) first campaign designed to be scientifically viable with a partial fleet; (c) EDL risk isolated from fleet risk — land on benign terrain and traverse in, vs. canyon EDL, is a Q12 trade the mission plan must close (G3-4); (d) insurance and a replenishment slot in the next window (the D3 clock as recovery margin). | Preventable / acute |
| PK11 | **The ride never materializes** | The external infrastructure a rung depends on is never built, rather than failing on the pad (contrast PK10): lunar delivery programs scrapped for technical or political reasons; the Mars heavy-lift provider loses interest in Mars and no successor appears; relay capacity never deployed. The program is ready; the world declines to show up. | The program cannot build heavy lift; absorb and hedge: (a) the plateau doctrine (PD2) is the deep insurance — Rungs 0–1 need nothing launched, every rung is a stable resting state, and waiting costs the program its schedule but not its existence; (b) maximize the set of possible rides — design fleet elements to the smallest viable payload class (PD4) so any delivery vehicle above that class is a candidate, and treat non-US providers as real options; (c) the program is itself a demand signal — a funded, manifest-ready payload, a qualified user base in the thousands, and a public constituency are arguments *to* a wavering provider that a Mars (or lunar) market exists; (d) re-verify availability every synodic window rather than assuming it once (PD4) — infrastructure regresses as well as advances. | Survivable-only / chronic → strategic |

### 2.2 Reading the register

- **The cascade check (D39's power test):** PK4, PK7, and PK9 kill through
  legitimacy directly; PK2, PK5, and PK8 kill through it at one remove (each
  breaks a promise the constituency was recruited on). Only PK10 and PK11
  kill without touching legitimacy — one by losing the ride, one by never
  getting a ride at all — and PK11 is the register's only killer wholly
  outside program control. Defending the public record — its
  completeness, its priority on the downlink (PK6-b), its independence from
  the revenue entity (PK7) — is therefore the program's single
  highest-leverage mission-assurance investment.
- **The two design-time mandates (PD3):** governance separation (PK7) and the
  published loss budget (PK4) must exist in founding documents and first
  campaign contracts respectively. Everything else in the register can be
  built when its rung arrives; these two cannot. A third joins them the day
  fleet hardware design begins: the smallest-viable-payload-class rule
  (PD4(b), serving PK11) — a fleet designed around one provider's unique
  vehicle cannot be re-designed when that provider's priorities change.
- **Residuals spun off:** the fallback-first-campaign design (PK3) belongs to
  the Rung 3 mission plan; the export-determination work item (PK8) joins PQ3;
  the data-budget tiering (PK6) joins PQ6. The register tracks them; the
  design work happens in those sections.

## 3. Governance & Institutional Identity (PQ3)

*Stub.*

## 4. Allocation (PQ4, master Q17)

*Stub — start from the design direction accumulated in the standalone paper,
Section 9.*

## 5. Economics (PQ5)

*Stub.*

## 6. Communications & Data Interface (PQ6)

*Stub.*

## 7. Timeline (PQ7)

*Stub.*

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
