# Synthetic terrain and observer belief profile

Issue #5 implements the fixture and knowledge boundaries for the vertical slice.
The transport runner remains the fake-endpoint profile until subsequent issues
connect sensing, planning and the controller. The frozen formulas and hashes in
`design/fixtures/vertical-slice/synthetic-v0.fixture-manifest.json` are unchanged.

`npm run fixture -- artifacts/my-synthetic-fixture` creates a new directory with
eleven headerless rasters, the canonical manifest and a hash report. All generated
bytes are checked before writing. Existing destinations are refused. The build
identity includes the authoritative synthetic manifest and scenario.

The runtime manifest check requires exactly eleven distinct name/scope/encoding
pairs and their materialized lengths and hashes. Authoring schemas still admit
source-selected fixtures; runtime loading does not. Runtime paths are portable,
lowercase ASCII basenames, unique across all scopes. Absolute paths, separators,
drive/stream syntax, reserved Windows names and trailing periods are rejected.
Raster files and the resolved fixture directory must not alias through links;
file identity is checked again after opening. These are local fixture hygiene
checks, not an operating-system sandbox against a concurrent hostile writer.

`loadAssetFixture` and `loadMissionFixture` read only their four initial layers
and public geofence. Their `observerLayers` capabilities reject unauthorized
names before accessing storage. `loadWorld` reads only truth and geofence and
returns scalar samples. Arrays are privately copied; returned cells are frozen.
The generic contract filesystem helper is privileged infrastructure, not an
observer-facing API. Controllers must receive the constructed belief interface,
never a loader, filesystem capability, full scenario, manifest or world object.
Dependency lint prohibits mission control from importing simulation-world.

`projectScenario` belongs to the privileged composition root. It produces fresh
allowlisted fields, omits hidden targets/hazards and their flags, excludes model
outputs and fixture provenance, and selects observer-relevant configuration.
Initial entity IDs remain the frozen directive IDs. Future sensor adapters own
discovery and truth-to-belief entity mapping; this package does not infer it.

Known mask means elevation knowledge. It does not imply hazard knowledge:
synthetic-v0 intentionally has known=1 and observer obstacles=0 everywhere.
Known initial cells require zero uncertainty; unknown initial cells require zero
elevation and no asserted obstacle. Unknown uncertainty comes from the supplied
raster, with no invented default scalar. Elevation and uncertainty updates must
fit signed and unsigned 32-bit raster domains respectively.

Asset observations apply at their observed tick. Mission observations apply at
the scheduled delivery tick through a validated asset-to-mission channel message;
observation time cannot exceed send time. Delivery ticks cannot move backward.
Duplicate observations are refused. All patch and footprint checks finish before
any update commits. Only truth-contact footprints extend the sensed mask. Tier 1
summaries never patch terrain. State hashes cover observer raster/mask content,
excluding truth provenance and hidden scenario metadata; they are view hashes,
not complete replay checkpoints of delivery/deduplication state.

Tests challenge scoped reads, filesystem aliases, invalid manifests and bytes,
frozen vectors, hidden metadata mutations, detached snapshots, atomic failures,
and delayed observations. Sensor footprint generation, unsensed-region planner
behavior, discovery catalog updates and controller integration belong to #6–#8.
This evidence establishes component boundaries, not full autonomous behavior.
