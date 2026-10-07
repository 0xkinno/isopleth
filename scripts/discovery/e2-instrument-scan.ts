// E2 (instrument-scan slice): discover stock perps and their matching rToken
// spot symbol from LIVE public Bitget data. Nothing here is hardcoded: the
// symbol universe is whatever the instruments endpoint returns today.
//
// Produces data/clock/pairs.json, the single input E1's recorder depends on.
// Also writes a timestamped raw dump of both instrument lists to
// data/clock/instruments-raw/ for provenance (I1).
//
// PUBLIC ONLY. No API key. No account. No cost.
import { mkdir, writeFile } from "node:fs/promises";
import { bitgetPublicGet } from "../../packages/data/src/client";

interface FuturesInstrument {
  symbol: string;
  baseCoin?: string;
  quoteCoin?: string;
  symbolType?: string; // "crypto" | "metal" | "stock" | "commodity" (futures only)
  [k: string]: unknown;
}

interface SpotInstrument {
  symbol: string;
  baseCoin?: string;
  quoteCoin?: string;
  [k: string]: unknown;
}

export interface Pair {
  perp: string; // e.g. AAPLUSDT (USDT-FUTURES)
  spot: string; // e.g. rAAPLUSDT (SPOT)
  underlying: string; // bare ticker, e.g. AAPL
}

const RAW_DIR = "data/clock/instruments-raw";
const PAIRS_OUT = "data/clock/pairs.json";

async function fetchAllInstruments(category: "USDT-FUTURES" | "SPOT"): Promise<unknown[]> {
  const env = await bitgetPublicGet<unknown[]>("/api/v3/market/instruments", { category });
  if (!Array.isArray(env.data)) {
    throw new Error(
      `instruments response for category=${category} did not contain an array under "data": ${JSON.stringify(env).slice(0, 300)}`,
    );
  }
  return env.data;
}

function isStockFutures(x: unknown): x is FuturesInstrument {
  return (
    typeof x === "object" &&
    x !== null &&
    "symbol" in x &&
    typeof (x as Record<string, unknown>).symbol === "string" &&
    (x as Record<string, unknown>).symbolType === "stock"
  );
}

function isSpotInstrument(x: unknown): x is SpotInstrument {
  return typeof x === "object" && x !== null && "symbol" in x && typeof (x as Record<string, unknown>).symbol === "string";
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });
  const ts = new Date().toISOString();

  const [futuresRaw, spotRaw] = await Promise.all([
    fetchAllInstruments("USDT-FUTURES"),
    fetchAllInstruments("SPOT"),
  ]);

  await writeFile(`${RAW_DIR}/USDT-FUTURES.${ts.replace(/[:.]/g, "-")}.json`, JSON.stringify(futuresRaw, null, 2));
  await writeFile(`${RAW_DIR}/SPOT.${ts.replace(/[:.]/g, "-")}.json`, JSON.stringify(spotRaw, null, 2));

  const stockFutures = futuresRaw.filter(isStockFutures);

  if (stockFutures.length === 0) {
    console.error(
      "[e2] WARNING: no futures instrument had symbolType === \"stock\". " +
        "Either the field name/value differs from what F6/the docs describe, or no stock perps are currently listed. " +
        "Writing an empty pairs.json and refusing to guess. Inspect the raw dump in " +
        RAW_DIR +
        " before trusting E1's output.",
    );
  }

  const spotInstruments = spotRaw.filter(isSpotInstrument);
  // Build a lookup of spot baseCoin (uppercased) -> spot symbol, so we can
  // match "AAPL" (futures baseCoin) to an "rAAPL"-based spot symbol without
  // assuming any particular quote asset or naming scheme beyond the
  // documented "r" + ticker convention (F10).
  const spotByBareBase = new Map<string, SpotInstrument>();
  for (const s of spotInstruments) {
    const base = (s.baseCoin ?? "").toUpperCase();
    if (base.startsWith("R") && base.length > 1) {
      spotByBareBase.set(base.slice(1), s);
    }
  }

  const pairs: Pair[] = [];
  const unmatched: string[] = [];
  for (const f of stockFutures) {
    const underlying = (f.baseCoin ?? f.symbol.replace(/USDT$/, "")).toUpperCase();
    const spot = spotByBareBase.get(underlying);
    if (!spot) {
      unmatched.push(f.symbol);
      continue;
    }
    pairs.push({ perp: f.symbol, spot: spot.symbol, underlying });
  }

  if (unmatched.length > 0) {
    console.error(
      `[e2] WARNING: ${unmatched.length} stock perp(s) had no matching rToken spot symbol by the "r" + baseCoin convention: ${unmatched.join(", ")}. ` +
        "Recorded raw instrument dumps for manual inspection; these symbols are excluded from pairs.json rather than guessed.",
    );
  }

  await writeFile(PAIRS_OUT, JSON.stringify(pairs, null, 2));

  console.log(`[e2] stock futures discovered: ${stockFutures.length}`);
  console.log(`[e2] pairs matched: ${pairs.length} -> ${PAIRS_OUT}`);
  console.log(`[e2] pairs: ${pairs.map((p) => `${p.perp}<->${p.spot}`).join(", ") || "(none)"}`);

  if (pairs.length === 0) {
    console.error("[e2] FATAL: zero pairs matched. E1 has nothing to tick on. Inspect raw dumps and fix the matching rule before running E1.");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("[e2] instrument scan failed:", e);
  process.exitCode = 1;
});
