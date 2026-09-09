# Planning, sensors and budget components

Issue #6 implements the frozen algorithms in the implementation brief, Sections
6.4 and 8.1–8.3. It remains component evidence: controller transitions, clearance,
accepted-alternative verification, classifier use and final science/evidence
completion are subsequent issues. No fixture bytes or golden positions changed.

Run `npm run planning -- artifacts/my-planning-evidence.json` after installation.
The new output file contains structured alternatives, their routes and budget
deltas, the scheduled candidate route, observation hashes, precontact stop pose,
reflex inputs, preserved budget usage and a safe recovery plan. The privileged
test harness explicitly supplies a linked revision to exercise these components;
it does not impersonate an accepted/cleared mission transaction. The transport
runner continues to use its separate fake-endpoint profile.

## Geometry and planning

Shared contracts implement the exact saved-error Bresenham rule, waypoint
expansion, cell centres, adjacent edge lengths and octile distance. These pure
functions have no truth access. A* consumes only the observer's cell interface.
Its queue sorts by f ascending, g descending, row and column ascending. Equal
labels retain discovery order under the frozen eight-neighbour sequence.
Envelope, obstacle and public no-go cells block occupancy and diagonal corner
crossing. Slope is an edge constraint; unknown endpoints skip slope/climb energy
and add the frozen unknown penalty. Uncertainty does not affect route cost.

The search retains nondominated labels in route cost, traverse, energy and
duration. Otherwise a cheap, energy-expensive prefix could erase a feasible
route under a remaining budget. This is an exact finite search with no silent
node cap or approximate result; pathological resource-constrained grids can be
expensive. Low-level `planRoute` accepts explicit remaining resource limits;
`planDirective` derives those limits from the lineage ledger, including reserve,
earliest start, transit/hold time, deadline and duration. Callers must use the
directive entry point for executable plans. If D positive-motion ticks begin at
S, the last step is S+D-1 and must precede the deadline/duration boundary.

Alternative generation returns vantage then target, subject to the directive's
permissions. It uses the frozen annulus, route-score and ID tie rules and the
observer catalog, excluding the original entity from target substitution.
Budget deltas compare the expanded advisory route or direct Bresenham fallback,
including ordinary edge costs on blocked cells in that comparison baseline.
Missing candidate kinds are omitted; the later controller owns contestation
reasons and Level-2/Level-3 selection. Standoff eligibility uses squared Euclidean
cell-centre range (at most 400 cell units squared), known target and believed
line of sight. It does not manufacture a science artifact or success evidence.

## Sensing and motion

The privileged simulator adapter alone samples truth. Sweeps include the complete
clipped radius 20 circle. Runtime range uses remaining distance to future cell
centres, inclusively 1–3,000 mm; contact distance subtracts 500 mm or 707 mm on the final
edge. This resolves the otherwise ambiguous range reference separately from the
specified entry-boundary contact reference. The footprint includes all in-range
cells even beyond the first obstacle, sorted row then column. Revealed hazard
metadata includes only cells within the footprint, not the hidden hazard extent.
An already-entered obstacle produces signed contact distance rather than falsely
claiming a safe stop. The reflex helper clamps T to zero and never calls a model.
The later controller must suppress motion on the detection tick.

EdgeMotion advances at most 100 mm once per executing tick, with 15 ticks per
diagonal and no carried remainder. It debits full edge energy on first positive
progress and actual traverse on each step, atomically before pose changes.
Abandoning an edge returns occupancy to from_cell without refunding its debits.
The controller owns safe edge selection and ties one motion object to one ledger;
the primitive does not grant authority or validate a supplied edge against truth.

## Budget lifecycle and evidence

LineageBudget preserves submitted time, original ceilings and reserve across
linked revisions. Explicit ceiling/time failure freezes pre-debit usage for the
failure event; reserve refusal preserves the ledger for alternatives or locking.
Tier 2 reservation validates and counts the entire canonical payload, including
base64 overhead; it is one reservation per enqueue, not an idempotent queue API.
The caller decides whether optional evidence is omitted before reserving it.
Terminal counters remain frozen. Message delivery, mandatory evidence and final
completion guards remain controller responsibilities.

Tests cover route/geometry ties, slope boundaries, unknown penalties, blocked
corners, exact budgets/reserve, immutable revisions, abandoned-edge debits and
sensor disclosure. The frozen vantage (180,70) passes through hidden rock (205,45);
the target alternative is (185,95). Repeated component trajectories and an
unsensed truth/scenario mutation produce identical canonical evidence. CI compares
the complete component evidence bytes across Windows and Linux alongside the
existing spine output. This is not full-scenario or physical-rover acceptance.
