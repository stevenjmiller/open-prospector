# Human testing tutorial

This walkthrough runs the simulated mission, explains its decisions, and checks
that the science evidence reached mission control. It uses a terminal; there is
no interactive rover interface. The mission-side actor accepts alternatives
automatically. Budget energy is an integer simulation unit, not joules.

## 1. Prepare and run

Use Node 24.12.0 and npm 11.6.2. In PowerShell, from this checkout:

```powershell
Set-Location C:\Projects\open-prospector
node --version
npm --version
npm ci
npm run check
npm run campaign -- run artifacts/human-run-1
```

Every output directory must be new. Choose human-run-2 for another run; archives
are never overwritten. The check command runs automated tests. The campaign
command runs the real synthetic endpoint in a separate process and returns
`status: completed`, a chain head and a final state hash. An error or failed
status is a failed test, even if some output files exist.

## 2. Read the mission story

```powershell
npm run campaign -- audit artifacts/human-run-1
$audit = Get-Content artifacts/human-run-1/audit.json -Raw | ConvertFrom-Json
$audit.transitions | Format-Table occurred_tick, received_tick, from, to, reason_code
$audit.contestations | ConvertTo-Json -Depth 20
$audit.accepted_alternatives | ConvertTo-Json -Depth 10
```

The expected sequence is idle, planning, holding, planning, scheduled, executing,
safe-hold, executing, completed. Check these points:

1. The first contestation is Level 2: the rover sees a hazard and offers permitted
   alternatives. It holds while the response travels through the delayed link.
2. The actor accepts the offered vantage. Find the original and revised
   directives in events.ndjson: the target remains the hydrated candidate;
   the observation location changes. Acceptance does not reset the budget.
3. During travel, the second contestation is Level 0. Its structured reflex
   inputs explain why the communication window is shut. The rover stops before
   consuming the classifier result, then replans locally.
4. The classifier result says rock with confidence_ppm 900000. That is a frozen
   test value of 0.9, not measured accuracy or a live model inference.
5. The rover finishes after enqueuing required science. The archive closes later,
   once the evidence is delivered and checked. `occurred_tick` is the rover event
   time; `received_tick` is when mission control learned it. A tick is 100 ms.

For the frozen default scenario the rover completes at tick 9642, with 59032 mm
traveled, 5940 energy units and 848083 Tier-2 bytes charged. These are cumulative
totals. Waiting consumes duration but this model does not charge idle power.
Do not interpret the transition rows as a complete position trace.
The completion notice arrives at tick 12655, the final observation at 12953,
and the drained campaign checkpoint at 12954. These are simulated times, not
the number of seconds the command takes on your computer.

```powershell
$audit.transitions | ForEach-Object {
  [pscustomobject]@{Tick=$_.occurred_tick; State=$_.to; Duration=$_.budget_used.duration_ticks;
    Distance_mm=$_.budget_used.traverse_mm; Energy=$_.budget_used.energy_units;
    Tier2_bytes=$_.budget_used.tier2_bytes}
} | Format-Table
```

Pass if the two contestations, linked acceptance, stop-before-classification and
cumulative accounting tell that story. Investigate a different sequence; do not
change the expected values simply to make a run pass.

## 3. Verify delivered science and closure

```powershell
npm run campaign -- verify artifacts/human-run-1
$events = Get-Content artifacts/human-run-1/events.ndjson | ForEach-Object { $_ | ConvertFrom-Json }
$events | Where-Object event_type -eq received-belief-updated |
  Select-Object occurred_tick, payload
$events | Select-Object -Last 2 | ConvertTo-Json -Depth 10
```

Expect completed verification, a checkpoint and then run-completed. The closure
refers to the preceding chain head and the checkpoint's state hash. The verifier
also checks observation/science bytes and reconstructs mission belief at delivery
time; a valid chain alone is insufficient.

To see the actual final measurements:

```powershell
$messages = Get-Content artifacts/human-run-1/telemetry.ndjson | ForEach-Object { $_ | ConvertFrom-Json }
$science = $messages | Where-Object {
  $_.payload_kind -eq 'observation' -and $_.payload.observation_type -eq 'standoff-image'
}
$science | Select-Object sent_tick, deliver_at_tick
$science.payload.measurements | Format-Table
```

Expect a range within 20000 mm, clear line of sight and a non-indeterminate
spectral class. The measurements are synthetic. observations/ holds full
observations; science/ holds referenced artifact bytes. Hashes are fingerprints
for exact comparisons, not explanations or proof of real-world truth.

## 4. Replay and test a damaged copy

```powershell
npm run campaign -- replay artifacts/human-run-1 artifacts/human-replay-1
```

Expect `replay: byte-identical`. This reruns from archived inputs and fixture
bytes, checks the event-chain head and compares delivered telemetry. It requires
the same source identity; an edited checkout should fail that check.

Finally, deliberately corrupt a copy of the archive, preserving the original:

```powershell
if (Test-Path artifacts/human-damaged-1) { throw 'Choose a new damage-test directory' }
Copy-Item artifacts/human-run-1 artifacts/human-damaged-1 -Recurse
Add-Content artifacts/human-damaged-1/events.ndjson '{}'
npm run campaign -- verify artifacts/human-damaged-1
```

Expect a verification error and nonzero exit code. A corrupted record must never
be accepted as completed. Keep a note of the command, actual result, commit and
archive path when reporting a failure.

This is an engineering walkthrough. It does not replace issue #10's facilitated
test of whether a participant can understand alternatives from the bounded
Tier-1 summary before the full Tier-2 observation arrives.
