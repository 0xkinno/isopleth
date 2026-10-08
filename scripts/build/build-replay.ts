// Builds apps/web/public/data/clock-replay.json from the REAL recorded Collateral
// Clock (data/clock/raw/e1.jsonl). For each pair it measures how long the public
// reference index sat unchanged while market spot kept moving, and replays a fixed
// SYNTHETIC leveraged book through the deterministic kernel twice per tick: once with
// the collateral valued at the reference index, once at market spot. The difference
// is the margin exposure created by reference lag. Prices are REPLAYED (measured);
// the book is SYNTHETIC. Nothing here asserts how Bitget's private engine values
// collateral (that is open claim C5/U3), only what each valuation would imply.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate, type Book } from "@isopleth/core";

const ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const OUT_DIR = path.join(ROOT, "apps/web/public/data");

interface Tick { tsUtc: number; tsEt: string; perp: string; indexPrice: number | null; markPrice: number | null; spotLast: number | null }

const FEATURED = ["TSLAUSDT", "NVDAUSDT", "AAPLUSDT"];
const BTC_QTY = 10.6;
const BTC_MARK = 62_000;
const START_COLLATERAL_USD = 10_000;
const CASH = 2_000;

function bookFor(qty: number, referenceUsd: number): Book {
  return {
    collateral: [{ coin: "rTOKEN", qty, referenceUsd, referenceState: "OPEN_LIVE", tiers: [{ startUsd: 0, rate: 0.9 }], rulesetVersion: "replay-1", evidence: "REPLAYED", sourceRefs: [] }],
    positions: [{ symbol: "BTCUSDT", side: "LONG", qty: BTC_QTY, markUsd: BTC_MARK, kind: "crypto", tiers: [{ symbol: "BTCUSDT", minNotional: 0, maxNotional: 5_000_000, maintenanceMarginRate: 0.01, takerFee: 0.0006, sourceRef: "replay" }] }],
    cashUsd: CASH,
    liabilitiesUsd: 0,
    unrealisedPnlUsd: 0,
    partialLiqFeeUsd: 0,
  };
}

function rate(qty: number, price: number): number | null {
  const r = evaluate(bookFor(qty, price));
  return r.ok ? r.value.crossMarginRate : null;
}

function pct(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

const byPair = new Map<string, Tick[]>();
let total = 0;
for (const line of readFileSync(path.join(ROOT, "data/clock/raw/e1.jsonl"), "utf8").split("\n")) {
  if (!line.trim()) continue;
  const t = JSON.parse(line) as Tick;
  total += 1;
  if (t.indexPrice === null || t.spotLast === null || !(t.indexPrice > 0) || !(t.spotLast > 0)) continue;
  const arr = byPair.get(t.perp) ?? [];
  arr.push(t);
  byPair.set(t.perp, arr);
}

interface PairStat { perp: string; n: number; frozenFrac: number; longestFrozenMin: number; maxGapPct: number; p95GapPct: number; maxMarginShift: number }
const stats: PairStat[] = [];
const series: Record<string, unknown> = {};

for (const [perp, ticks] of byPair) {
  if (ticks.length < 120) continue;
  ticks.sort((a, b) => a.tsUtc - b.tsUtc);
  const qty = START_COLLATERAL_USD / ticks[0]!.indexPrice!;
  let frozen = 0;
  let runStartTs = 0;
  let longestMs = 0;
  const gaps: number[] = [];
  let maxShift = 0;
  const pts = ticks.map((t, i) => {
    const same = i > 0 && t.indexPrice === ticks[i - 1]!.indexPrice;
    if (same) {
      frozen += 1;
      if (runStartTs === 0) runStartTs = ticks[i - 1]!.tsUtc;
      longestMs = Math.max(longestMs, t.tsUtc - runStartTs);
    } else runStartTs = 0;
    const gap = (t.spotLast! / t.indexPrice! - 1) * 100;
    gaps.push(Math.abs(gap));
    const rRef = rate(qty, t.indexPrice!);
    const rMkt = rate(qty, t.spotLast!);
    const shift = rRef !== null && rMkt !== null ? (rMkt - rRef) * 100 : 0;
    if (Math.abs(shift) > Math.abs(maxShift)) maxShift = shift;
    return { t: t.tsUtc, et: t.tsEt, idx: +t.indexPrice!.toFixed(4), spot: +t.spotLast!.toFixed(4), gap: +gap.toFixed(3), rRef: rRef === null ? null : +(rRef * 100).toFixed(3), rMkt: rMkt === null ? null : +(rMkt * 100).toFixed(3), frozen: same };
  });
  const sorted = [...gaps].sort((a, b) => a - b);
  const stat: PairStat = {
    perp,
    n: ticks.length,
    frozenFrac: +(frozen / (ticks.length - 1)).toFixed(4),
    longestFrozenMin: Math.round(longestMs / 60000),
    maxGapPct: +sorted[sorted.length - 1]!.toFixed(3),
    p95GapPct: +pct(sorted, 0.95).toFixed(3),
    maxMarginShift: +maxShift.toFixed(3),
  };
  stats.push(stat);
  series[perp] = { collateralQty: +qty.toFixed(6), points: pts };
}

// A spot/index disagreement above 50% is a unit or share-ratio mapping anomaly, not reference lag.
const anomalies = stats.filter((s) => s.p95GapPct > 50).map((s) => ({ perp: s.perp, p95GapPct: s.p95GapPct }));
const lagStats = stats.filter((s) => s.p95GapPct <= 50);
lagStats.sort((a, b) => b.maxGapPct - a.maxGapPct);
const keep = new Set<string>([...lagStats.slice(0, 9).map((s) => s.perp), ...FEATURED.filter((f) => series[f])]);
const outSeries: Record<string, unknown> = {};
for (const k of keep) outSeries[k] = series[k];

const allFrozen = stats.reduce((a, s) => a + s.frozenFrac * (s.n - 1), 0);
const allTicks = stats.reduce((a, s) => a + (s.n - 1), 0);
const out = {
  generatedFrom: "data/clock/raw/e1.jsonl",
  evidence: "REPLAYED prices, SYNTHETIC book",
  book: { collateralUsdAtStart: START_COLLATERAL_USD, collateralRate: 0.9, cashUsd: CASH, btcLongQty: BTC_QTY, btcMarkUsd: BTC_MARK, note: "fixed; only the collateral valuation differs between the two series" },
  totals: { recordsInChain: total, pairsAnalysed: lagStats.length, ticksAnalysed: allTicks, frozenShare: +(allFrozen / allTicks).toFixed(4) },
  top: lagStats.slice(0, 12),
  anomalies,
  gapShare: (() => { const all: number[] = []; for (const [, ticks] of byPair) for (const t of ticks) { const g = Math.abs((t.spotLast! / t.indexPrice! - 1) * 100); if (g <= 50) all.push(g); } all.sort((a, b) => a - b); return { medianPct: +pct(all, 0.5).toFixed(3), p95Pct: +pct(all, 0.95).toFixed(3), over1pct: +(all.filter((g) => g > 1).length / all.length).toFixed(4) }; })(),
  featured: [...keep],
  series: outSeries,
};
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(path.join(OUT_DIR, "clock-replay.json"), JSON.stringify(out));
console.log(`[build-replay] ${stats.length} pairs, ${allTicks} ticks, frozen share ${(out.totals.frozenShare * 100).toFixed(1)}%, wrote clock-replay.json (${keep.size} series)`);
