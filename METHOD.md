# METHOD.md

What is measured, what is modelled, what is replayed, and what is unknown. This is the source the `/method` page renders. Updated 2026-10-08.

## MEASURED (observed from Bitget's public API, evidenced in this repo)

- The rToken-eligible stock-perp universe, 241 pairs, discovered live from `instruments` with no hardcoded list: `data/clock/pairs.json`.
- Collateral discount-rate ladders, 520 entries, content-hashed: `data/clock/rules/discount-rate/`.
- **Maintenance-margin ladders for every stock perp plus BTC, ETH and SOL: 243 real ladders, 1,778 bands**, content-hashed: `data/clock/rules/position-tier/`. Each is a genuine success envelope, contiguous (every band starts where the previous one ends), with a non-decreasing maintenance rate. `pnpm verify:offline` re-checks all of it. One symbol (WBDUSDT) was delisted at capture time (code 40309) and is correctly not stored.
- The F8 silent-fallback behaviour of rToken candle endpoints (`type=index/mark/premium` silently return `type=market`): `data/clock/e3-fallback-trap.json`.
- `indexPrice`, `markPrice` and rToken spot for every pair, hash-chained since 2026-10-04: `data/clock/raw/e1.jsonl` (44,000+ records).
- **Reference lag**, from that chain: over 44,603 ticks on 240 pairs the public reference index was unchanged from the previous tick 17.5% of the time; median distance to spot 0.114%, 95th percentile 0.559%; longest single freeze 447 minutes. One pair (BYDUSDT, 612% gap) is reported as a unit-mapping anomaly, not as lag. Rebuild with `pnpm replay:build`.
- Two confirmed freeze-and-thaw events in thin-liquidity pairs (AEHRUSDT, LYTEUSDT): `data/clock/clock-map.json`.
- The NYSE 2026 trading calendar: `data/calendar/nyse-2026.json`.

## MODELLED (deterministic code over whatever state is fed in)

The margin kernel, the counterfactual surface, the contour, the minimum-intervention optimizer: `packages/core`. Every result carries an `evidence` field. The demo book is `SYNTHETIC`; a replay over real recorded prices is `REPLAYED`. The kernel's formulas are the documented ones; two of its conventions are assumptions (see UNKNOWN).

## REPLAYED (real recorded prices, invented book)

The Clock replay on `/scenarios`. It evaluates one fixed leveraged book at every recorded tick with collateral valued at the reference index and at market spot, and shows both. It does **not** assert how Bitget's private engine values collateral.

## SYNTHETIC

- The demo book and every account in the benchmark grid.
- The 31-window closed-market calendar: date arithmetic over the NYSE calendar. It says when windows occur, not what happened in them.

## UNKNOWN (stated, tracked in `CLAIMS.json`)

- **C4, partial.** The documented session-wide freeze has not been confirmed in a liquid name. Next clean test: the 2026-10-09 to 12 weekend close.
- **C5 (U6).** Whether `markPrice` clamps to the frozen index or floats. Indications only.
- **C6 (U5/U8).** Whether tiers apply marginally or on the aggregate, and whether a band includes or excludes its boundary value. The captured ladders settle the *structure* (contiguous bands) but cannot say how adjacent bands treat the shared value, so the kernel's `(lo, hi]` convention remains labelled an assumption.
- **C7.** Whether the reopening gap is predictable beyond a null and a permutation control. The rule is pre-registered; no window has fully elapsed since recording began.
- **U3/U4.** Whether Bitget's private per-coin valuation tracks the public index. Needs an optional read-only key probe (E5), never a prerequisite.
- **Qwen wire format (E6).** The Qwen driver is built; no key has been available. Gemini is the live provider.

Every UNKNOWN is published as prominently when it resolves against the thesis as when it resolves in its favour.

## Why this document exists

Restating a documented formula is not the same as measuring something. This file is how that distinction stays honest release over release, instead of "modelled" quietly becoming "measured" as a deadline approaches.
