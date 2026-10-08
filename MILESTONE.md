# MILESTONE.md

High-level milestones. See [`PROGRESS.md`](PROGRESS.md) for the session log. Deadline: **2026-10-08** (Bitget AI Base Camp Hackathon S2). Updated 2026-10-08.

| # | Milestone | Status | Notes |
|---|---|---|---|
| M1 | Public-data pipeline live (E1 recording, E2 instruments and rules, E3 trap) | **DONE** | 241 pairs, 44,000+ hash-chained records, 520 discount-rate entries, 243 real maintenance ladders |
| M2 | Gate A: headline measurement | **PARTIAL** | confirmed freeze and thaw in 2 thin pairs; liquid-name confirmation needs the 2026-10-09 to 12 weekend (after the deadline). Stated as `PARTIAL` everywhere. |
| M3 | LLM layer | **DONE (Gemini live, Qwen built)** | provider-agnostic; Qwen untested for lack of a key; template fallback always available |
| M4 | Mechanism: kernel, surface, contour, optimizer, invariants | **DONE** | deterministic, fail-closed, property-tested |
| M5 | Proof pipeline: bench, break campaign, manifest, offline verifier, CI | **DONE** | 12/13 break attacks, 7/7 offline checks, 27 tests, CI on every push; B13 is time-blocked |
| M6 | Product: six routes, real data | **DONE** | deployed at isopleth-blue.vercel.app |
| M7 | AI layer: guarded narration, Ask bar with tool trace, MCP server | **DONE** | number-binding guard; rule-routed Ask bar; six read-only MCP tools |
| M8 | Measured reference-lag replay | **DONE** | `/scenarios`, `pnpm replay:build` |
| M9 | Verifiable receipts | **DONE** | API, Ask bar, MCP, offline verifier |
| M10 | QA and polish | **DONE** | Playwright and axe layout checks, Lighthouse, screenshots |
| M11 | Submission: README, video, X post | **DONE** | video and post live (links in README); `SUBMISSION.md` final |

## Open after submission

- Confirm a liquid-name freeze and thaw over 2026-10-09 to 12; re-run `pnpm bench`, `pnpm discovery:e4:replay` and break attack B13.
- Wire Qwen when a key is available; resolve C5 and C6 with an optional read-only key probe.
