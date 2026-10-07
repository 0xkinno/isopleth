# PROOF.md

The narrative companion to [`CLAIMS.json`](CLAIMS.json) (the structured
ledger) and [`EVIDENCE_MANIFEST.md`](EVIDENCE_MANIFEST.md) (the artifact
index). This file answers one question per claim: *given what exists in this
repo right now, would it survive a judge opening the evidence and checking it
by hand?* Updated 2026-10-05. The eventual `/proof` route (Phase D) will
render this evidence, not restate it from scratch.

---

## The falsifiable architectural claim (FINAL_INSTRUCTION.md §1.3)

> Margin safety is a surface over state, not a number. The AI explains the
> surface. Deterministic code computes it. The trader decides.

Nothing exists yet to prove the "surface" half of this — no kernel, no
contour, no optimizer (all Phase B). What exists so far only proves the
foundation that surface is built on: that one axis of "state" (the reference
price) is a real, measured, non-trivial thing, not a documented formula
restated as if it were a discovery.

## Claim-by-claim proof status

**C1 — Instrument discovery is real, not hardcoded.** Run `pnpm discovery:e2`
yourself: it hits `/api/v3/market/instruments` live, twice (SPOT and
USDT-FUTURES), and derives the pairing from the response, not from a
committed symbol list. 241 matched, 84 explicitly excluded with reasons
logged to stderr. **PROVEN** — reproducible in under 30 seconds.

**C2 — The F8 silent-fallback trap is real.** `data/clock/e3-fallback-trap.json`
contains the actual request/response pairs: `type=index`, `type=mark`,
`type=premium` all byte-identical to `type=market` for `RTSLAUSDT`. This is
not a documentation citation — it's a live probe result, with the raw
candle arrays saved. **PROVEN.**

**C3 — Tier ladders are capturable and content-hashed.** 520 discount-rate
entries, 244 position-tier files, each hashed. Re-running
`pnpm discovery:e2:rules` after Bitget changes a ladder would produce a
different hash and a second versioned file — this has not been *tested*
(nothing has changed yet), but the mechanism is in place and typechecked.
**PROVEN** for the capture; the version-detection behavior itself is
**UNTESTED** until a real ladder change is observed.

**C4 — the headline claim: the reference clock freezes and thaws.** This is
the one claim that matters most and is **not yet proven**. The recorder has
been running since 2026-10-04 evening and has not yet passed through a full
weekend close. `data/clock/clock-map.json` currently shows 0 confirmed
freeze+thaw cycles. This is stated plainly, not minimized: **if the recorder
stops before 2026-10-09–12, this build submits without its headline proof.**
Protecting that recording window is the single most important remaining
action in this project.

**C5 — markPrice clamping (U6).** Early, weak, sub-threshold signal only
(31/241 pairs show the qualitative frozen signature in a few hours of
weekday data). **UNKNOWN**, correctly labelled as such rather than rounded
up to a finding.

**C6 — tier boundary semantics (U5/U8).** **UNKNOWN.** The kernel's planned
`(lo, hi]` convention is inherited from the spec as an assumption. Nothing
in this repo yet independently confirms it against a real Bitget boundary
value or document.

**C7 — the shadow-predictor control.** The rule is pre-registered in writing
(`data/windows/pre-registration.md`), dated before any result exists — this
protects against post-hoc rule-fitting if/when it does run. No `G_w` values
exist yet, so the claim itself is **UNKNOWN**, not evaluated.

## What would make the whole thesis false

Stated plainly, per the project's own standard (FINAL_INSTRUCTION.md §16):
if the recorder runs through the 2026-10-09–12 window and shows
`indexPrice` moving continuously with no freeze — the central architectural
bet (§0: "the reference-price axis is measured, not assumed") is wrong, and
this build would need to say so rather than quietly drop E1 from the
narrative. That outcome has not happened; it also has not been ruled out
yet, because the window hasn't occurred.

## Reproducing everything above from a clean clone

```bash
pnpm install
pnpm discovery:e2          # instrument scan -> pairs.json
pnpm discovery:e2:rules    # tier ladders
pnpm discovery:e3          # F8 trap
pnpm discovery:e4:windows  # calendar window set (no network needed)
pnpm discovery:e1          # long-running - leave it going
pnpm discovery:clockmap    # re-run anytime to see current classification
```

No step above requires an API key. E5 and E6 are excluded because they are
not yet built / are credential-gated (see `TASK.md`).
