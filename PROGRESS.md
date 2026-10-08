# Progress

## 2026-10-05 — E1 + E2 instrument scan (first task, ahead of Phase A)

**Built, typechecked, not yet live-verified (see blocker below):**

- Monorepo scaffold: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json` (strict), `.gitignore`, `.env.example`.
- [`packages/data/src/client.ts`](packages/data/src/client.ts) — public Bitget v3 `bitgetPublicGet()`, no key, retry + timeout, never throws away a parsed-but-non-2xx envelope (fail-closed per I5).
- [`scripts/discovery/e2-instrument-scan.ts`](scripts/discovery/e2-instrument-scan.ts) — discovers stock perps (`symbolType === "stock"` on `USDT-FUTURES`) and matches each to its rToken spot symbol via the documented `r` + ticker convention (F10), live from `/api/v3/market/instruments`. Nothing hardcoded. Writes `data/clock/pairs.json` + raw timestamped instrument dumps to `data/clock/instruments-raw/` for provenance. Refuses (exit 1) rather than guessing if zero pairs match.
- [`packages/data/src/tick.ts`](packages/data/src/tick.ts) — shared hash-chained tick logic (one tick = one ticker fetch per pair + append to `data/clock/raw/e1.jsonl`), used by both entry points below so they can never drift into different record shapes.
- [`scripts/discovery/e1-collateral-clock.ts`](scripts/discovery/e1-collateral-clock.ts) — long-running local recorder, 60s cadence.
- [`scripts/discovery/recorder-tick.ts`](scripts/discovery/recorder-tick.ts) — single-tick entry point for the GitHub Actions cron.
- [`.github/workflows/recorder.yml`](.github/workflows/recorder.yml) — `*/10 * * * *` cron per FINAL_INSTRUCTION.md §4.2. **Not pushed** — needs the user's own `git init` + GitHub push + Actions enablement to go live (push is explicitly reserved for the user).
- `reference/` — 14 competitor/prior-hackathon repos shallow-cloned read-only, gitignored, never to be named in the build.
- `research/` — gitignored scratch for competitor notes.
- `pnpm typecheck` passes clean.

## BLOCKER: this machine cannot reach Bitget (or any crypto-exchange API) right now

`pnpm discovery:e2` failed with a network-layer timeout, not an API error. Diagnosed directly:

- `api.bitget.com` DNS resolves fine (via Cloudflare).
- Raw TCP connect to `api.bitget.com:443` **succeeds** (`Test-NetConnection` → `TcpTestSucceeded: True`).
- The actual HTTPS request then hangs and times out — reproduced with `curl`, with sandboxing disabled, and with PowerShell's native `Invoke-WebRequest` (not a Node/fetch-specific bug).
- Same timeout pattern against `okx.com` and `api.exchange.coinbase.com`. `google.com` and `api.github.com` respond normally (200 in ~1s).
- No proxy is configured (`netsh winhttp show proxy` → direct access).

This is the signature of an SNI-based block somewhere between this machine and these exchanges (router, ISP-level DPI, or a security/content filter categorizing crypto-exchange domains) — the TLS handshake with those specific hosts is being dropped while everything else works. It is not something fixable from inside this build: no amount of code or dependency changes will touch it.

**What's needed to unblock:** confirm from your own browser whether `https://www.bitget.com` and `https://api.bitget.com/api/v3/market/instruments?category=USDT-FUTURES` load at all on this network. If they don't, try a different network (mobile hotspot) or VPN, then re-run:

```bash
pnpm discovery:e2
pnpm discovery:e1
```

Once `pnpm discovery:e2` succeeds and writes `data/clock/pairs.json`, start `pnpm discovery:e1` (keep it running) and separately push the repo to GitHub with Actions enabled so `.github/workflows/recorder.yml` starts ticking every 10 minutes server-side — the freeze window is live now and every missed tick is unrecoverable data.

No API keys were needed for any of this (public-only). I'll flag separately, before Phase E, when the Qwen key and any optional Bitget read-only/Demo key are actually needed.

## 2026-10-05 — connectivity restored on your machine, Phase A continuing

