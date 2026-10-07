// E2 (rules-extraction slice): capture the collateral discount-rate tier
// ladder for every rToken, and the position-tier (maintenance margin) ladder
// for every stock perp plus a fixed core crypto-perp set used elsewhere in
// the engine. Every captured ruleset is content-hashed and timestamped so a
// mid-window change is detected and both versions stay replayable (B4).
//
// PUBLIC ONLY. No API key. No account. No cost.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { bitgetPublicGet } from "../../packages/data/src/client";
import { canonicalJson } from "../../packages/data/src/tick";
import type { Pair } from "./e2-instrument-scan";

const RULES_DIR = "data/clock/rules";
const CRYPTO_PERPS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]; // modeled crypto legs, see FINAL_INSTRUCTION.md 5.1

function hashOf(body: unknown): string {
  return createHash("sha256").update(canonicalJson(body)).digest("hex");
}

async function writeVersioned(category: string, key: string, body: unknown) {
  await mkdir(`${RULES_DIR}/${category}`, { recursive: true });
  const hash = hashOf(body);
  const ts = new Date().toISOString();
  const record = { capturedAt: ts, key, hash, body };
  const file = `${RULES_DIR}/${category}/${key}.${hash.slice(0, 16)}.json`;
  await writeFile(file, JSON.stringify(record, null, 2));
  return { file, hash };
}

/**
 * Bitget's discount-rate endpoint is documented (v2) as requiring no params
 * and returning every coin's ladder; nothing confirms the v3 shape matches.
 * Try the no-param call first; if it comes back empty/erroring, fall back to
 * per-coin calls using the rToken coin names from pairs.json. Never assume
 * one shape silently - log which strategy actually worked.
 */
async function fetchDiscountRates(coins: string[]): Promise<Array<{ coin: string; strategy: string; file: string; hash: string }>> {
  const out: Array<{ coin: string; strategy: string; file: string; hash: string }> = [];

  const bulk = await bitgetPublicGet<unknown>("/api/v3/market/discount-rate", {});
  const bulkList = Array.isArray(bulk.data) ? bulk.data : (bulk.data as { discountRateList?: unknown[] })?.discountRateList;
  if (Array.isArray(bulkList) && bulkList.length > 0) {
    const { file, hash } = await writeVersioned("discount-rate", "ALL_COINS", bulk);
    console.log(`[e2-rules] discount-rate: bulk call returned ${bulkList.length} entries -> ${file}`);
    out.push({ coin: "ALL_COINS", strategy: "bulk-no-param", file, hash });
    return out;
  }

  console.log("[e2-rules] discount-rate: bulk call returned nothing usable, falling back to per-coin calls");
  for (const coin of coins) {
    try {
      const env = await bitgetPublicGet<unknown>("/api/v3/market/discount-rate", { coin });
      const { file, hash } = await writeVersioned("discount-rate", coin, env);
      out.push({ coin, strategy: "per-coin:coin=", file, hash });
    } catch (e) {
      console.error(`[e2-rules] discount-rate for coin=${coin} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  return out;
}

async function fetchPositionTiers(symbols: string[]): Promise<Array<{ symbol: string; file: string; hash: string }>> {
  const out: Array<{ symbol: string; file: string; hash: string }> = [];
  for (const symbol of symbols) {
    try {
      const env = await bitgetPublicGet<unknown>("/api/v3/market/position-tier", {
        productType: "USDT-FUTURES",
        symbol,
      });
      const { file, hash } = await writeVersioned("position-tier", symbol, env);
      out.push({ symbol, file, hash });
    } catch (e) {
      console.error(`[e2-rules] position-tier for ${symbol} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  return out;
}

async function main() {
  const pairsRaw = await readFile("data/clock/pairs.json", "utf8").catch(() => "[]");
  const pairs = JSON.parse(pairsRaw) as Pair[];
  if (pairs.length === 0) {
    console.error('[e2-rules] data/clock/pairs.json is empty. Run "pnpm discovery:e2" (instrument scan) first.');
    process.exitCode = 1;
    return;
  }

  const rTokenCoins = pairs.map((p) => `r${p.underlying}`);
  const stockPerpSymbols = pairs.map((p) => p.perp);

  console.log(`[e2-rules] capturing discount-rate for ${rTokenCoins.length} rToken coin(s)...`);
  const discountResults = await fetchDiscountRates(rTokenCoins);

  console.log(`[e2-rules] capturing position-tier for ${stockPerpSymbols.length} stock perp(s) + ${CRYPTO_PERPS.length} crypto perp(s)...`);
  const tierResults = await fetchPositionTiers([...stockPerpSymbols, ...CRYPTO_PERPS]);

  const manifest = {
    capturedAt: new Date().toISOString(),
    discountRate: discountResults,
    positionTier: tierResults,
  };
  await mkdir(RULES_DIR, { recursive: true });
  await writeFile(`${RULES_DIR}/manifest.json`, JSON.stringify(manifest, null, 2));

  console.log(`[e2-rules] done. discount-rate entries: ${discountResults.length}, position-tier entries: ${tierResults.length}`);
  console.log(`[e2-rules] manifest -> ${RULES_DIR}/manifest.json`);
  console.log(
    "[e2-rules] NOTE on U5/U8 (tier boundary semantics - marginal vs aggregated, inclusive vs exclusive): " +
      "this script only captures the published ladder. Confirming the exact boundary convention requires either " +
      "the exact wording of Bitget's support article (F3/F4, not independently re-fetchable from this environment - " +
      "see DISCOVERY.md) or a live authenticated probe at the boundary value (E5, optional, needs credentials). " +
      "Until one of those lands, treat boundary inclusivity as UNKNOWN and keep the kernel's documented convention " +
      "(see FINAL_INSTRUCTION.md 6.2: tiers cover (lo, hi]) labelled as an assumption, not a verified fact.",
  );
}

main().catch((e) => {
  console.error("[e2-rules] fatal:", e);
  process.exitCode = 1;
});
