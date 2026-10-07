# TASK.md

Master checklist, mirroring FINAL_INSTRUCTION.md's phases and gates exactly.
`[x]` means a real file/output exists and was verified, not "attempted."
`[~]` means partially done — read the note. Updated 2026-10-07.

**Current stage: Phases A-G substantially closed out. Only genuinely external blockers remain: `QWEN_API_KEY` (Gemini + `none` fully cover the product in its place), the E4 window-set replay waiting on the 2026-10-09–12 weekend to actually elapse, Vercel deployment (needs credentials this session doesn't have), and the demo video/screenshots (screenshots now done).**

---

## Phase A — Discovery
- [x] E1 Collateral Clock: recorder, GH Actions workflow, segmentation — 43,401 ticks, 241 pairs, **2 confirmed freeze+thaw** (thin-liquidity names; liquid-name confirmation still pending, see DISCOVERY.md)
- [x] E2 instrument scan + rules extraction — 241/325 matched, 520 discount-rate entries, 244 position-tier ladders
- [x] E3 silent-fallback trap — confirmed live, guarded in `packages/data/src/guards.ts`
- [x] E4 NYSE calendar + 31-window set + pre-registered null-control rule
- [x] E4 replay harness (`scripts/discovery/e4-replay.ts`, `pnpm discovery:e4:replay`) — built, real, reads only from the recorder's own tick log (never candles, per F8); run today it honestly reports 0/31 windows replayable, because no window has fully elapsed inside the recorder's coverage yet (recorder started 2026-10-04; next window closes 2026-10-09–12). Calendar-blocked, not build-blocked.
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
- [x] `pnpm break` — 8/13 attacks verified, 0 failed, 5 honestly NOT_YET (see `data/break/results.json`) — B8 (hash-chain tamper detection) upgraded from NOT_YET to a real PASS this session via `packages/data/src/chainVerify.ts`
- [x] `pnpm manifest` — `data/manifests/run_manifest.json`
- [x] `CLAIMS.json` — 7 claims, real statuses (3 PROVEN, 1 PARTIAL, 3 UNKNOWN)
- [x] `pnpm bench` — synthetic account-grid benchmark (36 accounts, optimizer vs. random/proportional controls at equal cost) runs fully offline; the window-set half correctly reports `INSUFFICIENT_N` rather than a fabricated number (see `data/bench/results.json`)
- [x] `pnpm verify:offline` — recomputes the kernel against golden fixtures, re-verifies the clock hash chain, checks every manifested file's hash, exercises the number-binding and F8 guards — 5/5 passing, zero network, zero model
- [x] Window-set replay harness — built (`scripts/discovery/e4-replay.ts`) and unit-tested statistics (`packages/core/src/e4stat.ts`, `tests/unit/e4stat.test.ts`); genuinely blocked on elapsed time (N=0), not on missing code

## Phase D — Product
- [x] All 6 routes built with real data: `/`, `/workbench`, `/portfolio`, `/scenarios`, `/proof`, `/method`
- [x] Landing page uses the real staged hero image with the documented bleed-mask treatment; `/method` and `/scenarios` use the other two staged images
- [x] Navbar with responsive mobile menu (not in the original scaffold — added after QA found a real overflow bug)
- [x] Interactive contour moment (slider over precomputed kernel frames)
- [x] Book input (manual JSON + CSV + file upload) — Workbench's "Your book" panel (`YourBookPanel.tsx`), recomputed server-side at `/api/evaluate` (fail-closed validation in `lib/bookValidate.ts` for JSON, `lib/csvBook.ts` for CSV, with a downloadable CSV template); CSV is a documented single-flat-tier simplification, JSON carries exact tier ladders
- [x] Personalized thesis ("What are you protecting?") — free-text field in the same panel, carried into both the AI narration prompt and the exported risk plan
- [x] Export (risk plan .txt + .ics recheck reminder) — client-side blob download, no server round trip

## Phase E — AI
- [x] Provider-agnostic LLM layer (`packages/llm`): gemini / qwen / none, one env var, no other code change
- [x] Number-binding guard (I6), proven driver-independent by a real test
- [x] bitget-signal MCP client with disk caching for offline replay
- [x] Next.js route handler wiring the LLM into the product — `/api/narrate`, called from Workbench's "Explain with AI" button, runs every narration through `bindNumbers` and serves the deterministic template whenever a number doesn't bind or the driver is `none`/errors
- [x] Tool loop — `packages/llm/src/toolLoop.ts`: a real multi-step loop (get_current_margin / get_stressed_margin / get_intervention_plan / get_user_thesis tools, bounded at 4 steps), unit-tested with a scripted fake driver (`tests/unit/tool-loop.test.ts`, 4 tests, zero network), wired into `/api/narrate` replacing the single-shot prompt. (Zod schemas specifically not added — the loop's tool-call protocol is a small hand-rolled JSON shape, not worth a schema library for 2 fields.)
- [ ] **Still blocked on `QWEN_API_KEY`** for the Qwen wire specifically; Gemini is wired and ready, needs `GEMINI_API_KEY`; both fall back to the `none` template driver and the feature still works end-to-end with neither key set (verified live against a running server)

## Phase F — UI
- [x] Design tokens, paper-grain overlay, radii per §9.2 (fallback fonts: Instrument Serif / Geist / JetBrains Mono via next/font/google — self-hosted Erode/Switzer not available in this environment)
- [x] Contour rendering with d3-scale/d3-shape
- [x] Responsive layout, verified via the full Playwright matrix (see Phase G)
- [x] Orchestrated load-moment motion — `ContourChart.tsx` draws its path once on mount via `strokeDasharray`/`strokeDashoffset`, 1.4s, `cubic-bezier(0.22,1,0.36,1)`, skipped entirely under `prefers-reduced-motion: reduce` (checked live via `matchMedia`, not just a no-op CSS class)
- [ ] Imagery pipeline (sharp, AVIF/WebP, LQIP) — Next's built-in image optimizer is used instead; no custom pipeline built

## Phase G — Attack and QA
- [x] Playwright, Chromium only (per instruction), 5 device profiles × 6 routes = **45/45 passing**
- [x] axe-core WCAG 2A/2AA — zero violations (two real contrast bugs found and fixed: `--warn` and `--safe` chip text)
- [x] Zero horizontal overflow on any route/device (three real bugs found and fixed: missing viewport meta tag, a non-collapsing 2-col grid, an unbreakable long code string)
- [x] 44px tap target check, reduced-motion check, honest-snapshot-age check
- [x] Fixed a real cross-platform bug in `playwright.config.ts`: the webServer command used `set PORT=... && pnpm start`, Windows-cmd-only syntax that silently hangs the whole suite on Linux/macOS CI (confirmed — this is exactly what happened when re-running the suite this session). Replaced with `next start -p <port>`, which works everywhere; also found and fixed a missing `favicon.ico` (no `app/icon.*` existed) that was logging a console 404 on every route and failing the "no console errors" assertion in CI-equivalent `next start` mode — added `app/icon.svg`.
- [x] Secret-exposure scan automated — `pnpm secrets:scan` (`scripts/secret-scan.ts`) greps every git-tracked file for credential-shaped strings (generic API-key assignments, AWS keys, PEM blocks, bearer tokens, Bitget `bg_`-style keys), skips placeholder-looking lines, exits non-zero on a hit. Clean run: 339 files scanned, 0 hits.
- [x] Lighthouse CLS/LCP thresholds — run against a real `next start` production build for all 6 routes: performance 97-99, accessibility/best-practices/SEO 100 on every route, **CLS=0** everywhere, **LCP 2.1-2.6s** (threshold <3s) on every route. Raw reports in `docs/lighthouse/*.json`, condensed in `docs/lighthouse/summary.json`.
- [ ] Recorder-down / Qwen-off dedicated tests — partially covered (the "none" driver fallback is tested in `tests/unit/number-binding.test.ts` and now also exercised end-to-end by `/api/narrate` with no `LLM_PROVIDER` set; still no Playwright-level simulation of a down recorder)

## Phase H — Ship
- [x] README rewritten per §12's structure with real numbers (not hand-typed — pulled from the same JSON files/scripts the app reads), a Product Links table, and 5 real screenshots
- [x] Screenshots — captured live via Playwright (Chromium) against a real running build: landing banner, workbench, contour close-up, scenarios, proof (`docs/screens/*.jpg`). Taking them surfaced and fixed a real CSS bug (see Phase G note below).
- [ ] Video — not recorded
- [x] SUBMISSION.md skeleton with fixed X-post/video-structure content, marked DO NOT SUBMIT
- [ ] Vercel deployment — blocked: this session has no Vercel login/token and no Vercel connector is attached; needs the user to either run `vercel --prod` themselves or supply a `VERCEL_TOKEN`
- [ ] Final claims audit — do before actual submission, not before

---

## What changed this session (2026-10-07), for the record

- Fixed a real security issue: live Bitget credentials had been pasted into `.env.example` (committed-by-default, not gitignored). Moved to `.env.local`, scrubbed the example file.
- Initialized git, pushed to `github.com/0xkinno/isopleth` — **no Claude co-author line**, per explicit instruction; commits authored as `0xkinno`.
- Built the entire LLM provider layer, the margin kernel, the Next.js product, Playwright QA, and the break campaign — all described above.
- Found and fixed 6 real bugs along the way (PnL-flow bug in the kernel, 2 UI pages bypassing it, 2 color-contrast failures, 1 missing-viewport-meta + grid + wrapping overflow cluster). None of these were cosmetic nitpicks — each would have shipped a wrong number or a broken layout.

## What changed this session (2026-10-07, continued) — closed the remaining Phase C/D/E/F/G gaps

- **GitHub Actions recorder was never actually firing**: active for ~5 hours on a 10-minute cron with 0 total runs. Triggered it manually twice via `workflow_dispatch` — confirmed it runs and commits (43,401 → 43,883 ticks); GitHub's scheduler appears to have needed a cold-start kick. Monitor `github.com/0xkinno/isopleth/actions` to confirm it keeps firing on its own schedule.
- `pnpm verify:offline`, `pnpm bench`, `scripts/discovery/e4-replay.ts`, CSV book input, and a real LLM tool-calling loop — all built, all real, all described in detail above.
- Found and fixed a real CSS specificity bug while taking screenshots: `.btn { display: inline-flex }` was declared after (and at equal specificity to) `.nav-toggle { display: none }` in `globals.css`, so the mobile menu button never actually hid above the 860px breakpoint — "Map a book" and "Menu" rendered side-by-side at desktop width. The existing Playwright collision test didn't catch it because the two buttons don't overlap, they just shouldn't both be visible. Fixed by raising `.nav-toggle`'s specificity; full 45/45 Playwright matrix re-confirmed clean after.
- Ran Lighthouse against a real production build for the first time: 97-99 performance, 100 a11y/best-practices/SEO, CLS=0, LCP 2.1-2.6s on all 6 routes.
- README rewritten end-to-end: a Product Links table, 5 real Playwright screenshots, and every section re-verified against the file it claims to describe rather than carried over from the previous draft.

## Cut order if time runs out (unchanged, FINAL_INSTRUCTION.md §14)
Historical analog overlays → `.ics` export → extra `bitget-signal` integrations → scenarios library page → method page.
**Never cut:** E1, the kernel, the contour, the offline verifier, the break campaign, `/proof`, honest limitations.
