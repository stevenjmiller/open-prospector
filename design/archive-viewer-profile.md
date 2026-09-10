# Local campaign archive viewer

PC9 adds a browser library for completed synthetic campaign archives. It discovers
runs under a configured directory and serves them on `127.0.0.1`, with no command
or write API. The browser receives scoped projections and relative folder names,
with no raw filesystem endpoint or truth rasters.
No external assets, account, database, or web framework are required.

## Running it

From the repository root, using the pinned Node/npm versions:

```powershell
npm ci
npm run viewer
```

Open the printed `http://127.0.0.1:4173` address. **Choose a mission archive** lists
runs under `artifacts`; search by folder, run ID or terrain. Opening a card verifies
the run and resets the timeline. Use another card to switch runs in the same page.
An existing archive from the earlier tutorial works: viewing validates its archived source identity without
requiring that identity to equal the current checkout. Executable replay still
requires the matching source. If you need a new archive:

```powershell
npm run campaign -- run artifacts/human-run-2
```

Use a new output directory for a new campaign, then click **Refresh runs** in the
browser. The server stays running and the new run becomes selectable. Discovery
previews are explicitly unverified; corrupt or unfinished campaigns fail on Open
without replacing the display with misleading evidence. Transport-only archives
are listed as unsupported. The library remains usable if a run fails verification.

To browse another collection or use another port:

```powershell
npm run viewer -- C:\Projects\mission-archives 4174
```

Stop with Ctrl+C. Discovery includes nested directories up to four levels below
the root, skips links and environment directories, and caps scanning at 1,000
directories. A visible notice reports truncated discovery; select a narrower
root if needed. An empty collection explains how to create a run.

## Reading the display

- Select **Mission control** to see evidence as it arrives. Select **Onboard**
  at the same tick to see observations already sensed by the rover.
- Scrub time or step through events. Chapter buttons are retrospective story
  bookmarks; they are navigation hints, not evidence available to either actor.
- The map uses the selected observer's initial layers and visible observations.
  Unknown terrain stays unknown. Full observations update mission belief only at
  delivery, even if a Tier-1 summary has arrived earlier.
- Routes are proposed plans. The archive does not record a continuous position
  trace, so the viewer does not animate or infer actual rover positions. The
  start marker stays at the recorded starting location.
- Budgets are the latest visible transition's cumulative counters, not an
  interpolated live meter. One tick is 100 ms; energy is a simulation unit.
- Science measurements appear when the selected observer knows the observation.
  A frozen classifier confidence of 0.9 is not measured model accuracy.

The campaign remains `fixture:synthetic-v0`. The approved Candor crop is separate
terrain acceptance evidence; placing this campaign's route on Candor would imply
a run that never happened.

## Verification and boundaries

The catalog maps opaque IDs to discovered folders within its configured root.
Directory names distinguish archives even when runs share an internal run ID.
Catalog metadata never establishes verification. Every Open checks that archive
paths stay inside the root without links, then `openArchive` calls the existing independent campaign verifier and requires
completed closure. Inputs used for projection are captured, compared after
verification to reject changes during loading, and kept in memory. Later browser
requests for that snapshot never read the archive again. Four immutable snapshots
are kept in an LRU cache. Each view request binds the selected archive ID to its
snapshot token; evicted snapshots require reopening the run. Refresh discovers
new runs without changing an already open snapshot. Reopening verifies current
disk bytes. The observer loaders receive only public
and initial-belief rasters and reconstruct state using the existing atomic
observation API. The verifier itself retains its privileged integrity check of
all fixture layers. No truth raster, hidden scenario hazard list, future
observation, model-binding manifest or source snapshot is sent to the browser.

Asset views reconstruct observation history from a completed archive at
`observed_tick`; they are not independently archived onboard state snapshots.
Mission views apply full observations at `deliver_at_tick`. Mission decisions
appear onboard only when a directive receipt is recorded. Mission state changes
appear when endpoint notices arrive. Summaries, observations and state notices
remain separate evidence types. Completion of the archive and the currently
visible rover state are distinct labels.

HTTP serves fixed UI files and three read APIs: catalog, verified session, and
observer view. It rejects writes and foreign Host/Origin headers and uses no CORS.
Requests use catalog IDs, snapshot tokens, tick and observer, never filesystem
paths. Display text is treated as untrusted text. This local reader is not
an authentication service or a publicly hosted deployment.

## Acceptance

Tests cover observation versus delivery timing, summary-before-detail, mission
actions withheld onboard until receipt, backward seeking without residual
knowledge, missing/corrupt/incomplete archives, and HTTP route/method isolation.
Catalog tests create a second real run after startup, refresh and switch between
runs sharing an internal ID, reject crossed/expired snapshots and linked paths,
and cover empty, malformed and unsupported collections. Browser review checks
run discovery/switching, failure isolation, map geometry, observer switching,
chapter navigation, science visibility, keyboard controls and narrow layouts.

This viewer supports the facilitated participant check in issue #10; neither
automated tests nor the engineering walkthrough satisfy that human gate.
