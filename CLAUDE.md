# Agent instructions — open-prospector

Read `README.md` first. It defines this repo's scope (program-level design for
the Open Prospector program), its ledger discipline, and its relationship to the
`mars-colonization` repo.

## The one boundary that matters

- The mars master outline (`C:\Projects\mars-colonization\outline\mars-colonization-outline.md`)
  is the source of truth for **decided** material. Never restate its decisions
  here as if this repo owned them — cite them (D16, D17, D42, Q17, Q18, ...).
- This repo's own ledger entries use the **PD / PC / PQ** prefixes. Bare
  D / C / Q tokens refer to the master's ledgers.
- Design work matures here, then is **adopted back** into the master (or the
  standalone paper) as an explicit act — mirror of the master's own discipline.
  Record the adoption in both places when it happens.

## Working rules

- `design/program-design.md` is the governing document; amend its ledgers rather
  than drifting. New sections start as stubs in that file and move to their own
  file under `design/` only when they outgrow it (leave a pointer behind).
- This repo is **private**; nothing here auto-publishes. Publication to the
  program portal site happens from `mars-colonization` via its SD11 registration
  workflow, never from here.

## Style

- Never use the section symbol (§). Write "Section 4" or "(4.5)".
