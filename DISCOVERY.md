# DISCOVERY.md

Living document. Updated as Phase A (and later phases) produce real evidence.
Every entry here must point at a file that actually exists in this repo — no
entry is written from memory of what the script *should* produce.

---

## Name collision check (FINAL_INSTRUCTION.md §1.4)

Run 2026-10-05, before repo lock, as required.

| Surface | Result |
|---|---|
| GitHub | One unrelated hit: [`NUDelta/Isopleth`](https://github.com/NUDelta/Isopleth), an academic JS sensemaking tool, inactive, no overlap in domain (not finance, not Bitget, not a hackathon entry). No `bitget`/trading-named `isopleth*` repo found. |
| npm | Registry search (`registry.npmjs.org/-/v1/search?text=isopleth`) returns one hit: `gg-team-isopleth-illegalizing`, an unrelated bot-published spam package. The bare name `isopleth` is unpublished. |
| Domain | No conclusive WHOIS/registration evidence found either way for isopleth.com/.io/.app via web search; not independently resolved to a live site in either direction. Treat as unresolved, not a blocker — re-check via a direct registrar lookup before any real domain purchase. |
| X / Twitter | No account or post found combining "isopleth" with Bitget, crypto, or trading. No hackathon-entry collision found. |

**Verdict:** no live, active, finance-relevant collision on any surface. Proceeding with the name per FINAL_INSTRUCTION.md §0 ("Keep the name ISOPLETH"). The one GitHub hit is noted for the record, not treated as disqualifying — it is a different domain entirely and has no bearing on brand confusion with a Bitget hackathon trading tool.

---

## E1 — Collateral Clock (the headline measurement)

**Claim under test:** the public stock-perp `indexPrice` freezes and thaws on a schedule not published to the minute (U1), and it is unknown whether it is live, stale, or frozen during the weekday overnight session (U2).

**Status: IN PROGRESS, not yet confirmed.** The recorder ([`scripts/discovery/e1-collateral-clock.ts`](scripts/discovery/e1-collateral-clock.ts)) has been running since 2026-10-04 ~20:30 ET, hash-chaining one tick per pair per minute to [`data/clock/raw/e1.jsonl`](data/clock/raw/e1.jsonl). As of 2026-10-05 ~01:05 UTC: 4,321 records across 241 pairs.

Segmentation ([`scripts/discovery/segment-clock.ts`](scripts/discovery/segment-clock.ts) → [`data/clock/clock-map.json`](data/clock/clock-map.json)) classifies every sample into `OPEN_LIVE` / `MARKET_CLOSED_FROZEN` / `REOPENING` / `STALE` / `UNKNOWN`, requiring >= 10 consecutive constant-`indexPrice` samples to confirm a freeze (never asserted on weaker evidence) and treating any >5-minute sampling gap as `UNKNOWN` rather than bridging it.

**Current honest result:** 0 pairs have a *confirmed* freeze+thaw cycle yet (the recorder has only been running through a Monday trading session so far — no weekend/holiday close has elapsed within the recording window). This is stated as N=0-so-far, not hidden or padded. It is expected: Gate A explicitly allows stating "not yet observed" when the window hasn't elapsed (§4.8).

**Early, sub-threshold signal (not a finding, a reason to keep recording):** of the 241 pairs, 31 already show the *qualitative* freeze signature over every sample captured so far (indexPrice constant while markPrice or spot moved at least once) — those just haven't reached the 10-sample confirmation run length yet, since the recorder only started a few hours ago. The remaining pairs show indexPrice, markPrice and spot all idle together in short stretches (`STALE`), which is a small, premature data point toward U6 (whether markPrice floats or clamps to the frozen index) — too little data to publish as a result.

**What would confirm this discovery:** the recorder running through the next full weekend close (`2026-10-09 20:00 ET` Friday close per the NYSE calendar → `2026-10-12` Monday reopen, see [`data/windows/window-set.json`](data/windows/window-set.json) id `2026-10-09_to_2026-10-12`) with no sampling gaps, producing a confirmed `MARKET_CLOSED_FROZEN` segment >= 10 samples long followed by a `REOPENING` transition.

**Classification:** MEASURED (recording in progress), UNCONFIRMED (threshold not yet reached).

---

## E2 — Instrument scan + rules extraction

**Claim under test:** the rToken universe and its collateral/maintenance tier ladders can be discovered live from public endpoints without hardcoding a symbol list.

**Status: DONE, with honest exclusions.**

- [`scripts/discovery/e2-instrument-scan.ts`](scripts/discovery/e2-instrument-scan.ts) discovered 325 futures instruments with `symbolType === "stock"` and matched 241 of them to an rToken spot symbol via the documented `r` + ticker convention (F10). 84 were correctly excluded rather than guessed: index futures with no rToken counterpart (`SP500USDT`, `NDX100USDT`, `HSIUSDT`, `JP225USDT`, `KR200USDT`), Hong Kong / Korea / Japan-listed names not in the rToken set (`SAMSUNGUSDT`, `TENCENTUSDT`, `XIAOMIUSDT`, ...), and private/OTC names that are not public equities at all (`OPENAIUSDT`, `ANTHROPICUSDT`, `POLYMARKETUSDT`). Raw instrument dumps for both categories are preserved in `data/clock/instruments-raw/` for anyone who wants to re-derive the matching by hand.
- [`scripts/discovery/e2-rules-extraction.ts`](scripts/discovery/e2-rules-extraction.ts): the bulk no-param `discount-rate` call worked on the first attempt (520 entries, one call, no per-coin fallback needed — the v2-documented no-param shape held in v3). 244 position-tier ladders captured (241 stock perps + BTCUSDT/ETHUSDT/SOLUSDT). Every capture is content-hashed into `data/clock/rules/` so a mid-window change is both detected and independently replayable (B4).

**Still UNKNOWN:** U5 (marginal vs aggregated tier application) and U8 (inclusive/exclusive tier boundary semantics). The ladder shape is captured, but confirming the exact boundary convention needs either the verbatim text of Bitget's support article (F3/F4 — this build environment cannot re-fetch bitget.com support articles directly; see "Re-fetch limitation" below) or a live authenticated probe at the exact boundary value (E5, optional, not yet available). The kernel's planned convention (tiers cover `(lo, hi]`, per FINAL_INSTRUCTION.md §6.2) is labelled an **assumption**, not a verified fact, until one of those lands.

**Classification:** MEASURED (instrument universe, tier ladders) / UNKNOWN (boundary semantics).

---

## E3 — Silent-fallback trap (F8)

**Claim under test:** rToken candle requests with `type=index`, `mark`, or `premium` silently return `type=market` data with no error.

**Status: CONFIRMED LIVE**, 2026-10-05. [`scripts/discovery/e3-silent-fallback-trap.ts`](scripts/discovery/e3-silent-fallback-trap.ts) probed `RTSLAUSDT` with all four `type` values; `index`, `mark`, and `premium` responses were byte-identical to `market`. Evidence: [`data/clock/e3-fallback-trap.json`](data/clock/e3-fallback-trap.json).

A permanent guard now exists at [`packages/data/src/guards.ts`](packages/data/src/guards.ts): any future code path requesting a non-`market` rToken candle type throws immediately instead of silently receiving market data under a different label. Documented for the wider community in [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md).

**Classification:** MEASURED, CONFIRMED.

---

## E4 — Historical windows and the null control

**Status: calendar scaffold DONE, replay NOT STARTED.**

- [`data/calendar/nyse-2026.json`](data/calendar/nyse-2026.json): fetched live from nyse.com 2026-10-05. 10 full closures, 2 early-closes for calendar year 2026.
- [`scripts/discovery/e4-build-windows.ts`](scripts/discovery/e4-build-windows.ts) → [`data/windows/window-set.json`](data/windows/window-set.json): 31 closed-market windows built from 2026-06-04 (rToken margin launch, F5) through 2026-12-31. Pure calendar arithmetic, no network dependency, already run.
- [`data/windows/pre-registration.md`](data/windows/pre-registration.md): the null-control rule (shadow predictor informative only if it beats null LOO-MAE by >= 20% AND beats a 10,000-permutation shuffle control at p < 0.05) is fixed now, in writing, before any replay has run.

**Not yet built:** the actual replay step that fetches candles per window and computes `G_w`. This needs live connectivity (available) plus, practically, real post-launch windows that have actually elapsed with E1 recording through them — the earliest useful window is the one starting 2026-10-09 above.

**Classification:** SYNTHETIC (calendar scaffold only) — no empirical `G_w` values exist yet.

---

## E5 — Optional private verification

**Status: NOT STARTED.** No credentials supplied. Per FINAL_INSTRUCTION.md §4.6 this is never a prerequisite for anything else and stays optional throughout.

---

## E6 — LLM and MCP probes

**Status: DONE for what's configured now; Qwen wire untested (no key yet).**

The LLM layer (`packages/llm`) is provider-agnostic by design (`gemini` / `qwen` / `none`, selected by `LLM_PROVIDER`). `scripts/discovery/e6-llm-probe.ts` probes whichever provider is actually configured and does not block on Qwen. Run 2026-10-07, result in `docs/sources/e6-llm-probe-result.json`:

- **Gemini** (current default): no `GEMINI_API_KEY` supplied yet, so the driver correctly fell back to the `none` template driver rather than failing silently or crashing. Nothing about the wire has been confirmed yet — re-run once a key is added.
- **Qwen**: untested, no key yet. The driver is written and typechecked against the documented OpenAI-compatible wire shape, not yet exercised live.
- **bitget-signal MCP** (public, no key): confirmed reachable and live. Real endpoint `https://datahub.noxiaohao.com/mcp`, streamable-HTTP JSON-RPC, requires an `Mcp-Session-Id` from `initialize` on every subsequent call (not documented anywhere public — found by extracting and reading the real `@bitget-ai/bitget-signal@1.2.0` npm package's `scripts/install.js`, not guessed). Full live tool list (19 tools across the 5 skills) captured in `docs/mcp-tools.json`. A test call (`sentiment_index`, action=current) returned a reachable response with an internal error string in its payload (`alt_me_error`) — the MCP transport itself works, something inside that specific tool's own backend did not return clean data on this call. Logged honestly, not retried into looking clean.

**Not yet probed:** native tool-calling and JSON-mode support for Qwen specifically (needs the key). Neither driver implements a tool-calling surface yet — `packages/llm/src/types.ts` has no tool-calling fields; that's deferred to Phase E's tool loop, not silently assumed to work.

---

## Re-fetch limitation (process note, not a discovery)

FINAL_INSTRUCTION.md §3 asks to re-fetch every documented source (F1-F14) into `docs/sources/` with a capture date. This build's tool environment can reach `api.bitget.com` (confirmed working as of 2026-10-05) but intermittently could not reach `bitget.com` support-article pages and the Bitget marketing site directly from the same tooling earlier in the session (see `PROGRESS.md` for the full diagnostic). `nyse.com` and other non-Bitget sources fetch normally. F1-F14 are therefore currently taken on the authority of FINAL_INSTRUCTION.md itself (already-verified facts per its own text), not independently re-captured into `docs/sources/` yet. This is flagged explicitly rather than silently treated as done — revisit before Gate A is declared closed.

---

## Gate A exit criteria (FINAL_INSTRUCTION.md §4.8) — current status

See [`TASK.md`](TASK.md) for the full checklist. Summary: 4 of 6 criteria not yet met. Phase B has not started.