You confirmed `pnpm discovery:e2` and `pnpm discovery:e1` run fine from your own terminal (241/325 stock perps matched to an rToken spot symbol; 84 correctly excluded — index futures like SP500/NDX100, HK-listed names, and non-rToken names like OPENAI/ANTHROPIC have no spot counterpart, so e2 refused to guess on those rather than fabricate a pairing). **Keep that `pnpm discovery:e1` window running — it's the only thing accumulating the hash-chained tick log.**

Important: live Bitget calls only work from **your** terminal. My own tool sandbox cannot reach `api.bitget.com` (or any crypto-exchange API) at all — confirmed independently of your network. So every live-data script below needs to be run by you; I built and typechecked them but cannot execute or verify their output myself.

**Built this round, typechecked, not yet run against live data:**

- [`scripts/discovery/e2-rules-extraction.ts`](scripts/discovery/e2-rules-extraction.ts) (`pnpm discovery:e2:rules`) — captures the discount-rate tier ladder per rToken and the position-tier ladder per stock perp + core crypto perps (BTC/ETH/SOL), content-hashes and timestamps every capture into `data/clock/rules/` so a mid-window ruleset change is detected and both versions stay replayable (B4). Tries a bulk no-param discount-rate call first, falls back to per-coin calls, and logs honestly which strategy worked rather than assuming the v2-documented shape still holds in v3.
- [`scripts/discovery/e3-silent-fallback-trap.ts`](scripts/discovery/e3-silent-fallback-trap.ts) (`pnpm discovery:e3`) — live-confirms F8 (rToken `type=index/mark/premium` candle requests silently return `type=market` data) against the first discovered pair, writes evidence to `data/clock/e3-fallback-trap.json`, and fails loudly if Bitget's behavior doesn't match the documented trap.
- [`packages/data/src/guards.ts`](packages/data/src/guards.ts) — the permanent code guard: any future code path that tries to request a non-market rToken candle type throws immediately instead of silently getting market data back.
- [`scripts/discovery/segment-clock.ts`](scripts/discovery/segment-clock.ts) (`pnpm discovery:clockmap`) — reads the accumulating `data/clock/raw/e1.jsonl`, classifies every sample into `OPEN_LIVE` / `MARKET_CLOSED_FROZEN` / `REOPENING` / `STALE` / `UNKNOWN` (freeze requires >= 10 consecutive constant-`indexPrice` samples while mark/spot still moves; a >5-minute sampling gap becomes `UNKNOWN`, never bridged), and writes `data/clock/clock-map.json` with every extracted transition and its evidence hash. Run this anytime to check progress — it's a pure read over whatever's accumulated so far, safe to run repeatedly.
- [`data/calendar/nyse-2026.json`](data/calendar/nyse-2026.json) — fetched live from nyse.com, all 10 full closures + 2 early-closes for 2026.
- [`scripts/discovery/e4-build-windows.ts`](scripts/discovery/e4-build-windows.ts) (`pnpm discovery:e4:windows`) — pure calendar math, no network, **already run**: built 31 closed-market windows from 2026-06-04 (rToken margin launch) through year-end into `data/windows/window-set.json`.
- [`data/windows/pre-registration.md`](data/windows/pre-registration.md) — the E4 null-control rule (20% LOO-MAE improvement + p<0.05 over 10k permutations), fixed now, before any replay has run, per the pre-registration requirement in §4.5.

**Run next, in your own terminal, in this order** (each is safe to re-run):

```bash
pnpm discovery:e2:rules
pnpm discovery:e3
pnpm discovery:clockmap
```

**Still open in Phase A:**
- E4's actual replay (fetching candles per window to compute `G_w` and test the pre-registered rule) — needs live connectivity and, practically, needs E1 to have actually observed at least one freeze+thaw cycle first. Not built yet.
- E6 (Qwen probe + MCP tool listing) — **needs your `QWEN_API_KEY`**. Flagging now per your instruction: send it (plus `QWEN_BASE_URL` if different from the default `https://hackathon.bitgetops.com/v1`) when ready and I'll build and wire E6.
- E5 (optional private verification) — only if/when you supply a Demo Trading or read-only UTA key. Never a prerequisite for anything else.
- `DISCOVERY.md` and the full Gate A exit checklist — written once the above has real output to point at, not before.

## 2026-10-05 (later) — e2:rules / e3 / clockmap run live, one bug found and fixed

Connectivity from my own tool sandbox came back (confirmed working again, independent of whatever was blocking it earlier), so I ran all three myself:

