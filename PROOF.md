# PROOF.md

The narrative companion to [`CLAIMS.json`](CLAIMS.json) (the structured ledger, rendered live at `/proof`) and [`EVIDENCE_MANIFEST.md`](EVIDENCE_MANIFEST.md) (the artifact index). For each claim: *given what is in this repo right now, would it survive a judge opening the evidence and checking it by hand?* Updated 2026-10-08.

## The falsifiable architectural claim

> Margin safety is a surface over state, not a number. The AI explains the surface. Deterministic code computes it. The trader decides.

The surface half is built and checked: the kernel, contour and optimizer exist, are deterministic and fail closed, and are exercised by 27 tests, a 13-attack break campaign (12 verified) and a 7-check offline verifier. The state half is partly measured: one axis (the reference price) is recorded from the exchange and shows a real, measurable lag against spot; its headline freeze-and-thaw is confirmed only in thin pairs so far.

## Claim by claim

| ID | Claim | Status | Check it yourself |
|---|---|---|---|
| C1 | The rToken universe can be discovered live, no hardcoded list | PROVEN | `pnpm discovery:e2` (241 pairs, 84 excluded with reasons) |
| C2 | rToken candle `type=index/mark/premium` silently returns `type=market` | PROVEN | `pnpm discovery:e3`; `data/clock/e3-fallback-trap.json` has the raw arrays |
| C3 | Collateral and maintenance ladders can be captured and content-hashed | PROVEN | `pnpm discovery:e2:rules`; `pnpm verify:offline` checks all 243 ladders (1,778 bands) are contiguous with non-decreasing maintenance rate |
| C4 | The reference clock freezes and thaws on a schedule | **PARTIAL** | 2 thin pairs confirmed; a liquid name needs the 2026-10-09 to 12 weekend |
| C5 | `markPrice` clamps to the frozen index (U6) | UNKNOWN | indications only |
| C6 | Tier boundaries are `(lo, hi]` and how bands apply (U5/U8) | UNKNOWN | ladders prove contiguity, not the boundary rule |
| C7 | The reopening gap is predictable beyond a null control | UNKNOWN | rule pre-registered; no elapsed window yet |
| C8 | Reference lag can be measured from the recorded chain | PROVEN | `pnpm replay:build`; 44,603 ticks, 240 pairs, 17.5% frozen, median gap 0.114% |
| C9 | Every kernel answer carries a receipt that verifies and breaks on a one-dollar edit | PROVEN | `pnpm verify:offline` (receipt-round-trip); the "verify" link on `/workbench` |
| C10 | A read-only MCP surface over the kernel and measurements | PROVEN | `tests/unit/mcp-tools.test.ts`; `POST /mcp` with `tools/list` |
| C11 | 12 of 13 break attacks verified | PARTIAL | `pnpm break`; B13 needs elapsed windows |

## What the evidence is and is not

* **C3 was once false.** An earlier capture wrote Bitget's error responses as data (wrong request parameter, no response-code check). It was caught, fixed to require `code 00000`, and re-run. The 243 ladders now in the repo are real, and the verifier would fail if one stopped being a success envelope. See `LIMITATIONS.md`.
* **C8 measures prices, not Bitget's private valuation.** It shows how far the public reference sits from spot and what a book's margin would be under each valuation. Which one Bitget uses is C5 and is open.
* **C11's missing attack is blocked by the calendar, not the build.** The permutation harness (`packages/core/src/e4stat.ts`) is built and unit-tested.

## What would make the thesis false

If the recorder runs through the 2026-10-09 to 12 closure and shows `indexPrice` moving continuously with no freeze in liquid names, the claim that the reference axis is a distinct, lagging state is wrong, and this build will say so. It has not happened; it has not been ruled out, because the window has not yet occurred. The partial evidence (17.5% frozen ticks, 447-minute freezes, two clean thin-pair cycles) is consistent with the thesis and is stated as exactly that.

## Reproduce everything from a clean clone

```bash
pnpm install
pnpm discovery:e2 && pnpm discovery:e2:rules && pnpm discovery:e3 && pnpm discovery:e4:windows
pnpm discovery:e1            # long-running recorder, leave it going
pnpm discovery:clockmap
pnpm test                    # 27 tests
pnpm verify:offline          # 7 checks, no network, no model
pnpm break                   # 12/13 verified
pnpm replay:build            # the reference-lag replay
```

No step needs an API key. An optional read-only key (E5) would close C5 and C6 and is never a prerequisite.
