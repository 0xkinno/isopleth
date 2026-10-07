# METHOD.md

What is measured vs. modelled vs. not-yet-built, stated plainly. This is the
source the eventual `/method` route (Phase D) will render; until then it's
the honest internal reference. Updated 2026-10-05.

## MEASURED (live data, captured and evidenced in this repo today)

- The rToken-eligible stock-perp universe (241 pairs) — `data/clock/pairs.json`.
- The collateral discount-rate tier ladder, per rToken — `data/clock/rules/discount-rate/`.
- The maintenance-margin position-tier ladder, per stock perp + core crypto — `data/clock/rules/position-tier/`.
- The F8 silent-fallback behavior of rToken candle endpoints — `data/clock/e3-fallback-trap.json`.
- `indexPrice` / `markPrice` / rToken spot, sampled every 60s since 2026-10-04 — `data/clock/raw/e1.jsonl` (accumulating).
- The NYSE 2026 trading calendar — `data/calendar/nyse-2026.json`.

## MEASURING RIGHT NOW (not yet conclusive)

- Whether the reference clock actually freezes and thaws, and when. The
  recorder is running; no weekend/holiday close has elapsed inside the
  recording window yet. See `DISCOVERY.md` and `CLAIMS.json` C4.
- Whether `markPrice` clamps to the frozen index or floats (U6) — weak early
  signal only, not a result.

## MODELLED (will be computed by a deterministic kernel, not yet built)

Everything in FINAL_INSTRUCTION.md §6 — the margin kernel, the counterfactual
surface, the contour, the minimum-intervention optimizer — is **Phase B**,
not started. When it exists, every number it produces will carry an
`evidence` field of `SYNTHETIC` or `REPLAYED` per the kernel's own type
(`MarginResult.evidence`), and this document will say so per-field rather
than implying the whole app is "measured."

## SYNTHETIC (calendar/structural derivations, not live market observations)

- The 31-window closed-market calendar (`data/windows/window-set.json`) is
  pure date arithmetic over the NYSE calendar — it states *when* windows
  occur, not what actually happened in any of them. The `G_w` values that
  would make a window's data MEASURED/REPLAYED don't exist yet.

## UNKNOWN (explicitly, not silently assumed)

- U5 — whether collateral tiers apply marginally per coin or on aggregated value.
- U6 — whether markPrice is clamped to the frozen index or floats.
- U8 — tier boundary inclusivity/exclusivity.
- U3/U4 — whether private per-coin valuation tracks the public index (needs E5, optional, not started).
- U10/U11 — Qwen wire format and MCP tool schemas (needs E6, blocked on `QWEN_API_KEY`).

Every UNKNOWN above is tracked with its resolution path in `DISCOVERY.md §3.2`
(carried from FINAL_INSTRUCTION.md) and will be updated here the moment it
resolves either way — including if it resolves to "the thesis assumption was
wrong," which gets published exactly as prominently as a confirming result
would.

## Why this document exists

The whole architectural bet of this project (FINAL_INSTRUCTION.md §0) is
that restating a documented formula is not the same as measuring something.
This file is the mechanism for keeping that distinction honest release over
release, rather than letting "modelled" quietly become "measured" in the
README as the deadline approaches.
