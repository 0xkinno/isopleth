# LIMITATIONS.md

Stated first, not buried — per the project's own standard for what beats the
strongest competing sample (FINAL_INSTRUCTION.md §16: "it states its limits
first"). Updated 2026-10-05, as of Phase A in progress.

## The headline measurement is not confirmed yet

The entire architectural bet of this build (§0) is that the reference-price
axis is measured, not assumed. As of this writing, it is **not yet measured**
— the Collateral Clock recorder has been running since 2026-10-04 evening and
has not passed through a full weekend/holiday close. Zero confirmed
freeze+thaw transitions exist. See `CLAIMS.json` C4 and `DISCOVERY.md`. This
is the single biggest open limitation in the project and is not minimized
here.

## Tier boundary semantics are an assumption, not a verified fact

The kernel's planned convention — a collateral/position tier covers `(lo,
hi]`, lower exclusive, upper inclusive — comes from FINAL_INSTRUCTION.md's
own kernel pseudocode, not from an independently re-fetched Bitget document
or a live authenticated probe at the exact boundary. U5 (marginal vs.
aggregated tier application) and U8 (inclusive/exclusive) are both open. Any
claim the eventual kernel makes about exact-boundary behavior (relevant to
break test B3) inherits this assumption until it's closed.

## Some documented sources were not independently re-fetched this session

FINAL_INSTRUCTION.md §3 calls for re-fetching F1-F14 into `docs/sources/`
with a capture date. This build's tooling could reach `api.bitget.com`
(confirmed working) but had intermittent trouble reaching `bitget.com`
support-article pages directly within the same session — see `PROGRESS.md`
for the full diagnostic trail. F1-F14 are currently taken on the authority of
FINAL_INSTRUCTION.md's own text rather than freshly re-captured. This should
be closed before final submission, not left as a silent gap.

## The rToken-to-perp matching convention has known, deliberate gaps

E2's instrument scan matches a stock perp to an rToken spot symbol via the
documented `r` + ticker convention. 84 of 325 discovered stock-labelled
futures symbols did not match and were excluded rather than guessed — these
are index futures (SP500, NDX100, HSI, JP225, KR200), non-US-listed names
(Samsung, Tencent, Xiaomi, and similar), and non-equity names (OPENAI,
ANTHROPIC, POLYMARKET) that have no rToken collateral counterpart. This is a
correct exclusion, not a bug, but it means the product's rToken universe is
narrower than "every stock-labelled perp on Bitget" — it is specifically
"every stock-labelled perp with a matching 1:1-backed rToken."

## Sample sizes are small, and are stated as such everywhere they appear

- The current clock data (4,000+ ticks) spans a few hours of one weekday.
  Any pattern observed in it (e.g. the 31/241 pairs showing an early
  frozen-like signature) is explicitly labelled sub-threshold, not a result.
- The historical window set (31 windows since 2026-06-04) is a calendar
  derivation, not 31 observed outcomes — only windows that occur *while the
  recorder is running* will have real data behind them.
- The shadow-predictor control (E4) has zero `G_w` values to evaluate against
  as of this writing.

## E5 (private verification) has not run

No Demo Trading or read-only UTA key has been supplied. This is by design —
E5 is optional and never a prerequisite — but it means U3/U4/U9 remain fully
open, and the kernel's reproduction accuracy against Bitget's own
`effEquity`/`mmr`/`mgnRatio` has not been checked against anything real.

## Phase B onward does not exist yet

There is no margin kernel, no surface, no contour, no optimizer, no product
UI, no Qwen integration, and no break campaign run against real code. Every
claim this document and `PROOF.md` make is scoped to Phase A discovery
artifacts only. Nothing here should be read as a claim about the finished
product, because the finished product does not exist yet.
