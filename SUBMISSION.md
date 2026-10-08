# SUBMISSION.md

**Bitget AI Base Camp Hackathon S2 · Track: AI Trading Desk · Sub-theme: Decision Stress Testing**

| | |
|---|---|
| Live app | https://isopleth-blue.vercel.app |
| Proof page | https://isopleth-blue.vercel.app/proof |
| MCP server | https://isopleth-blue.vercel.app/mcp (read-only, 6 tools) |
| Repository | https://github.com/0xkinno/isopleth |
| Demo video and X post | https://x.com/0xkiddok/status/2107968222020657562 |

Status: final. Updated 2026-10-08.

---

## Project Description

### 1. Thesis

> Your margin ratio is a snapshot. Isopleth maps the boundary it is sitting next to, and shows you the smallest move that keeps you inside it.

Margin safety for a Bitget cross-asset account is a surface over state, not a number. The state includes collateral tiers, maintenance tiers, crypto marks and a reference price for rToken collateral that is not the market price and that can sit unchanged while the market moves. Isopleth measures that reference axis from public Bitget data, evaluates the book across the state space with a deterministic, fail-closed kernel, locates the contour where it crosses the warning threshold by bisection on the kernel itself, and searches for the cheapest action that restores safety. An LLM explains the result; it never computes it.

The architectural claim is falsifiable and the result is reported as it stands, not as hoped:

* **Confirmed (observed):** the recording is real and verifiable (44,000+ hash-chained records, 241 rToken pairs); across 44,603 ticks the public reference index was unchanged from the previous tick **17.5%** of the time, with a median distance to spot of **0.114%** and a longest single freeze of **447 minutes**; two thin-liquidity pairs show a clean freeze and thaw.
* **Not yet confirmed:** the documented session-wide freeze and thaw in a *liquid* name. The recording has not passed through a weekend close; the first clean test is 2026-10-09 to 12, after the deadline. The headline claim (C4) is published as `PARTIAL`. If the index moves continuously through that window, the thesis is wrong, and the repository says so (see `PROOF.md`).

### 2. Target user and product value

Semi-professional cross-asset traders and small desks that hold rTokens as UTA Advanced Mode collateral behind leveraged crypto positions, and read a single margin ratio on a single screen. For them Isopleth answers three questions a margin ratio cannot: *where does my book break first*, *what has to change before it becomes fragile*, and *what is the smallest move that keeps me safe*. It never trades and never has a key that could.

### 3. Validation data and key metrics

Every figure is labelled **observed** (measured or computed from stored data and reproducible), **estimated**, or **targeted**. No figure is typed by hand; each names its reproduce command.

| Figure | Value | Label | Reproduce |
|---|---|---|---|
| rToken pairs discovered live, no hardcoded list | 241 (84 stock-labelled perps excluded with reasons) | observed | `pnpm discovery:e2` |
| Hash-chained clock records, chain intact | 44,000+ | observed | `pnpm verify:offline` |
| Collateral discount-rate entries captured | 520 | observed | `pnpm discovery:e2:rules` |
| Real maintenance-margin ladders captured | 243 ladders, 1,778 bands, all contiguous with non-decreasing rate | observed | `pnpm verify:offline` |
| Reference index unchanged from previous tick | 17.5% of 44,603 ticks, 240 pairs | observed | `pnpm replay:build` |
| Median / 95th percentile spot-to-reference gap | 0.114% / 0.559% | observed | `pnpm replay:build` |
| Confirmed freeze+thaw events | 2 (thin-liquidity pairs) | observed | `pnpm discovery:clockmap` |
| F8 silent-fallback trap | confirmed live (3 of 3 candle types identical to `market`) | observed | `pnpm discovery:e3` |
| Break campaign | 12 of 13 verified, 0 failed (B13 time-blocked) | observed | `pnpm break` |
| Tests | 27 passing (unit and property) | observed | `pnpm test` |
| Offline verifier | 7 of 7 checks pass, no network, no model | observed | `pnpm verify:offline` |
| Optimizer benchmark (synthetic grid, 36 accounts, 12 breached) | restoring plan found 100% of the time at an average cost of $6,375; random top-up at equal cost restores 58.3%; proportional top-up ties at 100% (stated plainly) | observed, synthetic accounts | `pnpm bench` |
| Pre-registered null-control test of the reopening-gap predictor | N = 0 windows elapsed | targeted (after the 2026-10-09 to 12 weekend) | `pnpm discovery:e4:replay` |

What would make these claims false is written down in `PROOF.md` and `data/bench/results.json`.

### 4. Progress

Built and deployed: the deterministic margin kernel, scenario operators, counterfactual surface, bisected contour, minimum-intervention optimizer; the Collateral Clock recorder (GitHub Actions, every ten minutes); six web routes; the Ask bar with a visible tool trace; a read-only MCP server; verifiable receipts on every kernel answer; the measured reference-lag replay; guarded LLM narration; CI; the offline verifier, break campaign, benchmark and manifest. Documentation: `README.md`, `ARCHITECTURE.md`, `METHOD.md`, `LIMITATIONS.md`, `PROOF.md`, `DISCOVERY.md`, `EVIDENCE_MANIFEST.md`, `CLAIMS.json`.

Honest gaps (full list in `LIMITATIONS.md`): liquid-name freeze unconfirmed; tier boundary and application rules are assumptions (C6); B13 and C7 need elapsed windows; Qwen driver built but never called live (no key); no authenticated key probe (E5).

### 5. Deliverables

* Live app, six routes, no login, no settings.
* Public repository, MIT licence, CI on every push.
* Demo video and X post (linked above).
* `/proof`: the claims ledger rendered live, with reproduce commands.
* Read-only MCP endpoint usable beside Bitget's own server: `claude mcp add isopleth --transport http https://isopleth-blue.vercel.app/mcp`.

### 6. Our take on AI trading

An AI that sits in the decision path of a leveraged account needs to be checkable more than it needs to be clever. We use the model where it is good (explaining a result in plain language) and keep it out of the three places where it is dangerous: it does not compute a number, it does not choose an action, and it cannot place one. Everything that decides a number is deterministic code that can be re-run offline and compared by hash. The trader remains the decision-maker; the desk's job ends at the boundary and the smallest move.

---

## Role of the LLM

> The LLM layer is provider-agnostic (Gemini, Qwen or none, one environment variable). It routes to read-only tools and narrates kernel results. It never computes a number. A number-binding guard rejects any narration containing a number the kernel did not produce and serves a deterministic template instead. The product runs fully with the model removed, and the Ask bar and MCP server involve no model at all.

Where credits were used: the live narration provider is **Gemini** on a free-tier key. The **Qwen** driver (`qwen3.8-max`, OpenAI-compatible gateway) is built and covered by the same guard and tests, but no Qwen key was available during this build, so it has not made a live call. We state that rather than imply otherwise.

## Track

**AI Trading Desk**, sub-theme **Decision Stress Testing**.

## X post

Posted with the demo video: https://x.com/0xkiddok/status/2107968222020657562

## Final claims audit

- [x] The thesis section states the real result of the Collateral Clock measurement (partial, with the exact gap named), not an aspiration.
- [x] Every figure above traces to a stored file or command; none is typed into the product by hand.
- [x] `/proof` resolves and shows real data.
- [x] The video is built from recordings of the real deployed app plus motion graphics that show only real numbers.
- [x] `LIMITATIONS.md` is current and linked.
- [x] No claim marked PROVEN in this document is anything other than PROVEN in `CLAIMS.json`.
