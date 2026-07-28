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

## Style

- Never use the section symbol (§). Write "Section 4" or "(4.5)".
- Convert relative dates to absolute dates in all ledger entries.
