# TASK.md

Master checklist, mirroring FINAL_INSTRUCTION.md's phases and gates exactly.
`[x]` means a real file/output exists and was verified, not "attempted."
`[~]` means partially done — read the note. Updated 2026-10-07.

**Current stage: Phases A-D substantially built, G (QA) passing for what exists. Phase E blocked on QWEN_API_KEY (Gemini wired as default). Phase C's bench/replay and the full 13-item break campaign remain open.**

---

## Phase A — Discovery
- [x] E1 Collateral Clock: recorder, GH Actions workflow, segmentation — 43,401 ticks, 241 pairs, **2 confirmed freeze+thaw** (thin-liquidity names; liquid-name confirmation still pending, see DISCOVERY.md)
- [x] E2 instrument scan + rules extraction — 241/325 matched, 520 discount-rate entries, 244 position-tier ladders
- [x] E3 silent-fallback trap — confirmed live, guarded in `packages/data/src/guards.ts`
- [x] E4 NYSE calendar + 31-window set + pre-registered null-control rule
- [ ] E4 replay (real `G_w` values) — not built, needs more elapsed windows
- [ ] E5 (optional) — not started, no credentials supplied
- [x] E6 — LLM probe (provider-agnostic) + bitget-signal MCP confirmed live, 19 tools captured
- [x] Name collision check, reference repos cloned, research hygiene
- [~] Gate A — headline measurement still PARTIAL, not PROVEN; everything else closed

## Phase B — Mechanism
- [x] Types, margin kernel (`packages/core/src/margin.ts`), scenario operators, contour (bisection + I10 re-verification), minimum-intervention optimizer
- [x] Deterministic hashing (`packages/core/src/hash.ts`, I4)
- [x] Unit tests (8) + property tests (2, fast-check) + contour tests (2) — 14/14 passing
- [x] **Real bug found and fixed**: `applyScenario` wasn't flowing a mark-price shock into unrealized PnL, which made a crashing book look *safer*. Fixed in the kernel; two UI pages that had bypassed `applyScenario` with hand-rolled shocks (reintroducing the same bug) were fixed to route through it.
- [ ] Invariants I1, I2, I3, I5, I8, I9 have no *standalone* executable checker yet (I5/I9 are exercised by tests; I1/I2/I3/I8 are structural properties of the types, not separately checked)

## Phase C — Proof
- [x] `pnpm break` — 7/13 attacks verified, 0 failed, 6 honestly NOT_YET (see `data/break/results.json`)
- [x] `pnpm manifest` — `data/manifests/run_manifest.json`
- [x] `CLAIMS.json` — 7 claims, real statuses (3 PROVEN, 1 PARTIAL, 3 UNKNOWN)
- [ ] `pnpm bench`, baseline/control comparison — not built, needs E4 replay first
- [ ] `pnpm verify:offline` — not built
- [ ] Window-set replay harness — not built

## Phase D — Product
- [x] All 6 routes built with real data: `/`, `/workbench`, `/portfolio`, `/scenarios`, `/proof`, `/method`
- [x] Landing page uses the real staged hero image with the documented bleed-mask treatment; `/method` and `/scenarios` use the other two staged images
- [x] Navbar with responsive mobile menu (not in the original scaffold — added after QA found a real overflow bug)
- [x] Interactive contour moment (slider over precomputed kernel frames)
- [ ] Book input (manual/CSV/JSON/Demo) — Workbench runs a fixed demo book only
- [ ] Personalized thesis ("What are you protecting?") — not built
- [ ] Export (risk plan + .ics) — not built

## Phase E — AI
- [x] Provider-agnostic LLM layer (`packages/llm`): gemini / qwen / none, one env var, no other code change
- [x] Number-binding guard (I6), proven driver-independent by a real test
- [x] bitget-signal MCP client with disk caching for offline replay
- [ ] Next.js route handlers wiring the LLM into the product (no UI surface calls an LLM yet)
- [ ] Tool loop / Zod schemas — not built
- [ ] **Blocked on `QWEN_API_KEY`** for the Qwen wire specifically; Gemini is wired and ready, needs `GEMINI_API_KEY`

## Phase F — UI
- [x] Design tokens, paper-grain overlay, radii per §9.2 (fallback fonts: Instrument Serif / Geist / JetBrains Mono via next/font/google — self-hosted Erode/Switzer not available in this environment)
- [x] Contour rendering with d3-scale/d3-shape
- [x] Responsive layout, verified via the full Playwright matrix (see Phase G)
- [ ] Orchestrated load-moment motion — not built (static render only; `prefers-reduced-motion` has no animation to disable yet, which trivially satisfies that requirement but isn't the intent)
- [ ] Imagery pipeline (sharp, AVIF/WebP, LQIP) — Next's built-in image optimizer is used instead; no custom pipeline built

## Phase G — Attack and QA
- [x] Playwright, Chromium only (per instruction), 5 device profiles × 6 routes = **45/45 passing**
- [x] axe-core WCAG 2A/2AA — zero violations (two real contrast bugs found and fixed: `--warn` and `--safe` chip text)
- [x] Zero horizontal overflow on any route/device (three real bugs found and fixed: missing viewport meta tag, a non-collapsing 2-col grid, an unbreakable long code string)
- [x] 44px tap target check, reduced-motion check, honest-snapshot-age check
- [ ] Lighthouse CLS/LCP thresholds — not run
- [ ] Secret-exposure scan — not automated (checked by hand before the git push, see PROGRESS.md)
- [ ] Recorder-down / Qwen-off dedicated tests — partially covered (the "none" driver fallback is tested in `tests/unit/number-binding.test.ts`; no Playwright-level simulation of a down recorder)

## Phase H — Ship
- [x] README rewritten per §12's structure with real numbers (not hand-typed — pulled from the same JSON files the app reads)
- [ ] Screenshots — not captured
- [ ] Video — not recorded
- [x] SUBMISSION.md skeleton with fixed X-post/video-structure content, marked DO NOT SUBMIT
- [ ] Vercel deployment — in progress this session
- [ ] Final claims audit — do before actual submission, not before

---

## What changed this session (2026-10-07), for the record

- Fixed a real security issue: live Bitget credentials had been pasted into `.env.example` (committed-by-default, not gitignored). Moved to `.env.local`, scrubbed the example file.
- Initialized git, pushed to `github.com/0xkinno/isopleth` — **no Claude co-author line**, per explicit instruction; commits authored as `0xkinno`.
- Built the entire LLM provider layer, the margin kernel, the Next.js product, Playwright QA, and the break campaign — all described above.
- Found and fixed 6 real bugs along the way (PnL-flow bug in the kernel, 2 UI pages bypassing it, 2 color-contrast failures, 1 missing-viewport-meta + grid + wrapping overflow cluster). None of these were cosmetic nitpicks — each would have shipped a wrong number or a broken layout.

## Cut order if time runs out (unchanged, FINAL_INSTRUCTION.md §14)
Historical analog overlays → `.ics` export → extra `bitget-signal` integrations → scenarios library page → method page.
**Never cut:** E1, the kernel, the contour, the offline verifier, the break campaign, `/proof`, honest limitations.
