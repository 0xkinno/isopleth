// pnpm bench (FINAL_INSTRUCTION.md section 11). Two parts, run and reported
// separately because they depend on different evidence:
//
// 1. SYNTHETIC account-grid benchmark (leverage x collateral share x
//    position size), entirely pure/offline/deterministic - no network, no
//    model, runs today. Baseline = the number alone. Intervention =
//    Isopleth's minimum-cost plan. Controls = the same dollar cost spent as
//    a blind ADD_CASH ("proportional top-up": sensible but untargeted) or
//    as a uniformly random choice among the optimizer's own candidate
//    action kinds ("random top-up"). This operationalizes section 11's
//    "random top-up and proportional top-up at equal capital" concretely
//    against this kernel's action space - documented here, not hidden.
// 2. REPLAYED window-set benchmark (threshold crossings detected before the
//    adverse state) - depends on data/windows/replay-results.json having
//    at least 2 windows (pnpm discovery:e4:replay). Reported honestly as
//    "not yet" when it doesn't, never backfilled with synthetic numbers
//    standing in for it.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { evaluate, applyScenario, minimumIntervention, evaluatePreRegisteredRule, type Book, type Scenario } from "@isopleth/core";

const THRESHOLD = 0.8;
const STRESS: Omit<Scenario, "id" | "asOf"> = { referenceShockPct: { rAAPL: -12 }, collateralRatioOverride: {}, markShockPct: { BTCUSDT: -15 } };