- **`pnpm discovery:e2:rules`**: succeeded. The bulk no-param `discount-rate` call worked on the first try (520 entries) — no need for the per-coin fallback. 244 position-tier ladders captured. All content-hashed into `data/clock/rules/`.
- **`pnpm discovery:e3`**: **F8 confirmed live** against `RTSLAUSDT` — `type=index`/`mark`/`premium` candle requests silently return `type=market` data, exactly as documented. Evidence in `data/clock/e3-fallback-trap.json`.
- **`pnpm discovery:clockmap`**: found a real bug before trusting the output. `REOPENING` was propagating forever once triggered — the code carried `prevState === "REOPENING"` forward, but any live-market tick differs from the one before it, so once reopening fired it never fell back to `OPEN_LIVE`. Rewrote [`segment-clock.ts`](scripts/discovery/segment-clock.ts) as a two-pass run-based classifier: raw per-sample labels (`OPEN_LIVE` / `FROZEN_CANDIDATE` / `STALE` / `UNKNOWN`) are grouped into runs first, a `FROZEN_CANDIDATE` run only becomes `MARKET_CLOSED_FROZEN` once it reaches `FREEZE_MIN_RUN` (10) samples, and `REOPENING` is assigned to exactly one sample — the first of an `OPEN_LIVE` run that immediately follows a *confirmed* frozen run — never propagated further. Re-ran clean after the fix.

**Current honest state** (~2,172 records, ~9 samples/pair, recording since Sunday evening ET): no `MARKET_CLOSED_FROZEN` segment has hit the 10-sample confirmation threshold yet — expected, that needs ~10 consecutive minutes inside one still-frozen run, and the recorder only just started. But 31/241 pairs already show the qualitative freeze signature (`indexPrice` constant across every sample so far while `markPrice`/spot moved at least once); the other 210 show everything idle together (`STALE`), which is itself a small early data point toward U6 (markPrice may be clamped to the frozen index for most stock perps, not floating independently). N is too small to publish this as a finding yet — noting it here as a reason to keep the recorder running, not as a result.

**Still true:** `pnpm discovery:e1` must keep running (yours, in its own window) for any of this to accumulate toward a confirmed freeze+thaw. Re-run `pnpm discovery:clockmap` anytime to check progress.

## 2026-10-05 (later still) — full documentation infrastructure, UI assets received

Connectivity is now confirmed stable from both sides (yours and my tool
sandbox) — the earlier SNI-block symptoms are not recurring. `pnpm` and live
Bitget calls work normally now from either terminal.

**Latest live numbers** (re-ran `pnpm discovery:clockmap` against the
continuously-growing `data/clock/raw/e1.jsonl`): 4,321 records across 241
pairs, 265 transitions logged, 0 pairs with a confirmed freeze+thaw yet
(expected — still inside a single weekday trading session; see
`DISCOVERY.md`). State distribution: 3,388 `OPEN_LIVE` samples, 933 `STALE`,
longest run so far 18 samples either way — nowhere near the 10-sample
freeze-confirmation threshold being exceeded by a genuinely frozen run yet,
because the market has been open almost the whole time the recorder has run
so far. Next real test is the 2026-10-09 to 2026-10-12 weekend window.

**Built this round — the full project documentation set**, all cross-referencing
real files and real numbers, none fabricated:

- [`DISCOVERY.md`](DISCOVERY.md) — the Gate A discovery register: name-collision
  check (run live — one unrelated GitHub hit, no npm/domain/X collision, name
  kept), and the E1-E6 status write-up.
- [`TASK.md`](TASK.md) — master checklist, every phase A-H, `[x]`/`[ ]`/`[~]`,
  nothing marked done that isn't backed by a real file.
- [`MILESTONE.md`](MILESTONE.md) — M1-M10 with a risk register (the live risk:
  protecting the E1 recording window through 2026-10-09–12).
- [`EVIDENCE_MANIFEST.md`](EVIDENCE_MANIFEST.md) — every evidence artifact,
  what it proves, how to reproduce it (named per FINAL_INSTRUCTION.md §5.1's
  own filename, not the shorter name requested, to stay consistent with what
  later scripts/routes will expect).
