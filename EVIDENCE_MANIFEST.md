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
| `data/windows/replay-results.json` | `scripts/discovery/e4-replay.ts` | G_w per window, computed ONLY from the recorder's own tick log (never candles, per the F8 trap) — honestly reports 0/31 windows replayable yet | MEASURED (derived, currently empty) | `pnpm discovery:e4:replay` |
| `data/break/results.json` | `scripts/break.ts` | The 13-attack break campaign: 8 verified, 0 failed, 5 honestly `NOT_YET` | MEASURED (derived) | `pnpm break` |
| `data/bench/results.json` | `scripts/bench.ts` | Synthetic account-grid benchmark (optimizer vs. random/proportional controls) + window-set replay status | SYNTHETIC (grid) / MEASURED (derived status) | `pnpm bench` |
| `data/manifests/run_manifest.json` | `scripts/manifest.ts` | Git commit, SHA-256 of every result file, lockfile hash, engine version | MEASURED (derived) | `pnpm manifest` |
| `data/verify/golden.json` | `scripts/golden/build-golden.ts` | Fixed input books + their expected deterministic kernel hash, the baseline `pnpm verify:offline` recomputes against | SYNTHETIC (fixtures) | `pnpm verify:build-golden` |
| `packages/data/src/chainVerify.ts` + `tests/unit/e4stat.test.ts`, `tests/unit/tool-loop.test.ts` | hand-written, unit-tested | The hash-chain verifier (used by both `pnpm break` B8 and `pnpm verify:offline`), the E4 pre-registered statistical rule, and the LLM tool-calling loop are real, tested code, not stubs | N/A (code + tests) | `pnpm test` |
| `docs/lighthouse/*.json`, `docs/lighthouse/summary.json` | Lighthouse CLI against a real `next start` production build | 97-99 performance, 100 accessibility/best-practices/SEO, CLS=0, LCP 2.1-2.6s on every one of the 6 routes | MEASURED | re-run Lighthouse against `pnpm --filter @isopleth/web build && pnpm --filter @isopleth/web start` |
| `docs/screens/*.jpg` | Playwright (Chromium), against a real running build | The 5 screenshots used in `README.md` — not mockups | MEASURED | re-run Playwright against the dev or production server and screenshot each route |

## What does NOT have an entry yet (and why)

- **A confirmed freeze+thaw transition in a liquid name.** Does not exist yet. See `DISCOVERY.md` E1 section — 2 confirmed in thin-liquidity names, the documented session-wide freeze is still unconfirmed in a liquid name, honestly stated, not fabricated to fill this table. Next clean test window: the 2026-10-09–12 weekend.
- **Real `G_w` values.** The replay harness is built and real (see `data/windows/replay-results.json` above) but reports N=0 — no window in `data/windows/window-set.json` has fully elapsed since the recorder started (2026-10-04).
- **Anything from E5.** No credentials supplied; E5 is optional and was never started.
- **A live Qwen call.** Blocked on `QWEN_API_KEY`; Gemini is wired and the `none` driver is proven to carry the whole product correctly in its place.
- **CSV book input beyond a single flat tier per asset.** Documented as a simplification in the CSV format itself (`apps/web/lib/csvBook.ts`); the JSON path carries exact tier ladders.

## Provenance rule (I1) applied to this file

Every row above links to a script that is actually in this repo and a file
that actually exists on disk as of 2026-10-05. If a future update to this
file adds a row, the same rule applies: no row without a real artifact behind
it.
