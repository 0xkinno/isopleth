// E3: confirm the documented silent-fallback trap (F8) live, with evidence,
// before trusting the guard in packages/data/src/guards.ts to matter.
//
// F8 claim: rToken candles only support type=market. Requesting type=index,
// mark or premium does NOT error - it silently returns identical data to
// type=market. This is a real trap: code that naively requests type=index
// expecting a reference-price series will get market data back with no
// signal anything went wrong.
//
// PUBLIC ONLY. No API key. No account. No cost.
import { mkdir, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { bitgetPublicGet } from "../../packages/data/src/client";
import { canonicalJson } from "../../packages/data/src/tick";
import type { Pair } from "./e2-instrument-scan";

const OUT = "data/clock/e3-fallback-trap.json";

async function candles(symbol: string, type: string) {
  return bitgetPublicGet<unknown[]>("/api/v3/market/candles", {
    category: "SPOT",
    symbol,
    interval: "1H",
    type,
    limit: 20,
  });
}

async function main() {
  const pairsRaw = await readFile("data/clock/pairs.json", "utf8").catch(() => "[]");
  const pairs = JSON.parse(pairsRaw) as Pair[];
  const sample = pairs[0];
  if (!sample) {
    console.error('[e3] data/clock/pairs.json is empty. Run "pnpm discovery:e2" first.');
    process.exitCode = 1;
    return;
  }

  console.log(`[e3] probing ${sample.spot} candles with type=market, index, mark, premium ...`);
  const [market, index, mark, premium] = await Promise.all([
    candles(sample.spot, "market"),
    candles(sample.spot, "index"),
    candles(sample.spot, "mark"),
    candles(sample.spot, "premium"),
  ]);

  const marketJson = canonicalJson(market.data);
  const results = {
    index: { identicalToMarket: canonicalJson(index.data) === marketJson, sample: index.data?.slice?.(0, 1) },
    mark: { identicalToMarket: canonicalJson(mark.data) === marketJson, sample: mark.data?.slice?.(0, 1) },
    premium: { identicalToMarket: canonicalJson(premium.data) === marketJson, sample: premium.data?.slice?.(0, 1) },
  };

  const allIdentical = results.index.identicalToMarket && results.mark.identicalToMarket && results.premium.identicalToMarket;

  const record = {
    probedAt: new Date().toISOString(),
    symbol: sample.spot,
    claim: "F8: rToken candle type is silently coerced to market for index/mark/premium requests",
    confirmed: allIdentical,
    marketSample: market.data?.slice?.(0, 1),
    results,
  };

  await mkdir("data/clock", { recursive: true });
  await writeFile(OUT, JSON.stringify(record, null, 2));

  console.log(`[e3] F8 ${allIdentical ? "CONFIRMED" : "NOT CONFIRMED - investigate before trusting the guard"}`);
  console.log(`[e3] evidence -> ${OUT}`);

  if (!allIdentical) {
    console.error(
      "[e3] WARNING: at least one of type=index/mark/premium returned data DIFFERENT from type=market. " +
        "That would mean Bitget is NOT silently falling back for this symbol, which contradicts F8 as documented. " +
        "Do not assume the guard in packages/data/src/guards.ts is unnecessary either way - inspect " +
        OUT +
        " by hand.",
    );
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("[e3] fatal:", e);
  process.exitCode = 1;
});
