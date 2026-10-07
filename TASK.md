# TASK.md

Master checklist, mirroring FINAL_INSTRUCTION.md's phases and gates exactly.
`[x]` means a real file/output exists and was verified, not "attempted."
`[~]` means partially done — read the note. Updated 2026-10-05.

**Current stage: Phase A (Discovery), in progress. Phase B has not started.**

---

## Phase A — Discovery

### Setup
- [x] Monorepo scaffold: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json` (strict), `.gitignore`, `.env.example`
- [x] `pnpm typecheck` passes clean
- [ ] `.env.local` created locally (user-side; never committed)

### E1 — Collateral Clock
- [x] Recorder built: [`scripts/discovery/e1-collateral-clock.ts`](scripts/discovery/e1-collateral-clock.ts) (60s local loop)
- [x] Single-tick entry point for cron: [`scripts/discovery/recorder-tick.ts`](scripts/discovery/recorder-tick.ts)
- [x] Shared hash-chained tick logic: [`packages/data/src/tick.ts`](packages/data/src/tick.ts)
- [x] GitHub Actions workflow written: [`.github/workflows/recorder.yml`](.github/workflows/recorder.yml)
- [ ] Workflow actually pushed + Actions enabled on GitHub (reserved for the user — commits/pushes are explicitly not done by the assistant in this project)
- [x] Recorder running locally (user's terminal), accumulating since 2026-10-04 ~20:30 ET
- [x] Segmentation script: [`scripts/discovery/segment-clock.ts`](scripts/discovery/segment-clock.ts) → `data/clock/clock-map.json`
- [x] Segmentation bug found (REOPENING state propagating indefinitely) and fixed, 2026-10-05
- [ ] **At least one CONFIRMED freeze + thaw transition with ET instants and raw evidence** — not yet (N=0-so-far, honestly stated; needs the recorder to run through an actual close, earliest candidate 2026-10-09 weekend). **This is a Gate A blocker.**

### E2 — Instrument scan + rules extraction
- [x] Instrument scan: [`scripts/discovery/e2-instrument-scan.ts`](scripts/discovery/e2-instrument-scan.ts) → `data/clock/pairs.json` (241/325 stock perps matched to an rToken spot, 84 correctly excluded, not guessed)
- [x] Rules extraction: [`scripts/discovery/e2-rules-extraction.ts`](scripts/discovery/e2-rules-extraction.ts) → `data/clock/rules/` (520 discount-rate entries, 244 position-tier ladders, all content-hashed)
- [x] Tier ladders captured and version-hashed
- [~] Tier boundary semantics (U5 marginal-vs-aggregated, U8 inclusive/exclusive) — ladder shape captured, exact convention still UNKNOWN (needs E5 or a re-fetched support article; honestly flagged in DISCOVERY.md, not assumed)

### E3 — Silent-fallback trap
- [x] Probe built and run: [`scripts/discovery/e3-silent-fallback-trap.ts`](scripts/discovery/e3-silent-fallback-trap.ts)
- [x] F8 confirmed live against RTSLAUSDT, evidence at `data/clock/e3-fallback-trap.json`
- [x] Permanent code guard: [`packages/data/src/guards.ts`](packages/data/src/guards.ts)
- [x] Documented in [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md)

### E4 — Historical windows and null control
- [x] NYSE 2026 calendar fetched live: [`data/calendar/nyse-2026.json`](data/calendar/nyse-2026.json)
- [x] Window-set builder: [`scripts/discovery/e4-build-windows.ts`](scripts/discovery/e4-build-windows.ts) → 31 windows in `data/windows/window-set.json`
- [x] Null-control rule pre-registered in writing before any replay: [`data/windows/pre-registration.md`](data/windows/pre-registration.md)
- [ ] Replay step (fetch candles per window, compute `G_w`) — not built yet, needs an elapsed post-launch window
- [ ] Pre-registered rule actually tested against real `G_w` values — blocked on the above

### E5 — Optional private verification
- [ ] Not started. No credentials supplied. Never a prerequisite (by design).

### E6 — Qwen and MCP probes
- [ ] Blocked on `QWEN_API_KEY` (in transit from user as of 2026-10-05)
- [ ] `e6-qwen-probe.ts` — not written yet
- [ ] `e6-mcp-tools.ts` — not written yet

### Research / reference hygiene
- [x] 14 competitor/prior-hackathon repos shallow-cloned into `reference/` (gitignored, read-only, never named in the build)
- [x] `research/` scratch folder set up (gitignored)

### Gate A exit criteria (FINAL_INSTRUCTION.md §4.8)
- [ ] At least one freeze and one thaw transition measured, with ET instants and raw evidence, **or** the honest N=1/not-observed result written — *the honest not-yet-observed result IS written (DISCOVERY.md), but zero transitions have been confirmed; treat this box as open until a real confirmed transition lands*
- [x] Tier ladders and position tiers captured and version-hashed
- [x] The silent-fallback trap confirmed and guarded
- [x] Window set built with sources
- [x] Pre-registered control rule committed
- [ ] Break plan and proof plan written
- [ ] Name collision check — **done**, see DISCOVERY.md (no disqualifying collision found)
- [ ] `DISCOVERY.md` complete and current — in progress, living document

**Gate A is NOT yet closed.** Remaining blockers: a confirmed freeze+thaw transition, the break/proof plan, and (non-blocking per spec, but still open) E6 once the Qwen key arrives.

---

## Phase B — Mechanism
*(not started — waiting on Gate A)*
- [ ] Types (`packages/core/src/types.ts`)
- [ ] Reference state registry
- [ ] Collateral state machine
- [ ] Margin kernel (pure, deterministic)
- [ ] Scenario operators (6 operators)
- [ ] Counterfactual surface
- [ ] Isopleth contour (bisection-located, re-evaluated per I10)
- [ ] Minimum-intervention optimizer
- [ ] Deterministic serialization + hashes (I4)
- [ ] Unit + property tests (fast-check)
- [ ] Invariants I1-I5, I8-I10 each with an executable checker

## Phase C — Proof
*(not started)*
- [ ] Window set replay harness (builds on E4)
- [ ] Baseline + both controls (random top-up, proportional top-up)
- [ ] `pnpm bench` → `data/bench/results.json`
- [ ] `pnpm break` → `data/break/results.json` (B1-B13)
- [ ] `pnpm manifest` → `data/manifests/run_manifest.json`
- [ ] `CLAIMS.json` populated with real statuses
- [ ] `pnpm verify:offline`

## Phase D — Product
*(not started)*
- [ ] `/` landing
- [ ] `/workbench`
- [ ] `/portfolio`
- [ ] `/scenarios`
- [ ] `/proof`
- [ ] `/method`
- [ ] Real data in every view (no placeholder numbers)
- [ ] UI imagery staged: `public/img/IMG_1_Hero.jpeg`, `IMG_2.jpeg`, `IMG_3.jpeg` — **received from user 2026-10-05, not yet wired into any route**

## Phase E — AI
*(not started, blocked on QWEN_API_KEY)*
- [ ] Next.js route handlers
- [ ] Qwen adapter on the proven wire (E6 determines this)
- [ ] Tool loop + Zod schemas
- [ ] Number-binding guard (I6)
- [ ] Template fallback (Qwen-off path)
- [ ] MCP clients with response caching
- [ ] I6, I7 enforced and checked

## Phase F — UI
*(not started)*
- [ ] Self-hosted fonts (Erode, Switzer, JetBrains Mono)
- [ ] Paper grain, tokens, radii per §9.2
- [ ] Contour rendering (d3-scale/d3-shape)
- [ ] Motion (orchestrated load moment, respects prefers-reduced-motion)
- [ ] Imagery pipeline (`sharp`, AVIF/WebP, LQIP) using the staged `public/img/` assets
- [ ] Responsive layouts, 12-col grid

## Phase G — Attack and QA
*(not started)*
- [ ] B1-B13 full break campaign run against the real kernel
- [ ] Playwright matrix (iPhone SE/14 Pro, Pixel 7, Galaxy S9+, iPad Mini/Pro, desktop breakpoints)
- [ ] axe-core, zero violations
- [ ] Lighthouse thresholds (CLS < 0.02, LCP < 3s)
- [ ] Secret-exposure scan
- [ ] Recorder-down test, Qwen-off test
- [ ] Deterministic replay scan

## Phase H — Ship
*(not started)*
- [ ] README with generated numbers (never hand-typed) — see `README.md` for the current placeholder
- [ ] Screenshots
- [ ] Video (<3 min)
- [ ] Submission text — see `SUBMISSION.md` for the current skeleton
- [ ] X post
- [ ] Clean-clone install test
- [ ] Final claims audit

---

## Cut order if time runs out (FINAL_INSTRUCTION.md §14, for reference)
Cut from the top if needed: historical analog overlays → `.ics` export → extra `bitget-signal` integrations → scenarios library page (fold into workbench) → method page (fold into proof).
**Never cut:** E1, the kernel, the contour, the offline verifier, the break campaign, `/proof`, the honest limitations section.