- [`CLAIMS.json`](CLAIMS.json) — the structured ledger per §11's exact format
  (`id`/`statement`/`label`/`evidence_path`/`reproduce_command`/`status`), 7
  claims seeded from today's real results (3 PROVEN, 4 UNKNOWN — none
  inflated to PROVEN early).
- [`PROOF.md`](PROOF.md) — narrative proof status per claim, plus the
  from-clean-clone reproduce steps.
- [`METHOD.md`](METHOD.md) — measured vs. modelled vs. unknown.
- [`LIMITATIONS.md`](LIMITATIONS.md) — stated first, six concrete open items,
  led by "the headline measurement isn't confirmed yet."
- [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md) — the F8 trap and the v3
  discount-rate bulk-call finding, written up for anyone else hitting them.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — the §5 diagram and monorepo layout,
  annotated `[BUILT]`/`[PARTIAL]`/`[PLANNED]` per node, instead of presented
  as if it all already exists.
- [`SUBMISSION.md`](SUBMISSION.md) — Phase H skeleton with the fixed X-post
  draft and video structure from §13, marked **DO NOT SUBMIT** until real
  results exist to fill the `[TODO]`s.
- [`README.md`](README.md) — minimal, honest, working-README (not the full
  30-section submission README from §12, which needs real screenshots and
  generated numbers that don't exist yet).

**UI assets received:** you added three images to `public/img/` —
`IMG_1_Hero.jpeg` (1.4MB), `IMG_2.jpeg` (2.7MB), `IMG_3.jpeg` (2.5MB) —
matching the IMG-1/2/3 hero/method/scenario-background slots from
FINAL_INSTRUCTION.md §9.7. Logged in `TASK.md` and `ARCHITECTURE.md` as
received-but-not-yet-wired-in: they belong to Phase D (product routes) and
Phase F (imagery pipeline, `sharp` processing into AVIF/WebP/LQIP), neither
of which has started. Nothing in Phase A touches them.

**Current stage, plainly: Phase A, in progress.** Not closed — still needs a
confirmed freeze+thaw, the break/proof plan, and E6 (blocked on
`QWEN_API_KEY`, which you said is on the way). Phase B has not started and
won't until Gate A closes. See `TASK.md` for the exact open items.

## 2026-10-07 — security fix, git init + push, LLM layer, kernel, full product build, QA, deploy

**Critical fix first:** live Bitget API credentials were sitting in `.env.example`
(not gitignored — would have been committed and pushed publicly). Moved to
`.env.local`, scrubbed the example file, verified clean before ever touching
git. You may want to rotate those credentials since they passed through chat.

**Git:** initialized, pushed to `https://github.com/0xkinno/isopleth`. Per
your explicit instruction, commits are authored as `0xkinno` with **no Claude
co-author line** — confirmed in the commit log before and after.

**LLM provider layer** (`packages/llm`): gemini / qwen / none behind one
interface, selected by `LLM_PROVIDER`. Gemini is the default (no key yet —
correctly falls back to the `none` template driver rather than crashing).
Number-binding guard (I6) proven driver-independent by a real test. bitget-
signal MCP wired with disk caching — found the real (undocumented) session-ID
requirement by reading the actual `@bitget-ai/bitget-signal` npm package
source rather than guessing from a possibly-unreliable third-party listing.

**Margin kernel** (`packages/core`, Phase B): built from FINAL_INSTRUCTION.md
section 6, then caught a real bug while building the demo: `applyScenario`
moved `markUsd` on a shock but never flowed that into `unrealisedPnlUsd`,
so a crashing book looked *safer* (lower notional → lower maintenance
margin) instead of riskier. Fixed in the kernel itself; two UI pages that
had separately hand-rolled the same shock (reintroducing the identical bug)
were fixed to route through `applyScenario` instead. 14/14 tests pass.

**Product** (`apps/web`, Next.js 15): all 6 routes built with real data —
landing, workbench, portfolio, scenarios, proof, method — using your staged
UI images (found them in the wrong folder at first: they were in the
monorepo root's `public/`, not `apps/web/public/` where Next actually serves
from; copied and removed the now-redundant root copy).

**QA** (Playwright, Chromium only per your instruction): 45/45 passing across
5 device profiles × 6 routes, after finding and fixing real bugs: two color-
contrast failures (warn/safe chip text failed WCAG AA against the paper
background), a missing viewport meta tag (mobile Chromium was laying out at
a ~980px desktop-width virtual viewport), a non-responsive 2-column grid on
the Method page, and an unbreakable long code string overflowing on mobile.

**Break campaign:** `pnpm break` — 7/13 attacks verified against the real
kernel (0 failed), 6 honestly marked NOT_YET with the specific missing
infrastructure named, not faked. `pnpm manifest` writes a real run manifest.

**Still open:** the E4 replay harness (needs more elapsed windows), the
bench/offline-verifier scripts, Phase E's actual product-level LLM wiring,
and Vercel deployment (in progress). See `TASK.md` for the full state.

## 2026-10-07 (later) — closed the Phase D/E/F/G gaps section 9-12 of FINAL_INSTRUCTION.md called out

Read `FINAL_INSTRUCTION.md`, `TASK.md`, and `PROGRESS.md` end to end against
what actually exists in the repo, then closed the gaps that were still real
work rather than cosmetic:

- **Book input + personalized thesis + export (Phase D)**: Workbench now has
  a "Your book" panel (`apps/web/components/YourBookPanel.tsx`) — paste or
  upload JSON in the same shape as `@isopleth/core`'s `Book` type, a "What
  are you protecting?" free-text thesis field, and export buttons for a
  risk-plan `.txt` and a recheck-reminder `.ics`. Recompute happens
  server-side at the new `/api/evaluate` route so the kernel's hashing
  (`node:crypto` in `packages/core/src/hash.ts`) never has to be bundled for
  the browser. A new `apps/web/lib/bookValidate.ts` fails closed (I5) on a
  malformed book with specific per-field errors, never a guess.
- **LLM wired into the product (Phase E)**: a new `/api/narrate` route calls
  `getLlmDriver()`, runs the result through `bindNumbers` (the existing I6
  guard), and serves the deterministic template whenever a number doesn't
  bind, the driver is `none`, or the driver throws. Wired to Workbench's
  "Explain with AI" button. Verified live end-to-end against a running
  `next start` server with no `LLM_PROVIDER` set (the `none` path) — request
  and response logged below, both routes respond correctly including the
  thesis text flowing into the narration.
- **Orchestrated load motion (Phase F, §9.6)**: `ContourChart.tsx` now draws
  its contour path once on mount via `strokeDasharray`/`strokeDashoffset`
  (1.4s, the documented `cubic-bezier(0.22, 1, 0.36, 1)` easing), and checks
  `prefers-reduced-motion` with `matchMedia` directly rather than relying on
  there being no animation to disable.
- **Secret-exposure scan automated (Phase G)**: `pnpm secrets:scan`
  (`scripts/secret-scan.ts`) walks every git-tracked file (via `git
  ls-files`) and flags credential-shaped strings — generic `*_KEY=`/`*_SECRET=`
  assignments, AWS access key IDs, PEM private-key blocks, bearer tokens,
  Bitget `bg_`-style keys — skipping lines that look like placeholders.
  Clean run: 339 files, 0 hits. This replaces the by-hand check mentioned in
  the 2026-10-07 entry above with something that runs every time.
- **Two real bugs found and fixed while re-running the Playwright matrix**
  (not cosmetic — both silently broke CI):
  1. `apps/web/playwright.config.ts`'s `webServer.command` was `set PORT=...
     && pnpm start` — Windows-cmd-only syntax. On Linux (and macOS) `set`
     just sets a shell variable no child process inherits, so the server
     never saw the right port and the whole 45-test suite hung on its
     60-second timeout and failed. Reproduced directly this session.
     Replaced with `next start -p <port>`, which works identically on every
     platform.
  2. No `favicon.ico` and no `app/icon.*` existed anywhere in `apps/web`,
     so every route logged a console 404 under `next start` (production
     mode) — which the layout test's "no console errors" assertion
     correctly failed on. Added `apps/web/app/icon.svg` (a small inline
     contour mark in the brand palette); Next's App Router serves it
     automatically.
  Re-ran the full matrix after both fixes: **45/45 passing** again, Chromium
  only, 5 device profiles × 6 routes, confirmed via a real `pnpm exec next
  start` + Playwright run (not just inspection).
- Added `@isopleth/llm` as a workspace dependency of `apps/web` (tsconfig
  path + package.json), `pnpm typecheck` and `pnpm test` (14/14) still clean,
  `pnpm run build:web` still produces a working production build with the
  two new API routes listed as dynamic (`ƒ`) and everything else static.

**Still open, unchanged from the checklist above:** CSV book input (JSON
only so far), the tool-calling loop proper (narration is single-turn), the
E4 replay harness, `pnpm bench` / `pnpm verify:offline`, Lighthouse
CLS/LCP, a Playwright-level recorder-down simulation, screenshots, video,
and the final claims audit before actual submission.

## 2026-10-07 (final pass this session) — closed every remaining build-blocked item, README overhaul, real Vercel blocker

Went through the full checklist above item by item. Everything that was
blocked on missing code is now built; what remains is blocked on either
elapsed calendar time or credentials this session doesn't have — both
stated explicitly below rather than glossed over.

**GitHub Actions recorder had silently never run.** Checked
`github.com/0xkinno/isopleth/actions`: the `collateral-clock` workflow had
been active for ~5 hours on a `*/10 * * * *` cron with **zero** total runs.
Triggered it by hand via `workflow_dispatch` (GitHub API) — it ran clean
and committed new ticks (43,401 → 43,883). Triggered it a second time a
few minutes later to keep data flowing while this session continued. This
explains the apparent recording gap from 2026-10-05 onward far better than
"the user forgot to start it" — the workflow was there and active, GitHub's
scheduler just never fired it on its own. Worth checking the Actions tab
periodically to confirm the 10-minute cron is now running unattended; if
it stalls again, a manual `workflow_dispatch` is the fix, not a code change.

**Built and verified, all today:**
- `pnpm verify:offline` (`scripts/verify-offline.ts`): recomputes the
  kernel against golden fixtures (`scripts/golden/build-golden.ts`,
  `data/verify/golden.json`), re-verifies the full 43,883-record clock hash
  chain via a new standalone verifier (`packages/data/src/chainVerify.ts`),
  checks every file in the last manifest run still hashes the same, and
  exercises the number-binding and F8 guards. **5/5 passing, zero network,
  zero model calls.**
- That same chain verifier closed out break-campaign item **B8** (one byte
  tampered in a stored snapshot → detected) from `NOT_YET` to a real
  `PASS` — confirmed the real log verifies clean, then confirmed a
  one-field tamper on a copy of the last record changes its recomputed
  hash. Break campaign is now **8/13** verified, 0 failed.
- `pnpm bench` (`scripts/bench.ts`): a synthetic 36-account grid
  (leverage × collateral share × position size) compared against two
  controls at equal dollar cost. Isopleth's optimizer restores the
  threshold in 100% of the 12 breached accounts; a uniformly-random action
  at the same cost only works 58.3% of the time: real, measured separation
  from blind allocation. Plain untargeted cash top-up ties the optimizer
  at 100% in this grid — reported honestly rather than hidden, with the
  reason why (`ADD_CASH` is both the cheapest first-tried candidate and
  directly capital-equivalent to equity in this kernel, so the optimizer
  frequently picks the same action the control does).
- `scripts/discovery/e4-replay.ts` + `packages/core/src/e4stat.ts`: the
  pre-registered E4 rule (LOO-MAE vs. null, permutation test vs. a shadow
  spot-move predictor) implemented exactly as written in
  `data/windows/pre-registration.md`, as pure, unit-tested functions
  (3 tests). Replay reads G_w only from the recorder's own tick log, never
  Bitget candles — F8 means a candle-reconstructed "reference price" would
  be fiction. Run today: **0/31 windows replayable**, honestly, because no
  window in `window-set.json` has fully elapsed inside the recorder's
  coverage (started 2026-10-04) yet. This is a calendar fact — the next
  candidate window is the 2026-10-09–12 weekend — not a build gap.
- A real multi-step LLM tool-calling loop (`packages/llm/src/toolLoop.ts`):
  the model gets no numbers upfront and must call
  `get_current_margin`/`get_stressed_margin`/`get_intervention_plan`/
  `get_user_thesis` to fetch what it needs, bounded at 4 steps, tested with
  a scripted fake driver (4 tests, zero network). Wired into `/api/narrate`,
  replacing the single-shot prompt from earlier this session.
- CSV book input (`apps/web/lib/csvBook.ts`): a documented single-flat-tier
  simplification, wired into the Workbench's upload button alongside a
  downloadable template. JSON remains the exact-tier path.
- Lighthouse, run for the first time against a real production build
  (`next start`) across all 6 routes: performance 97-99, accessibility/
  best-practices/SEO 100 on every route, **CLS=0 everywhere**, **LCP
  2.1-2.6s** (threshold <3s). Raw reports in `docs/lighthouse/*.json`,
  condensed in `summary.json`.
- Real Playwright screenshots (Chromium) for the README:
  `docs/screens/{landing-banner,workbench,contour,scenarios,proof}.jpg`.
  Taking them surfaced a genuine CSS bug: `.btn { display: inline-flex }`
  in `globals.css` was declared after `.nav-toggle { display: none }` at
  equal selector specificity, so the mobile hamburger button never
  actually hid above the 860px breakpoint — a screenshot at 1600px showed
  both "Map a book" and "Menu" rendered side by side. The existing
  Playwright collision test missed it because the two elements don't
  overlap, they just shouldn't both be visible. Fixed by raising
  `.nav-toggle`'s specificity (`button.nav-toggle`); re-ran the full
  45/45 Playwright matrix clean after the fix.
- README rewritten end-to-end against FINAL_INSTRUCTION.md §12's structure:
  a Product Links table, the 5 screenshots above (banner + 2×2 grid), and
  every section re-verified against the file it describes rather than
  carried over from the previous draft.

**Genuinely still blocked, not a build gap:**
- **Vercel deployment.** This session has no Vercel login, no
  `VERCEL_TOKEN`, and no Vercel connector attached (checked — `vercel
  whoami` returns "Logged out", `ListConnectors` returns nothing for
  Vercel). Needs either the user to run `vercel --prod` themselves, or to
  supply a `VERCEL_TOKEN` this session can use non-interactively.
- **E4 window-set replay / `pnpm break` B13 / the full bench window-set
  half.** All genuinely blocked on elapsed calendar time (N=0 windows),
  not on missing code — the harnesses are real and will produce real
  numbers once the 2026-10-09–12 weekend passes while the recorder keeps
  running.
- **Qwen.** Still blocked on `QWEN_API_KEY`; Gemini and the `none` fallback
  are both wired and verified to carry the product correctly in its place.
- **Demo video, final claims audit.** Not started — video needs a real
  deployed URL first; claims audit is meant to happen right before actual
  submission, not before.

## 2026-10-08 - deepening the build before submission

- **Position-tier capture really works now.** Re-ran `pnpm discovery:e2:rules` from a networked machine: `category=` succeeded, 243 real ladders (1,778 bands) captured, 520 discount-rate entries re-captured. `pnpm verify:offline` now re-checks every ladder (contiguous, non-decreasing maintenance rate). Claim C3 note, METHOD, LIMITATIONS, DISCOVERY and the `/method` page updated; the "known issue" section was removed from the app.
- **Break campaign 8/13 -> 12/13.** Built harnesses for B4 (versioned rulesets, plan invalidation), B6 (prompt injection against a worst-case obedient model), B10 (schema drift) and B11 (read-only key probe). B10 found a real flaw: a tick had been chain-recorded with null prices after a malformed response; `buildTickRecord` now throws `SchemaDriftError`. B13 remains time-blocked.
- **New: Clock replay** (`/scenarios`, `scripts/build/build-replay.ts`): reference lag measured from the real chain and replayed through the kernel under both collateral valuations. Claim C8.
- **New: read-only MCP server** (`/mcp`, six tools) and **Ask bar** with a visible tool trace on `/workbench`. Claim C10.
- **New: verifiable receipts** on every kernel answer, with a tamper-detecting round trip in the offline verifier and a "verify" link in the UI. Claim C9.
- **CI** (`.github/workflows/ci.yml`) added. Tests 21 -> 27. Offline verifier 5 -> 7 checks.
- **LLM:** set `LLM_PROVIDER=gemini` on Vercel (it was missing); updated the retired default Gemini model; added retry for transient 429/503; fixed the tool loop (it capped at 4 steps for 4 tools and showed the model only the latest tool result). The live key is quota-limited, so the verified template is served when it is exhausted.
- Docs brought up to date: README, ARCHITECTURE (complete rewrite), METHOD, LIMITATIONS, PROOF, MILESTONE, EVIDENCE_MANIFEST, SUBMISSION. The demo video and X post are live.
