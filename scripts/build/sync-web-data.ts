// Runs before `next build` (and can be re-run anytime in dev). Produces one
// small, honest summary file the app actually fetches, instead of shipping
// the growing multi-MB raw tick log into the deployment. Every number here
// traces back to a real file in data/ - nothing here is invented for the UI.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolved relative to this file, never to process.cwd() - this script is
// invoked both from the monorepo root (pnpm run sync:web) and from inside
// apps/web (as part of `next build`, where Vercel's Root Directory makes
// cwd=apps/web), and a cwd-relative path silently resolved to nothing in the
// latter case, making every number in the deployed summary quietly report
// zero instead of real data - exactly the kind of silent-wrong-number bug
// this project's own rules (I5) exist to prevent. This exact bug has already
// bitten this build twice; do not revert this to a bare relative path again.
const ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const OUT_DIR = path.join(ROOT, "apps/web/public/data");

async function readJson<T>(relPath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(ROOT, relPath), "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function main() {
  const clockMap = await readJson<{
    generatedAt: string;
    rawRecordCount: number;
    pairCount: number;
    totalTransitions: number;
    pairsWithAtLeastOneFreezeAndThaw: number;
    byPair: Record<string, { segments: Array<{ state: string; endUtc: number; endEt: string }> }>;
  }>("data/clock/clock-map.json", {
    generatedAt: new Date(0).toISOString(),
    rawRecordCount: 0,
    pairCount: 0,
    totalTransitions: 0,
    pairsWithAtLeastOneFreezeAndThaw: 0,
    byPair: {},
  });

  const windowSet = await readJson<{ windowCount: number; windows: unknown[] }>("data/windows/window-set.json", { windowCount: 0, windows: [] });
  const claims = await readJson<{ claims: Array<{ id: string; statement: string; status: string }> }>("CLAIMS.json", { claims: [] });
  const fallbackTrap = await readJson<{ confirmed: boolean; probedAt: string }>("data/clock/e3-fallback-trap.json", { confirmed: false, probedAt: "" });
  const mcpTools = await readJson<{ tools: Array<{ name: string }>; capturedAt: string }>("docs/mcp-tools.json", { tools: [], capturedAt: "" });
  const pairs = await readJson<Array<{ perp: string; spot: string; underlying: string }>>("data/clock/pairs.json", []);

  let latestSampleUtc = 0;
  let confirmedFreezeThaw: Array<{ pair: string; freezeStartEt: string; thawEt: string }> = [];
  for (const [pairKey, v] of Object.entries(clockMap.byPair)) {
    for (const seg of v.segments) {
      if (seg.endUtc > latestSampleUtc) latestSampleUtc = seg.endUtc;
    }
    const frozen = v.segments.filter((s) => s.state === "MARKET_CLOSED_FROZEN");
    const reopening = v.segments.filter((s) => s.state === "REOPENING");
    if (frozen.length > 0 && reopening.length > 0) {
      confirmedFreezeThaw.push({ pair: pairKey, freezeStartEt: frozen[0]!.endEt, thawEt: reopening[0]!.endEt });
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    clock: {
      lastClockmapRunAt: clockMap.generatedAt,
      latestSampleUtc,
      rawRecordCount: clockMap.rawRecordCount,
      pairCount: clockMap.pairCount,
      totalTransitions: clockMap.totalTransitions,
      pairsWithConfirmedFreezeThaw: clockMap.pairsWithAtLeastOneFreezeAndThaw,
      confirmedFreezeThaw: confirmedFreezeThaw.slice(0, 10),
    },
    windows: { count: windowSet.windowCount },
    claims: claims.claims,
    f8Trap: fallbackTrap,
    mcp: { toolCount: mcpTools.tools.length, capturedAt: mcpTools.capturedAt },
    universe: { pairCount: pairs.length, sample: pairs.slice(0, 12) },
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`[sync-web-data] wrote ${path.join(OUT_DIR, "summary.json")} (${clockMap.rawRecordCount} records, ${clockMap.pairCount} pairs, ${confirmedFreezeThaw.length} confirmed freeze+thaw)`);
}

main().catch((e) => {
  console.error("[sync-web-data] fatal:", e);
  process.exitCode = 1;
});
