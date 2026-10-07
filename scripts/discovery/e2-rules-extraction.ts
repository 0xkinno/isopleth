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

  // Real bug, found 2026-10-07: a network failure on this single bulk call
  // (observed live: Bitget timing out / aborting the connection on this
  // specific endpoint from the user's own machine) used to crash the whole
  // script before position-tier - the part actually being debugged - ever
  // ran. A transport failure here must degrade to the per-coin fallback
  // below, never abort the run.
  let bulk: Awaited<ReturnType<typeof bitgetPublicGet>> | null = null;
  try {
    bulk = await bitgetPublicGet<unknown>("/api/v3/market/discount-rate", {}, { timeoutMs: 15_000 });
  } catch (e) {
    console.error(`[e2-rules] discount-rate: bulk call failed transport-level (${e instanceof Error ? e.message : e}), falling back to per-coin calls`);
  }
  const bulkList = bulk ? (Array.isArray(bulk.data) ? bulk.data : (bulk.data as { discountRateList?: unknown[] })?.discountRateList) : undefined;
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

/**
 * Real bug, found 2026-10-07: this originally sent `productType=USDT-FUTURES`
 * (matching the parameter name used by Bitget's older v2 mix endpoints), but
 * every other v3 endpoint this codebase calls (instruments, tickers,
 * discount-rate) uses `category=`, not `productType=`. The old version got
 * back `{"code":"400172","msg":"Parameter verification failed"}` for every
 * single symbol and - because nothing checked `env.code` - wrote that error
 * envelope to disk as if it were a successful capture. All 244 previously
 * "captured" position-tier files were error responses, not tier data. Fixed
 * here by trying `category=` first and falling back to `productType=` only
 * if that also fails, with an explicit success check (`code === "00000"`,
 * Bitget's documented success code) before ever writing a file - a failed
 * capture must never again be silently indistinguishable from a real one.
 */
async function fetchPositionTiers(symbols: string[]): Promise<Array<{ symbol: string; file: string; hash: string; ok: boolean }>> {
  const out: Array<{ symbol: string; file: string; hash: string; ok: boolean }> = [];
  let loggedWorkingParam = false;

  for (const symbol of symbols) {
    try {
      let env = await bitgetPublicGet<unknown>("/api/v3/market/position-tier", { category: "USDT-FUTURES", symbol });
      let paramUsed = "category=";
      if ((env as { code?: string }).code !== "00000") {
        const fallback = await bitgetPublicGet<unknown>("/api/v3/market/position-tier", { productType: "USDT-FUTURES", symbol });
        if ((fallback as { code?: string }).code === "00000") {
          env = fallback;
          paramUsed = "productType=";
        }
      }
      const ok = (env as { code?: string }).code === "00000";
      if (!loggedWorkingParam) {
        console.log(`[e2-rules] position-tier: ${ok ? `"${paramUsed}" succeeded` : "neither category= nor productType= succeeded"} (symbol=${symbol})`);
        loggedWorkingParam = true;
      }
      if (!ok) {
        console.error(`[e2-rules] position-tier for ${symbol} FAILED: ${JSON.stringify(env).slice(0, 200)} - not writing a file for a failed capture`);
        continue;
      }
      const { file, hash } = await writeVersioned("position-tier", symbol, env);
      out.push({ symbol, file, hash, ok: true });
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
  let discountResults: Array<{ coin: string; strategy: string; file: string; hash: string }> = [];
  try {
    discountResults = await fetchDiscountRates(rTokenCoins);
  } catch (e) {
    console.error(`[e2-rules] discount-rate capture failed entirely (${e instanceof Error ? e.message : e}) - continuing to position-tier anyway`);
  }

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
