# MILESTONE.md

High-level milestones only — see [`TASK.md`](TASK.md) for the granular checklist
and [`PROGRESS.md`](PROGRESS.md) for the session-by-session log. Deadline:
**2026-10-08** (Bitget AI Base Camp Hackathon S2, extended from Sep 27).

| # | Milestone | Status | Date | Why it matters |
|---|---|---|---|---|
| M1 | Repo scaffolded; public-data pipeline live (E1 recording, E2 instruments + rules captured, E3 trap confirmed) | **DONE** | 2026-10-05 | Without this nothing downstream has real data to run on. This is also the one thing that is time-sensitive in a way code isn't — every missed E1 tick is unrecoverable, so it had to go first, ahead of all other setup. |
| M2 | Gate A closed (confirmed freeze+thaw, break/proof plan written, DISCOVERY.md complete) | IN PROGRESS | target before Phase B starts | The architectural bet of this whole project (§0) is that the reference-price axis is *measured*, not assumed. Until a freeze+thaw is actually confirmed, that bet is unproven, not just unfinished. |
| M3 | Qwen + MCP wired (E6) | BLOCKED on `QWEN_API_KEY` | pending | Needed before any Qwen-dependent code in Phase E; not needed for Phase B/C, so not a hard blocker on overall progress. |
| M4 | Mechanism built (Phase B: kernel, surface, contour, optimizer, invariants) | NOT STARTED | pending | This is the deterministic core every other claim depends on. Nothing in Phase C-D should be built against a kernel that doesn't exist yet. |
| M5 | Proof pipeline run (Phase C: bench, break campaign B1-B13, manifest, offline verifier) | NOT STARTED | pending | This is what separates a demo from an entry that survives a judge trying to break it. |
| M6 | Product shipped with real data (Phase D: 6 routes) | NOT STARTED | pending | UI imagery already staged (`public/img/`, received 2026-10-05) — ready to use once this milestone starts. |
| M7 | AI layer live (Phase E: route handlers, number-binding guard, template fallback) | NOT STARTED | pending | Depends on M3 and M4. |
| M8 | UI polish (Phase F: fonts, motion, imagery pipeline) | NOT STARTED | pending | |
| M9 | Attack + QA passed (Phase G: full B1-B13, Playwright/axe/Lighthouse) | NOT STARTED | pending | |
| M10 | Shipped (Phase H: README, video, submission, X post) | NOT STARTED | pending | Hard deadline 2026-10-08. |

## Risk register

- **Freeze/thaw not yet observed (M2).** The next real weekend close is 2026-10-09 to 2026-10-12. If the recorder has any gap over that window, the headline measurement slips to the following weekend — with a 2026-10-08 deadline, that would mean submitting on the honest "not yet confirmed" result rather than a confirmed one. Keep the recorder running without interruption; this is the single highest-leverage thing to protect between now and the deadline.
- **QWEN_API_KEY timing (M3).** Qwen is only load-bearing for Phase E; Phases B/C/D don't need it. Not urgent yet, but E6 (the wire/tool-calling probe) should run as soon as the key lands so Phase E doesn't start blind.
- **Tier boundary semantics (U5/U8) still unknown.** Affects B3 (break test for exact-boundary notional) and I3 (tier correctness). Needs either a re-fetched support article or E5 (optional, needs credentials) to close before Phase C's break campaign can claim B3 is handled by verified rule rather than assumption.
