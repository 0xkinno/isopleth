# LIMITATIONS.md

Stated first, not buried. Updated 2026-10-08.

## The headline measurement is only partly confirmed

The architectural bet is that the reference-price axis is measured, not assumed. What is confirmed: the recording is real and verifiable (44,000+ hash-chained records over 241 pairs), the public reference index is unchanged from the previous tick 17.5% of the time, and two thin-liquidity pairs show a clean freeze and thaw. What is **not** confirmed: the documented session-wide freeze and thaw in a *liquid* name. The recording has not yet passed through a weekend close. The first clean test is the 2026-10-09 to 12 weekend. If the index moves continuously through it, the central bet is wrong and this document will say so. See `CLAIMS.json` C4 (`PARTIAL`).

## The reference-lag replay covers a quiet week

The Clock replay is real data, but it spans a few days with no weekend close. The margin shift it shows is small (a little over one percentage point at the extreme). That is the honest size of the effect in this window, not the size to expect over a closure. The replay also shows both collateral valuations rather than assuming which one Bitget's private engine uses (C5, unknown).

## Tier semantics are assumptions

The kernel takes a tier to cover `(lo, hi]` and applies the selected band's rate to the whole notional. Both are conventions, not verified facts (C6). The 243 captured ladders prove the bands are contiguous but cannot say how a shared boundary value is treated or whether bands apply marginally. Break attack B3 inherits this. Closing it needs the exact Bitget wording or an authenticated probe at a boundary value.

## An earlier capture was wrong, and was fixed

The first position-tier capture sent the wrong request parameter (`productType`, a v2 convention, instead of `category`). Bitget answered `400172` for every symbol, and the script wrote those error envelopes to disk as if they were data, because it never checked the response code. All 244 files were errors. This was found while investigating why U5/U8 had no data, fixed to require `code === "00000"` before writing, and re-run: 243 real ladders now exist. A related flaw surfaced in the break campaign (B10): one tick had been chain-recorded with null prices after a malformed response; the tick builder now refuses such a record loudly.

## The LLM path is Gemini on a free tier, not Qwen

The Qwen driver exists but has never made a live call (no key). The live provider is Gemini on a free-tier quota. When it is unavailable or over quota, the app serves a verified deterministic template and records the driver error in the response. The Ask bar does not use a model at all. The product is complete without either.

## The Ask bar is a rule router

It understands a fixed set of intents (where the book breaks, what-if with a percentage, the smallest safe move, the state of the clock). That is deliberate: it is always available, never invents a number, and shows every call. It does not parse arbitrary free text.

## Sample sizes are small and labelled

- The window set (31 windows) is a calendar derivation. No window has fully elapsed since recording began, so the pre-registered null-control test (break attack B13, claim C7) has N = 0.
- The benchmark is a synthetic account grid (36 accounts, 12 breached). It measures the optimizer against controls, not trading performance.

## Not built

- No authenticated key path (E5). U3/U4/U9 stay open and the kernel has not been checked against Bitget's own `effEquity` and `mmr` fields.
- Holiday and half-day handling beyond the NYSE calendar file is not modelled in the replay.
- The rToken universe is every stock perp with a matching 1:1 rToken (241). 84 stock-labelled perps (index futures, non-US names, non-equities) are excluded on purpose, not guessed.
- CSV book input is a single-tier simplification; JSON carries exact ladders.
- Some Bitget support-article sources (F1-F14) were not independently re-fetched; they rest on the build instruction's text. Nothing in the evidence ledger depends on them being exact.

## What this product does not claim

It has no trading track record, makes no alpha claim, never places an order, and is not financial advice.