function syntheticBook(leverage: number, collateralShareRtoken: number, positionNotionalUsd: number): Book {
  const equityTarget = positionNotionalUsd / leverage;
  const rTokenCollateralUsd = equityTarget * collateralShareRtoken;
  const cashUsd = equityTarget - rTokenCollateralUsd;
  const rAaplQty = rTokenCollateralUsd / 230;
  const btcQty = positionNotionalUsd / 62_000;
  return {
    collateral:
      rTokenCollateralUsd > 0
        ? [{ coin: "rAAPL", qty: rAaplQty, referenceUsd: 230, referenceState: "OPEN_LIVE", tiers: [{ startUsd: 0, rate: 0.9 }], rulesetVersion: "bench-1", evidence: "SYNTHETIC", sourceRefs: [] }]
        : [],
    positions: [{ symbol: "BTCUSDT", side: "LONG", qty: btcQty, markUsd: 62_000, kind: "crypto", tiers: [{ symbol: "BTCUSDT", minNotional: 0, maxNotional: 10_000_000, maintenanceMarginRate: 0.01, takerFee: 0.0006, sourceRef: "bench" }] }],
    cashUsd: Math.max(cashUsd, 0),
    liabilitiesUsd: 0,
    unrealisedPnlUsd: 0,
    partialLiqFeeUsd: 0,
  };
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random control: same dollar cost as Isopleth's plan, spent on a uniformly-random action kind rather than the cost-minimizing one. */
function randomControl(shocked: Book, costUsd: number, rand: () => number): boolean {
  const choices: Array<() => Book> = [
    () => ({ ...shocked, cashUsd: shocked.cashUsd + costUsd }),
    () => ({ ...shocked, positions: shocked.positions.map((p) => ({ ...p, qty: Math.max(0, p.qty - costUsd / p.markUsd) })) }),
  ];
  const pick = choices[Math.floor(rand() * choices.length)]!;
  const r = evaluate(pick());
  return r.ok && r.value.crossMarginRate <= THRESHOLD;
}

/** Proportional control: the same dollar cost, always as plain ADD_CASH - "sensible but untargeted," never the kernel's own optimized choice of where to intervene. */
function proportionalControl(shocked: Book, costUsd: number): boolean {
  const r = evaluate({ ...shocked, cashUsd: shocked.cashUsd + costUsd });
  return r.ok && r.value.crossMarginRate <= THRESHOLD;
}

async function runSyntheticGrid() {
  const leverages = [2, 5, 10];
  const collateralShares = [0, 0.3, 0.6, 0.9];
  const positionNotionals = [10_000, 50_000, 200_000];
  const rand = mulberry32(2026);

  let total = 0;
  let breached = 0;
  let isopleth = { success: 0, totalCost: 0 };
  let random = { success: 0 };
  let proportional = { success: 0 };
  let falseAlarms = 0; // flagged fragile by the contour's threshold but the stress scenario didn't actually breach it

  for (const leverage of leverages) {
    for (const collateralShare of collateralShares) {
      for (const notional of positionNotionals) {
        total += 1;
        const book = syntheticBook(leverage, collateralShare, notional);
        const base = evaluate(book);
        if (!base.ok) continue; // malformed grid point, shouldn't happen - not counted either way

        const scenario: Scenario = { id: `bench-${leverage}-${collateralShare}-${notional}`, asOf: "bench", ...STRESS };
        const shocked = applyScenario(book, scenario);
        const shockedResult = evaluate(shocked);
        const isBreached = !shockedResult.ok || shockedResult.value.crossMarginRate > THRESHOLD;

        // false alarm: the UNSHOCKED book already reads above-threshold-fragile territory per the contour's own definition, but the applied stress doesn't push it over - i.e. the surface would have warned about a scenario that didn't materialize into an actual breach here. Approximated as: base reads >50% of threshold but the actual stress result stays under threshold.
        if (base.value.crossMarginRate > THRESHOLD * 0.5 && !isBreached) falseAlarms += 1;

        if (!isBreached) continue;
        breached += 1;

        const plan = minimumIntervention(shocked, THRESHOLD);
        if (plan.ok) {
          isopleth.success += 1;
          const cost = plan.value[0]!.interventionCostUsd;
          isopleth.totalCost += cost;
          if (randomControl(shocked, cost, rand)) random.success += 1;
          if (proportionalControl(shocked, cost)) proportional.success += 1;
        }
      }
    }
  }

  return {
    gridPoints: total,
    breachedUnderStress: breached,
    isopleth: { planFound: isopleth.success, planFoundPct: pct(isopleth.success, breached), avgCostUsd: isopleth.success > 0 ? Math.round(isopleth.totalCost / isopleth.success) : null },
    randomTopUpControl: { restoredThresholdAtEqualCost: random.success, restoredPct: pct(random.success, isopleth.success) },
    proportionalTopUpControl: { restoredThresholdAtEqualCost: proportional.success, restoredPct: pct(proportional.success, isopleth.success) },
    falseAlarmRateApprox: pct(falseAlarms, total),
  };
}

function pct(n: number, d: number): number | null {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : null;
}

async function runWindowSetBenchmark() {
  let replay: { replays: Array<{ windowId: string; gW: number; shadowSpotMove: number }> };
  try {
    replay = JSON.parse(await readFile("data/windows/replay-results.json", "utf8"));
  } catch {
    return { status: "NOT_RUN", note: "run `pnpm discovery:e4:replay` first" };
  }
  const byWindow = new Map<string, { gW: number; shadow: number }>();
  for (const r of replay.replays) if (!byWindow.has(r.windowId)) byWindow.set(r.windowId, { gW: r.gW, shadow: r.shadowSpotMove });
  const obs = [...byWindow.values()];

  if (obs.length < 2) {
    return {
      status: "INSUFFICIENT_N",
      n: obs.length,
      note: "the pre-registered rule (data/windows/pre-registration.md) requires leave-one-window-out cross-validation, which is undefined below N=2. Honest state: not enough closed-market windows have elapsed since the E1 recorder started (2026-10-04) to test this yet.",
    };
  }

  const rule = evaluatePreRegisteredRule(obs);
  return { status: "RUN", ...rule };
}

async function main() {
  const synthetic = await runSyntheticGrid();
  const windowSet = await runWindowSetBenchmark();

  const report = {
    generatedAt: new Date().toISOString(),
    accountLabel: "SYNTHETIC",
    marketDataLabel: "REPLAYED (window-set) / none (synthetic grid)",
    syntheticGrid: synthetic,
    windowSetReplay: windowSet,
    whatWouldMakeThisFalse: [
      "Random or proportional top-up at equal cost restoring the threshold as often as Isopleth's optimized plan (synthetic grid) - would mean the optimizer adds no value over blind capital allocation.",
      "The window-set replay's LOO-MAE improvement falling under 20%, or its permutation p-value landing at or above 0.05, once N>=2 windows exist.",
      "A false-alarm rate that is not small relative to the breach rate, which would mean the contour's fragility threshold is too sensitive to be useful.",
    ],
  };

  await mkdir("data/bench", { recursive: true });
  await writeFile("data/bench/results.json", JSON.stringify(report, null, 2));

  console.log(`[bench] synthetic grid: ${synthetic.gridPoints} accounts, ${synthetic.breachedUnderStress} breached under stress`);
  console.log(`[bench]   Isopleth plan found: ${synthetic.isopleth.planFoundPct}% of breaches, avg cost $${synthetic.isopleth.avgCostUsd}`);
  console.log(`[bench]   random top-up (equal cost) also restores threshold: ${synthetic.randomTopUpControl.restoredPct}% of the time Isopleth succeeded`);
  console.log(`[bench]   proportional top-up (equal cost) also restores threshold: ${synthetic.proportionalTopUpControl.restoredPct}% of the time Isopleth succeeded`);
  console.log(`[bench]   approx false-alarm rate: ${synthetic.falseAlarmRateApprox}%`);
  console.log(`[bench] window-set replay: ${windowSet.status}`);
  console.log(`[bench] -> data/bench/results.json`);
}

main().catch((e) => {
  console.error("[bench] fatal:", e);
  process.exitCode = 1;
});
