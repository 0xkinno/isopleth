# Isopleth

[![CI](https://github.com/0xkinno/isopleth/actions/workflows/ci.yml/badge.svg)](https://github.com/0xkinno/isopleth/actions/workflows/ci.yml)
[![Verify: offline reproducible](https://img.shields.io/badge/verify-offline%20reproducible-3F8F6B)]()
[![Tests: 27/27 passing](https://img.shields.io/badge/tests-27%2F27%20passing-3F8F6B)]()
[![Break campaign: 12/13, 0 failed](https://img.shields.io/badge/break-12%2F13%20verified%2C%200%20failed-3F8F6B)]()
[![Lighthouse a11y: 100](https://img.shields.io/badge/lighthouse%20a11y-100-3F8F6B)]()
[![License: MIT](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)
[![Bitget Hackathon S2: AI Trading Desk](https://img.shields.io/badge/Bitget%20Hackathon%20S2-AI%20Trading%20Desk-D9A441)]()
[![Sub-theme: Decision Stress Testing](https://img.shields.io/badge/sub--theme-Decision%20Stress%20Testing-D9A441)]()

> Your margin ratio is a snapshot. Isopleth maps the boundary it is sitting next to, measures one axis of that boundary directly from public Bitget data, and names the smallest move that keeps you inside it.

<p align="center"><img src="docs/screens/landing-banner.jpg" alt="Isopleth landing page: 'Your margin ratio is a snapshot. The boundary moves.' next to a topographic-relief hero image, with the live Collateral Clock strip (241 pairs tracked, 43,883 ticks recorded, 2 confirmed freeze+thaw) below." width="100%" /></p>

Built for the **Bitget AI Base Camp Hackathon S2** — Track: **AI Trading Desk**, sub-theme: **Decision Stress Testing**. Submission deadline: **2026-10-08**.

A Bitget cross-asset trader holding rTokens as UTA Advanced Mode collateral reads one margin number on one screen. That number is a point-in-time snapshot. The boundary it sits near — set by a collateral tier ladder, a maintenance-margin tier, and a reference-price clock that freezes over weekends and holidays and thaws in one undocumented step — moves whenever the underlying state changes, and nothing on a standard exchange UI shows where that boundary currently is, or how close the next state change brings a trader to it. Isopleth measures the one axis of that state that is genuinely undocumented (the rToken reference-price clock), computes every other axis with a pure deterministic kernel built from Bitget's own documented formulas, and renders the contour — the exact threshold crossing — as a navigable surface, with a minimum-cost plan to stay inside it.

Every number on this site traces to a reproducible command. Nothing is typed by hand; see [`/proof`](#proof) and the reproduce block below.

---

## Product links

| | |
|---|---|
| **Live app** | [isopleth-blue.vercel.app](https://isopleth-blue.vercel.app) — deployed and verified, all 6 routes, zero console errors |
| **Proof page** | [isopleth-blue.vercel.app/proof](https://isopleth-blue.vercel.app/proof) — the claims ledger, walkable Decision → Result → Scenario → Engine inputs → Source evidence |
| **MCP server** | `https://isopleth-blue.vercel.app/mcp` - read-only, 6 tools, add it next to Bitget's own server (see below) |
| **Clock replay** | [isopleth-blue.vercel.app/scenarios](https://isopleth-blue.vercel.app/scenarios) - the measured reference lag, replayed through the kernel |
| **Repository** | [github.com/0xkinno/isopleth](https://github.com/0xkinno/isopleth) |
| **Demo video** | [Watch on X](https://x.com/0xkiddok/status/2107968222020657562)|
| **X post** | [See on X](https://x.com/0xkiddok/status/2107968222020657562)  |
| **Docs index** | [full index below](#docs-index) — 13 cross-referenced documents, every one pulling from the same JSON files the app reads |

---

## Explore in 2 minutes

```bash
git clone https://github.com/0xkinno/isopleth.git && cd isopleth
pnpm install
pnpm discovery:e2 && pnpm discovery:e2:rules && pnpm discovery:e3 && pnpm discovery:e4:windows
pnpm discovery:e1          # long-running - the Collateral Clock recorder, leave it going
pnpm discovery:clockmap    # check classification anytime
pnpm run sync:web && pnpm --filter @isopleth/web dev
```

No API key required for any of the above — everything through Phase A/B/C runs on public Bitget data. Then, to see every other guarantee for yourself:

```bash
pnpm typecheck && pnpm test          # 27/27 unit + property tests, zero network
pnpm verify:offline                   # recomputes every published result from stored inputs - no network, no model
pnpm break                            # the 13-attack break campaign against the real kernel (12 verified)
pnpm replay:build                     # rebuild the measured reference-lag replay from the real hash chain
pnpm bench                            # synthetic account-grid benchmark vs. random/proportional top-up controls
```

---

## The problem

A margin ratio is a point-in-time number. The surface it sits on moves whenever the underlying state changes — a weekend close, a tier crossing, a collateral-ratio announcement — and the trader cannot see the boundary move, only the number after it already has. For a cross-asset book holding rTokens (tokenized equity exposure usable as UTA Advanced Mode collateral), this is worse than for a crypto-only book: the reference price that collateral value depends on **freezes** when the underlying stock market closes and **thaws** in a single undocumented jump when it reopens, and Bitget's own candle API silently feeds back ordinary market data when asked for that reference series directly (confirmed live, see [the technical discovery](#the-technical-discovery)) — a trap that would otherwise corrupt any tool that tried to reconstruct this history from the obvious endpoint.

## The solution

1. **Measure**, don't assume, the one axis of state that is genuinely undocumented: when the public stock-perp reference price actually freezes and thaws (the Collateral Clock, E1) — a hash-chained, tamper-evident recorder running since 2026-10-04, confirmed live and continuing on a 10-minute GitHub Actions cron.
2. **Compute** every other axis with a pure, deterministic margin kernel — the same formula Bitget documents (`@isopleth/core`), never an LLM, fully covered by unit and property tests.
3. **Map** the counterfactual surface across a state grid and locate the contour — the exact threshold crossing — by bisection on the kernel itself, never by eyeballing a chart.
4. **Recommend** the minimum-cost intervention that restores the threshold, via a deterministic grid-search optimizer, benchmarked against blind-allocation controls at equal capital.
5. **Explain**, never compute, with an LLM behind a real multi-step tool-calling loop and a number-binding guard that rejects any narrated number the kernel didn't produce — and the whole product runs correctly with the LLM removed entirely (`LLM_PROVIDER=none`).

## Product flow

```mermaid
flowchart LR
  A[Public Bitget data] --> B[Collateral Clock<br/>measured, hash-chained]
  B --> C[Margin kernel<br/>pure, deterministic]
  D[Your book: JSON / CSV / demo] --> C
  C --> E[Counterfactual surface]
  E --> F[Isopleth contour]
  F --> G[Minimum-intervention plan]
  C --> H[LLM tool-calling loop<br/>behind a number-binding guard]
  G --> H
  H --> I["Narration + personalized thesis"]
```

## Architecture

```mermaid
flowchart TD
  subgraph pub["Public Bitget v3 market data, no key"]
    INS["/market/instruments<br/>241 rToken pairs, discovered live"]
    TICK["/market/tickers<br/>60s cadence, 43k+ ticks"]
    RULES["/market/discount-rate + /market/position-tier<br/>content-hashed tier ladders"]
  end
  INS --> REC
  TICK --> REC["E1 Collateral Clock recorder<br/>hash-chained JSONL"]
  RULES --> KERNEL
  REC --> CLOCKMAP["Clock Map<br/>OPEN_LIVE / FROZEN / REOPENING / STALE / UNKNOWN"]
  BOOK["Book input<br/>JSON / CSV / demo"] --> KERNEL["Margin kernel<br/>packages/core, pure"]
  CLOCKMAP --> KERNEL
  KERNEL --> SURFACE["Counterfactual surface + contour<br/>bisection"]
  KERNEL --> OPT["Minimum-intervention optimizer"]
  SURFACE --> UI["6 routes: landing / workbench / portfolio / scenarios / proof / method"]
  OPT --> UI
  KERNEL --> LOOP["LLM tool-calling loop<br/>packages/llm"]
  OPT --> LOOP
  LOOP --> GUARD["Number-binding guard (I6)"]
  GUARD --> UI
  KERNEL --> VERIFY["pnpm verify:offline<br/>no network, no model"]
  REC --> VERIFY
```

```text
isopleth/
  packages/core   margin kernel, scenario operators, contour, optimizer, E4 stats (BUILT, 21 tests)
  packages/data   public Bitget client, hash-chained tick log, F8 guard, chain verifier (BUILT)
  packages/llm    provider-agnostic gemini/qwen/none driver, number-binding guard, tool loop (BUILT)
  apps/web        Next.js 15, 6 routes, 2 API routes, real kernel + real recorded data (BUILT)
  scripts/        discovery (E1-E6), E4 replay, break campaign, bench, verify-offline, manifest (BUILT)
  data/           the evidence itself - clock ticks, tier ladders, windows, break/bench results
  docs/           screenshots (docs/screens) and Lighthouse reports (docs/lighthouse), both real
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the fully annotated version (what's `[BUILT]` vs. `[PLANNED]` at the file level).

---

## Screenshots

<table>
<tr>
<td width="50%"><img src="docs/screens/workbench.jpg" alt="Workbench: current vs. stressed cross margin rate cards, the counterfactual surface with a reopening-gap slider, the minimum-intervention plan, and the Your Book panel (JSON/CSV input, personalized thesis, AI narration, exports)." width="100%" /><br/><sub><b>Workbench</b> — real demo book, real kernel, editable</sub></td>
<td width="50%"><img src="docs/screens/contour.jpg" alt="Close-up of the Isopleth contour: a scientific-contour-map rendering of the threshold crossing between reference shock % and crypto mark shock %, with the current book position marked as a crosshair." width="100%" /><br/><sub><b>Contour</b> — the threshold crossing, located by bisection</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screens/scenarios.jpg" alt="Scenarios page: four named state transitions (reference shock, reopening gap, joint transition, crypto mark shock), each with its real computed cross margin rate." width="100%" /><br/><sub><b>Scenarios</b> — named transitions, same kernel</sub></td>
<td width="50%"><img src="docs/screens/proof.jpg" alt="Proof page: the claims ledger, seven claims each labelled PROVEN, PARTIAL, or UNKNOWN with evidence paths and reproduce commands, plus a reproduce-from-clean-clone block." width="100%" /><br/><sub><b>Proof</b> — the claims ledger, honestly labelled</sub></td>
</tr>
</table>

---

## Feature depth

| Source | How it feeds the mechanism |
|---|---|
| `/api/v3/market/instruments` (public) | Discovers the rToken-eligible universe live — 241 pairs, no hardcoded list |
| `/api/v3/market/tickers` (public) | Sampled every 60s since 2026-10-04 to build the Collateral Clock — 43,883 ticks and counting, recorder confirmed running on a live 10-minute GitHub Actions cron |
| `/api/v3/market/discount-rate`, `/api/v3/market/position-tier` (public) | 520 collateral discount-rate entries and **243 real maintenance-margin ladders (1,778 bands)**, content-hashed; each ladder is verified contiguous with non-decreasing maintenance rate by `pnpm verify:offline` |
| `/api/v3/market/candles` (public) | Confirmed the F8 silent-fallback trap live; guarded against in code (`packages/data/src/guards.ts`) so no future code path can be fooled by it |
| bitget-signal MCP (public, no key) | 19 tools across 5 skills (macro, market-intel, sentiment, technical, news), live-confirmed, disk-cached for offline replay |
| The recorded chain itself (`data/clock/raw/e1.jsonl`) | 44,603 ticks replayed through the kernel to measure **reference lag** - see the Clock replay section |
| Isopleth as a tool for other agents (MCP) | Six read-only tools over the kernel and the measurements; any MCP client can call them, none can place an order |
| Gemini / Qwen (one env var) | Narrates kernel results through a real multi-step tool-calling loop, never computes one — the product runs fully with `LLM_PROVIDER=none` |

## Research quality

- **E1** (Collateral Clock): recording since 2026-10-04, now via a confirmed-live GitHub Actions cron. **43,883 ticks across 241 pairs** as of this writing. 2 confirmed freeze+thaw transitions in thin-liquidity names (AEHRUSDT, LYTEUSDT); the documented session-wide freeze has **not yet** been confirmed in a liquid name — stated as `PARTIAL`, not rounded up to `PROVEN`. The next clean test window is the 2026-10-09–12 weekend. Full detail: [DISCOVERY.md](DISCOVERY.md).
- **E2**: instrument scan + tier-ladder capture, both live-confirmed, 84/325 symbols correctly excluded rather than guessed (index futures, HK-listed names, non-rToken names).
- **E3**: F8 trap confirmed live with raw evidence (`data/clock/e3-fallback-trap.json`).
- **E4**: 31 closed-market windows built from the live NYSE 2026 calendar; the null-control rule is pre-registered in writing *before* any replay ran ([pre-registration.md](data/windows/pre-registration.md)), and the replay harness (`pnpm discovery:e4:replay`) is built and real — it reports **0/31 windows replayable today**, honestly, because no window in the set has fully elapsed since the recorder started. This is a calendar fact, not a build gap; re-running after 2026-10-12 is expected to produce the first real values.
- **E6**: LLM layer probed for whichever provider is configured — never blocks on Qwen; the product's own tool loop is exercised end-to-end by `tests/unit/tool-loop.test.ts` with zero network calls.

## The technical discovery

See [DISCOVERY.md](DISCOVERY.md) for the full writeup, including the name-collision check and the honest N=2-so-far state of the headline measurement. In short: `C1` (instrument discovery), `C2` (the F8 silent-fallback trap), `C3` (tier ladder capture, now with 243 real maintenance ladders), `C8` (reference lag, measured), `C9` (verifiable receipts) and `C10` (read-only MCP surface) are `PROVEN` with live evidence; `C4` (the Collateral Clock itself) and `C11` (break campaign) are `PARTIAL`; `C5`–`C7` are stated `UNKNOWN` rather than inflated. See [Proof](#proof) for the live-rendered version of this ledger.

## Counterfactual margin surface

The `/workbench` route runs a real demo book through `@isopleth/core`'s kernel, locates the contour by bisection, and renders it as SVG with a one-time orchestrated draw-in animation (skipped under `prefers-reduced-motion`) — gaps where the kernel refused are drawn as gaps, never bridged. The same route now also accepts **your own book** — pasted JSON, or uploaded `.json`/`.csv` — recomputed server-side through the identical code path, with a "What are you protecting?" personalized thesis field that flows into both the AI narration and an exportable risk plan.

## Clock replay: reference lag, measured

The distinctive part of this build. Bitget values rToken collateral off a reference price that is not the market price, and the public reference index can sit unchanged while spot keeps moving. Isopleth does not assume how much that matters; it measures it from its own hash-chained recording and replays it through the kernel.

For every recorded tick the replay compares the reference index to market spot, then evaluates a fixed leveraged book twice: collateral valued at the reference, and collateral valued at spot. The difference is the margin exposure created by reference lag. Prices are real (`REPLAYED`); the book is `SYNTHETIC`.

Measured over **44,603 ticks on 240 rToken pairs**: the reference index was unchanged from the previous tick **17.5%** of the time; the median gap between spot and reference was **0.114%** (95th percentile 0.559%); the longest single freeze was **447 minutes** (JMKEUSDT). One pair (BYDUSDT) shows a 612% gap and is separated out as a unit-mapping anomaly rather than ranked as lag. In this quiet week the margin shift is small (a little over 1 percentage point at the extreme), and the page says so. Whether Bitget's private engine values collateral at the public reference is claim C5 and is still open, so both valuations are shown instead of one being assumed. Live at [`/scenarios`](https://isopleth-blue.vercel.app/scenarios); rebuild with `pnpm replay:build`.

## Ask the desk, and Isopleth as an MCP server

**Ask bar** (`/workbench`): preset chips ("Where does my book break first?", "What if rAAPL reopens down 7%?", "What is the smallest move that keeps me safe?", "How frozen is the reference clock?"), a free question box, and the thesis line ("What are you protecting?") shown above every answer. Intent is routed by explicit rules to the same read-only tools exposed over MCP, and the answer text is assembled by code from the tools' outputs, so it is labelled `NARRATION: TEMPLATE` and no model can invent a number in it. Every tool call is shown beneath the answer and expands to its raw input and output.

**MCP server** (`POST /mcp`, Streamable HTTP): `isopleth_evaluate_book`, `isopleth_minimum_intervention`, `isopleth_locate_contour`, `isopleth_clock_status`, `isopleth_reference_lag`, `isopleth_verify_receipt`. Read-only by construction: there is no order, transfer or write tool, and unknown tools are refused. Use it beside Bitget's own server:

```bash
claude mcp add isopleth --transport http https://isopleth-blue.vercel.app/mcp
```

## Verifiable receipts

Every kernel answer carries a receipt: SHA-256 over the engine version, the canonical input and the result. `isopleth_verify_receipt` (or the "verify" link under any Ask-bar answer) recomputes it from the original input without trusting the server, and a one-dollar edit to the result breaks it. `pnpm verify:offline` checks this round trip on every push.

## Where this sits among other builds

Other entries in this sub-theme stress-test a *trade idea* against the return history of one perpetual. Isopleth stress-tests the *account*: the cross-asset margin that decides whether any trade idea survives. It does this with a deterministic kernel rather than a debate, measures a mechanism (the reference clock) that Bitget does not publish, refuses rather than guesses on missing inputs, and ships an offline verifier and a break campaign. It is not a signal generator and has no track record to show; it does not claim one.

## LUI fluency

Provider-agnostic LLM layer (`packages/llm`): Gemini today, Qwen via one env var once credits arrive, `none` (deterministic template) as the zero-network fallback. Narration runs through a **real multi-step tool-calling loop** (`packages/llm/src/toolLoop.ts`) — the model is given no numbers upfront and must call `get_current_margin`, `get_stressed_margin`, `get_intervention_plan`, or `get_user_thesis` to fetch exactly what it needs before answering, bounded at 7 steps (four tools plus a final answer, with earlier tool results carried forward each turn) so a misbehaving driver can never loop forever (tested with a scripted fake driver, zero network, `tests/unit/tool-loop.test.ts`). A number-binding guard then rejects any narrated number not already in the kernel's output and falls back to a deterministic template — proven driver-independent by a test that runs the same book through two different drivers and asserts byte-identical kernel output (`tests/unit/number-binding.test.ts`). Wired live into the product at `/api/narrate`, called from the Workbench's "Explain with AI" button.

## Personalized thesis

The Workbench's "Your book" panel asks **"What are you protecting?"** — a free-text thesis carried into both the AI narration prompt and the exported risk plan (`.txt`) and recheck reminder (`.ics`), alongside the manual JSON/CSV book input that recomputes the real kernel server-side (`/api/evaluate`, validated fail-closed by `apps/web/lib/bookValidate.ts` for JSON and `apps/web/lib/csvBook.ts` for CSV).

## Bitget integration

Public UTA v3 market data (instruments, tickers, discount-rate, position-tier, candles); the bitget-signal MCP (19 tools, live-confirmed, disk-cached); and Isopleth's own read-only MCP server so Bitget's agent tooling can call the kernel directly. Optionally a read-only key (E5, never a prerequisite; any key carrying trade, withdraw or unrecognised permissions is refused at boot, break attack B11).

## What is measured vs. modelled

See [METHOD.md](METHOD.md). Short version: the rToken universe, tier ladders, and the F8 trap are **MEASURED**. The margin kernel's output is **MODELLED**, with an explicit `evidence` field (`SYNTHETIC` for demo books, `MEASURED` where it traces to the recorder) on every result. The reference-clock freeze/thaw is still being measured, not yet confirmed in a liquid name.

## Validation and benchmarks

`pnpm bench` — two parts, reported honestly and separately because they rest on different evidence:

- **Synthetic account-grid benchmark** (leverage × collateral share × position size, 36 accounts, kernel-only, zero network): of 12 accounts breached under a fixed stress scenario, Isopleth's optimizer found a restoring plan **100%** of the time, at an average cost of **$6,375**. A control that spends the identical dollar amount on a *uniformly random* action restores the threshold only **58.3%** of the time — a real, measured gap showing the optimizer beats blind capital allocation. A control that spends the same amount as plain, untargeted cash top-up ties the optimizer at **100%** in this grid — stated plainly, not hidden: in this kernel, `ADD_CASH` is both the cheapest first-tried candidate action and directly capital-equivalent to equity, so at equal cost a sensible-but-untargeted cash injection performs identically to the optimizer's own frequent choice of the same action. The optimizer's distinct value shows up against *random* allocation, not against *sensible* allocation, in this particular grid — see `data/bench/results.json` for the full numbers and the "what would make this false" line.
- **Window-set replay benchmark** (the pre-registered E4 rule): **not yet run** — correctly reported as `INSUFFICIENT_N` rather than backfilled, because 0 of the 31 windows in `data/windows/window-set.json` have fully elapsed since the recorder started (2026-10-04). The harness (`packages/core/src/e4stat.ts`, `scripts/discovery/e4-replay.ts`) is built, unit-tested (`tests/unit/e4stat.test.ts`), and will produce real numbers after the 2026-10-09–12 weekend passes.

Accounts are labelled `SYNTHETIC`, market data `REPLAYED`/`none`, per the project's evidence-class convention throughout.

## Break campaign

`pnpm break` - **12 of 13** attacks verified against the real kernel (0 failed). The thirteenth is blocked by time, not by build. Full results: [`data/break/results.json`](data/break/results.json).

| ID | Attack | Result |
|---|---|---|
| B1 | Reference state UNKNOWN | PASS - refused |
| B2 | Missing tier data | PASS - refused |
| B3 | Notional exactly on a tier boundary | PASS - deterministic |
| B4 | Collateral ladder changes mid-window | PASS - both rulesets replay byte-identically, the v1 plan is invalidated with a stated reason under v2 |
| B5 | Position crosses a maintenance tier | PASS |
| B6 | Prompt injection, worst case (the model obeys it) | PASS - kernel output byte-identical, invented number rejected, evidence label unchanged |
| B7 | LLM narration contains an invented number | PASS - rejected |
| B8 | One byte edited in a stored clock snapshot | PASS - the real 44k+ record hash chain verifies clean, a tampered copy is caught |
| B9 | Duplicate hash in the real tick log | PASS - zero duplicates |
| B10 | Public API schema drift (simulated) | PASS - five drifted shapes all refused loudly; this attack found a real flaw (a record with null prices had been chained silently), now fixed |
| B11 | Key with trade permission at boot | PASS - refused; unknown permissions fail closed |
| B12 | rToken candle `type=index` misuse | PASS - guard throws |
| B13 | Null/permuted control | `NOT_YET` - the permutation harness is real and tested, but needs 2 fully elapsed closed-market windows, and the next one is the 2026-10-09 to 12 weekend |

## Evidence manifest

[EVIDENCE_MANIFEST.md](EVIDENCE_MANIFEST.md) indexes every artifact. `pnpm manifest` writes `data/manifests/run_manifest.json` (git commit, file hashes, lockfile hash, engine version). `pnpm verify:offline` then recomputes the margin kernel against golden fixtures, re-verifies the clock hash chain, confirms every manifested file still hashes the same, re-checks all 243 captured maintenance ladders, and round-trips a result receipt - **7/7 checks passing, zero network, zero model calls**. CI (`.github/workflows/ci.yml`) runs typecheck, tests, the secret scan, the offline verifier and the break campaign on every push.

## Honest limitations

Stated first, not buried: [LIMITATIONS.md](LIMITATIONS.md). Leads with "the headline measurement isn't confirmed yet": only 2 thin-liquidity pairs show a confirmed freeze and thaw, and the documented session-wide freeze has not yet been confirmed in a liquid name. Also true as of this writing: the E4 window-set replay has N=0 (calendar-blocked); tier boundary inclusivity and marginal-vs-aggregate application (C6) remain unknown because a ladder cannot say how its own bands are applied; the Qwen wire is built but untested live pending `QWEN_API_KEY`, and the live narration provider is Gemini on a free-tier quota, with a verified deterministic template served when the model is unavailable; CSV book input is a single-tier simplification; the reference-lag replay covers a quiet week and its margin effect is small.

## Target user and revenue

Semi-professional cross-asset traders and small desks holding rTokens as UTA Advanced Mode margin. Revenue: per-seat pro tier, API for desks, embeddable margin-safety widget.

## Roadmap

Immediate next: confirm a liquid-name freeze and thaw over the 2026-10-09 to 12 weekend (the recorder runs on a 10-minute GitHub Actions cron); re-run `pnpm bench`, `pnpm discovery:e4:replay` and the B13 null control once that window has elapsed; wire Qwen once credits arrive; resolve C5 and C6 with an optional read-only key probe.

## Local setup

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm verify:offline
pnpm break
pnpm bench
pnpm replay:build
pnpm secrets:scan
pnpm run sync:web && pnpm --filter @isopleth/web dev
```

Works from a clean clone — nothing above needs an API key.

## Docs index

[MILESTONE.md](MILESTONE.md) · [PROGRESS.md](PROGRESS.md) · [DISCOVERY.md](DISCOVERY.md) · [CLAIMS.json](CLAIMS.json) · [PROOF.md](PROOF.md) · [EVIDENCE_MANIFEST.md](EVIDENCE_MANIFEST.md) · [METHOD.md](METHOD.md) · [LIMITATIONS.md](LIMITATIONS.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [CONTRIBUTIONS.md](CONTRIBUTIONS.md) · [SUBMISSION.md](SUBMISSION.md)
