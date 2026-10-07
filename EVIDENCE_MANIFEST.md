# EVIDENCE_MANIFEST.md

Human-readable index of every evidence artifact this build has produced, what
it proves, how to reproduce it, and its classification (MEASURED / REPLAYED /
SYNTHETIC / UNKNOWN per FINAL_INSTRUCTION.md's definitions). The machine-
readable counterpart that `pnpm manifest` will generate in Phase C
(`data/manifests/run_manifest.json`, with hashes + git commit + lockfile hash)
does not exist yet — that script hasn't been built. This file is maintained
by hand until it does.

Named `EVIDENCE_MANIFEST.md` (not `EVIDENCE.md`) to match the filename the
rest of the build (FINAL_INSTRUCTION.md §5.1, the planned `/proof` route)
already expects.

---

| Artifact | Produced by | Proves | Classification | Reproduce |
|---|---|---|---|---|
| `data/clock/pairs.json` | `scripts/discovery/e2-instrument-scan.ts` | The rToken universe (241 pairs) is discovered live, not hardcoded | MEASURED | `pnpm discovery:e2` |
| `data/clock/instruments-raw/*.json` | same | Raw instrument lists backing the pairing decision, including the 84 correctly-excluded symbols | MEASURED | same |
| `data/clock/rules/discount-rate/ALL_COINS.*.json` | `scripts/discovery/e2-rules-extraction.ts` | The collateral discount-rate tier ladder for every rToken, content-hashed | MEASURED | `pnpm discovery:e2:rules` |
| `data/clock/rules/position-tier/*.json` (244 files) | same | Maintenance-margin tier ladder per stock perp + BTC/ETH/SOL, content-hashed | MEASURED | same |
| `data/clock/rules/manifest.json` | same | Which capture strategy worked (bulk vs per-coin) and the hash of each capture | MEASURED | same |
| `data/clock/e3-fallback-trap.json` | `scripts/discovery/e3-silent-fallback-trap.ts` | F8 (rToken candle type silently coerced to `market`) confirmed live against RTSLAUSDT | MEASURED, CONFIRMED | `pnpm discovery:e3` |
| `data/clock/raw/e1.jsonl` | `scripts/discovery/e1-collateral-clock.ts` | Hash-chained, append-only tick log of `indexPrice`/`markPrice`/spot per pair per minute, since 2026-10-04 ~20:30 ET | MEASURED (accumulating) | `pnpm discovery:e1` (long-running) |
| `data/clock/clock-map.json` | `scripts/discovery/segment-clock.ts` | Classified reference-state segments and every extracted transition, with evidence hashes | MEASURED (derived) | `pnpm discovery:clockmap` |
| `data/calendar/nyse-2026.json` | manual capture via live fetch of nyse.com | The NYSE 2026 holiday/early-close calendar | MEASURED | re-fetch nyse.com/markets/hours-calendars and diff |
| `data/windows/window-set.json` | `scripts/discovery/e4-build-windows.ts` | 31 closed-market windows since the 2026-06-04 rToken launch, pure calendar arithmetic | SYNTHETIC (calendar derivation, no live market data in it) | `pnpm discovery:e4:windows` |
| `data/windows/pre-registration.md` | written by hand, timestamped before any replay | The null-control analysis rule was fixed *before* results existed | N/A (methodology document, not data) | — |

## What does NOT have an entry yet (and why)

- **A confirmed freeze+thaw transition.** Does not exist. See `DISCOVERY.md` E1 section — N=0-so-far, honestly stated, not fabricated to fill this table.
- **`G_w` values / E4 replay output.** The replay script hasn't been built; no post-launch window has both elapsed and been fully recorded yet.
- **Anything from E5.** No credentials supplied; E5 is optional and was never started.
- **Anything from E6 (Qwen/MCP).** Blocked on `QWEN_API_KEY`.
- **`data/bench/results.json`, `data/break/results.json`, `data/manifests/run_manifest.json`, `CLAIMS.json` entries beyond the scaffold.** All Phase C deliverables; Phase C has not started.

## Provenance rule (I1) applied to this file

Every row above links to a script that is actually in this repo and a file
that actually exists on disk as of 2026-10-05. If a future update to this
file adds a row, the same rule applies: no row without a real artifact behind
it.
