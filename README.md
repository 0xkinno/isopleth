# Isopleth

> Your margin ratio is a snapshot. Isopleth maps the boundary it is sitting
> next to, and shows you the smallest move that keeps you inside it.

Built for the Bitget AI Base Camp Hackathon S2 (Track: AI Trading Desk,
sub-theme: Decision Stress Testing). Submission deadline: 2026-10-08.

**This is a working README for active development, not the submission
README.** The full 30-section structure specified in `FINAL_INSTRUCTION.md`
§12 — screenshots, generated benchmark numbers, the validated claims grid —
gets written in Phase H, once there's a real product and real results to
show. Writing that now would mean fabricating numbers or showing screenshots
of pages that don't exist yet, which this project's own rules forbid
(`FINAL_INSTRUCTION.md`: "never type a number by hand").

## What's actually running right now

A public-data pipeline (Phase A, in progress) that:

1. Discovers the rToken collateral universe live from Bitget's public API —
   no hardcoded symbol list (`pnpm discovery:e2`).
2. Captures the collateral discount-rate and position-tier ladders, content-
   hashed for change detection (`pnpm discovery:e2:rules`).
3. Confirmed, live, a real API trap: rToken candle requests silently coerce
   `type=index/mark/premium` to `type=market` with no error
   (`pnpm discovery:e3`, see `CONTRIBUTIONS.md`).
4. Is recording the public stock-perp reference price every 60 seconds,
   hash-chained, to measure when and whether it actually freezes over a
   market closure (`pnpm discovery:e1` — the project's headline measurement,
   still in progress, see `DISCOVERY.md`).

## Where to actually look

| File | What it's for |
|---|---|
| [`FINAL_INSTRUCTION.md`](FINAL_INSTRUCTION.md) | The full build spec. Read this first. |
| [`TASK.md`](TASK.md) | Granular checklist, every phase, what's actually done |
| [`MILESTONE.md`](MILESTONE.md) | High-level milestones and the current risk register |
| [`PROGRESS.md`](PROGRESS.md) | Session-by-session log, including mistakes found and fixed |
| [`DISCOVERY.md`](DISCOVERY.md) | The E1-E6 discovery results, stated honestly, including what isn't confirmed yet |
| [`CLAIMS.json`](CLAIMS.json) / [`PROOF.md`](PROOF.md) | What's proven, what's unknown, and why |
| [`EVIDENCE_MANIFEST.md`](EVIDENCE_MANIFEST.md) | Every evidence artifact, what it proves, how to reproduce it |
| [`METHOD.md`](METHOD.md) | What's measured vs. modelled vs. unknown |
| [`LIMITATIONS.md`](LIMITATIONS.md) | Stated first, not buried |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System design, annotated with what's built vs. planned |
| [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md) | API traps found along the way, documented for anyone else hitting them |
| [`SUBMISSION.md`](SUBMISSION.md) | Submission skeleton — not to be filled in until there's a real result to report |

## Running it

```bash
pnpm install
pnpm discovery:e2          # instrument scan
pnpm discovery:e2:rules    # tier ladders
pnpm discovery:e3          # confirm the F8 candle trap
pnpm discovery:e4:windows  # NYSE calendar window set, no network needed
pnpm discovery:e1          # long-running recorder - leave it going
pnpm discovery:clockmap    # check classification progress anytime
pnpm typecheck
```

No API key is required for any of the above. Public Bitget data only.
