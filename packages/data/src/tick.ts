// Shared E1 "Collateral Clock" tick logic. Used by both the long-running
// local recorder (e1-collateral-clock.ts) and the single-shot GitHub Actions
// tick (recorder-tick.ts) so the two never drift into inconsistent record
// shapes or hashing rules.
//
// PUBLIC ONLY. No API key. No account. No cost.
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { bitgetPublicGet } from "./client";
import type { Pair } from "../../../scripts/discovery/e2-instrument-scan";

export const OUT_FILE = "data/clock/raw/e1.jsonl";
export const ERROR_FILE = "data/clock/raw/e1-errors.jsonl";
export const PAIRS_FILE = "data/clock/pairs.json";

const etFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function canonicalJson(o: unknown): string {
  return JSON.stringify(o, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

export async function lastHash(): Promise<string> {
  try {
    const raw = await readFile(OUT_FILE, "utf8");
    const lines = raw.trimEnd().split("\n").filter(Boolean);
    if (lines.length === 0) return "GENESIS";
    return (JSON.parse(lines[lines.length - 1]!) as { hash: string }).hash;
  } catch {
    return "GENESIS";
  }
}

export async function loadPairs(): Promise<Pair[]> {
  const raw = await readFile(PAIRS_FILE, "utf8");
  const pairs = JSON.parse(raw) as Pair[];
  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new Error(
      `${PAIRS_FILE} is empty or missing. Run "pnpm discovery:e2" (the instrument scan) first - the recorder has nothing to tick on without it.`,
    );
  }
  return pairs;
}

// Bitget's v3 futures ticker and spot ticker field names, captured defensively:
// we accept either the current v3 names or older last/bid/ask naming so a
// silent rename never drops a field without the raw body also being kept.
function num(obj: Record<string, unknown> | undefined, ...keys: string[]): number {
  if (!obj) return Number.NaN;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return Number.NaN;
}

export interface TickRecord {
  tsUtc: number;
  tsEt: string;
  perp: string;
  spot: string;
  indexPrice: number;
  markPrice: number;
  spotLast: number;
  spotBid: number;
  spotAsk: number;
  raw: { perp: unknown; spot: unknown };
  prevHash: string;
  hash: string;
}

async function fetchPairRecord(pair: Pair, tUtc: number, tsEt: string): Promise<TickRecord> {
  const [perpEnv, spotEnv] = await Promise.all([
    bitgetPublicGet<Record<string, unknown>[]>("/api/v3/market/tickers", {
      category: "USDT-FUTURES",
      symbol: pair.perp,
    }),
    bitgetPublicGet<Record<string, unknown>[]>("/api/v3/market/tickers", {
      category: "SPOT",
      symbol: pair.spot,
    }),
  ]);

  const p = Array.isArray(perpEnv.data) ? perpEnv.data[0] : undefined;
  const s = Array.isArray(spotEnv.data) ? spotEnv.data[0] : undefined;

  return {
    tsUtc: tUtc,
    tsEt,
    perp: pair.perp,
    spot: pair.spot,
    indexPrice: num(p, "indexPrice"),
    markPrice: num(p, "markPrice"),
    spotLast: num(s, "lastPr", "lastPrice"),
    spotBid: num(s, "bidPr", "bid1Price"),
    spotAsk: num(s, "askPr", "ask1Price"),
    raw: { perp: p ?? perpEnv, spot: s ?? spotEnv },
    prevHash: "", // filled in by runTick once the chained hash is known
    hash: "",
  };
}

/** Run exactly one tick over all configured pairs, hash-chaining each record onto OUT_FILE. Returns the new chain head. */
export async function runTick(pairs: Pair[], prevHashIn: string): Promise<string> {
  await mkdir("data/clock/raw", { recursive: true });
  const tUtc = Date.now();
  const tsEt = etFmt.format(new Date(tUtc));
  let prev = prevHashIn;

  for (const pair of pairs) {
    try {
      const rec = await fetchPairRecord(pair, tUtc, tsEt);
      const { prevHash: _ph, hash: _h, ...bodyForHash } = rec;
      const hash = createHash("sha256").update(prev + canonicalJson(bodyForHash)).digest("hex");
      const full: TickRecord = { ...rec, prevHash: prev, hash };
      await appendFile(OUT_FILE, `${JSON.stringify(full)}\n`);
      prev = hash;
    } catch (e) {
      await appendFile(
        ERROR_FILE,
        `${JSON.stringify({ t: Date.now(), pair, e: e instanceof Error ? e.message : String(e) })}\n`,
      );
    }
  }
  return prev;
}
