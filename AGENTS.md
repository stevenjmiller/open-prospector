# Working on Open Prospector

Read README.md, CLAUDE.md, and the relevant sections of the implementation brief.
The program ledger is authoritative locally; master D/C/Q decisions belong to
mars-colonization. Preserve PD/PC/PQ numbering and record semantic corrections
before code depends on them. Never use the section symbol.

## Implementation workflow

- Track deliverables in GitHub milestone 1; dependencies and acceptance evidence
  are in issues 1-10. The fake-endpoint spine remains the integrated runner;
  issue 5 adds independently tested synthetic-world and observer-belief components.
  Issue 6 adds planner, sensor and lineage-budget components; controller and full
  scenario integration remain later work.
  Issue 7 adds real endpoint controller/IPC evidence; issue 8 still owns campaign
  chain integration, delivered-evidence closure and replay acceptance.
  Issue 8 adds the separate synthetic-campaign-v0 archive and human walkthrough.
  Use `npm run campaign -- run <new-directory>` for the full synthetic run;
  `verify`, `audit`, and `replay` check its artifacts and explain decisions.
  Issue 9 supplies the reviewed Candor fixture; `npm run terrain` verifies it.
  Never alter reviewed crop offsets, source/tool identities or frozen layer hashes
  to rescue a test. The facilitated participant gate remains issue 10.
- The lead owns integration, root tooling, shared contracts and spec corrections.
  Delegate only bounded independent work with explicit file ownership. Subagents
  share the checkout unless an isolated worktree was actually created.
- Use at most two workers alongside the lead initially. Use an independent
  reviewer for critical boundary changes. Workers report changed files, tests,
  unresolved assumptions and limitations; they do not independently merge.
- Never solve a failing golden test by silently changing the fixture or contract.
- Shared schemas originate in design/contracts/v0. The build copies them into
  packages/contracts/schemas; never edit generated copies independently.
- Mission control may depend on contracts, deterministic, belief, channel and
  record. It may not import autonomy, simulation-world or endpoint implementation.
  Fleet endpoint may depend on contracts, deterministic, belief, autonomy and
  simulation-world; never channel, record or mission-control implementation.
- PC9 permits a local read-only archive viewer with observer-scoped responses.
  Production rendering, database, real models, flight safety claims and signing are out of
  scope. Fake-spine success is transport evidence, not science/autonomy evidence.

## Commands and completion

Use the pinned Node/npm versions. Run `npm ci`, `npm run check`, and `npm run spine`.
`npm run lint` checks architecture imports. `npm test` builds and runs contracts,
component and two-process tests. CI runs Windows and Linux and compares canonical
chain/checkpoint output. A failed or missing remote CI result is not a pass.

Tests should challenge observable behavior and boundary violations. Keep tests
independent of implementation helpers where a known-answer vector is possible.
Issue closure requires its actual acceptance evidence; the full slice stays open
until terrain, autonomy, real-data and human-check gates are satisfied.
