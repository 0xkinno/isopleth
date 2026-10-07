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
