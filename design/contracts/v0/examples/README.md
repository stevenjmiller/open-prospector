# Reconciled v0 contract examples

These are protocol conformance examples, not a generated simulator run or golden
route corpus. `negotiation.json` supplies the complete original directive,
embedded alternatives, local acceptance, revised directive, outbound IPC frame,
and three scheduled messages. Hashes, byte counts, message ids, FIFO scheduling,
and the ten-tick response are calculated from these exact payloads. Scenario
geometry, alternative scores/summaries and evidence references are illustrative;
they do not certify the synthetic planner's golden assertions. A runtime golden
trace must replace that illustrative evidence in the implementation tests.

The vantage revision preserves the original science target and sets a separate
observation cell. Only that cleared revision crosses back to the asset; the
acceptance itself remains a local record event embedded in the revision.

`budget-exhaustion.json` demonstrates the next 100 mm step after all 200,000 mm
of traverse has been spent: fail without moving or debiting the step, preserve
the previous usage, and emit a Tier-1 endpoint event. It is a boundary test, not
the successful scenario's resource usage.

`no-alternative.json` and `no-alternative-transition.json` show recovery from
safe-hold when both candidate sets are empty: an empty Level-3 contestation,
then a linked locked transition. An empty Level-2 contestation is invalid.

Run the static checks with Python 3 and `jsonschema==4.26.0` installed:

```text
python design/contracts/v0/validate_examples.py
```

This review utility is independent of the Node reference runtime. It checks all
schema definitions, existing fixture documents, new examples, hashes, timing,
revision inheritance and selected rejection cases. It does not implement the
runner or prove its behavior. The implementation must port these cases to its
Ajv validators and add the following execution gates:

| Case | Required observable result |
|---|---|
| Successful delayed negotiation | No controller access to hidden scenario data; embedded alternatives are sufficient; linked revision reaches asset after response and channel delays. |
| Endpoint audit transport | Receipt, hold, reflex, classifier, recovery, completion and their causal evidence appear exactly once, at channel delivery time. |
| Budget boundaries | Equality permits non-time debit; one unit beyond each ceiling fails before work; duration/deadline fail at equality; all counters survive revision and replan. |
| No safe recovery | Alternatives present means Level 2; none means Level 3; no empty Level-2 payload. |
| Scheduling ownership | Multiple parent/endpoint messages at one tick get unique ordered ids; endpoint never sees queue state; incomplete emit/done transaction publishes no buffered intents. |
| Terminal drain | Late Tier-2 evidence is applied before closure; queued commands after terminal do not restart execution; missing content or missing closure is incomplete. |
| Truth isolation | Change hidden raster and scenario metadata independently; both observer inputs stay unchanged until a permitted observation. |
| Compatibility | Replay archived inputs on both platforms; actual replay host is in the verification report, not substituted into the original manifest. |

The headless slice is complete only when those runtime gates and the parent
brief's other acceptance tests pass. Static validation alone is not that gate.
