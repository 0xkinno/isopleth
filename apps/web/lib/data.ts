// Server-side read of the pre-synced summary (scripts/build/sync-web-data.ts
// writes public/data/summary.json before every build). No number here is
// typed by hand - if the summary file is missing (e.g. a clean clone that
// hasn't run the sync step), this returns an explicit empty/zero shape
// rather than fabricating plausible-looking numbers (I5 in spirit).
import { readFile } from "node:fs/promises";
import path from "node:path";

export interface Summary {
  generatedAt: string;
  clock: {
    lastClockmapRunAt: string;
    latestSampleUtc: number;
    rawRecordCount: number;
    pairCount: number;
    totalTransitions: number;
    pairsWithConfirmedFreezeThaw: number;
    confirmedFreezeThaw: Array<{ pair: string; freezeStartEt: string; thawEt: string }>;
  };
  windows: { count: number };
  claims: Array<{ id: string; statement: string; label: string; status: string; note?: string }>;
  f8Trap: { confirmed: boolean; probedAt: string };
  mcp: { toolCount: number; capturedAt: string };
  universe: { pairCount: number; sample: Array<{ perp: string; spot: string; underlying: string }> };
}

const EMPTY: Summary = {
  generatedAt: new Date(0).toISOString(),
  clock: { lastClockmapRunAt: "", latestSampleUtc: 0, rawRecordCount: 0, pairCount: 0, totalTransitions: 0, pairsWithConfirmedFreezeThaw: 0, confirmedFreezeThaw: [] },
  windows: { count: 0 },
  claims: [],
  f8Trap: { confirmed: false, probedAt: "" },
  mcp: { toolCount: 0, capturedAt: "" },
  universe: { pairCount: 0, sample: [] },
};

export async function getSummary(): Promise<Summary> {
  try {
    const p = path.join(process.cwd(), "public", "data", "summary.json");
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as Summary;
  } catch {
    return EMPTY;
  }
}

export function ageLabel(utcMs: number): string {
  if (!utcMs) return "no data yet";
  const seconds = Math.round((Date.now() - utcMs) / 1000);
  if (seconds < 90) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
