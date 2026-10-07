// E4 replay (FINAL_INSTRUCTION.md section 4.5 / data/windows/pre-registration.md):
// computes real G_w values per closed-market window from the E1 recorder's
// OWN tick log - never from Bitget's candle endpoint, because F8 (confirmed
// live in E3) means a type=index/mark candle request silently returns
// type=market data, which would make any "reference price" reconstructed
// from candles fiction. The only trustworthy source for a reference-price
// time series is the ticker-based E1 log itself, so a window can only be
// replayed once it is *fully inside* the period the recorder has actually
// covered - most of window-set.json's 31 windows predate the recorder
// (launched 2026-10-04) and cannot be replayed from this log, honestly,
// at all. This script says exactly that rather than guessing.
import { mkdir, readFile, writeFile } from "node:fs/promises";

interface WindowSet {
  windows: Array<{ id: string; freezeStart: string; thawDate: string }>;
}

interface TickRecord {
  tsUtc: number;
  perp: string;
  spot: string;
  indexPrice: number;
  spotLast: number;
}

interface WindowReplay {
  windowId: string;
  pair: string;
  frozenAnchor: number;
  firstPostThawPrint: number;
  gW: number; // log(firstPostThawPrint / frozenAnchor)
  shadowSpotMove: number; // log(spot at thaw / spot at freeze) - the shadow predictor's input
}

const ET_OFFSET_HOURS = 4; // EDT (UTC-4) for 2026-10 dates; this script only ever runs against windows inside the recorder's live coverage, all of which are EDT in 2026

function etDateToUtcMs(dateIso: string, hour: number, minute: number): number {
  return new Date(`${dateIso}T${String(hour + ET_OFFSET_HOURS).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`).getTime();
}

async function main() {
  const windowSet = JSON.parse(await readFile("data/windows/window-set.json", "utf8")) as WindowSet;
  const raw = (await readFile("data/clock/raw/e1.jsonl", "utf8")).trimEnd().split("\n").filter(Boolean);
  const records = raw.map((l) => JSON.parse(l) as TickRecord);
  if (records.length === 0) throw new Error("data/clock/raw/e1.jsonl is empty - nothing to replay");

  const byPair = new Map<string, TickRecord[]>();
  for (const r of records) {
    const key = `${r.perp}<->${r.spot}`;
    (byPair.get(key) ?? byPair.set(key, []).get(key)!).push(r);
  }
  for (const list of byPair.values()) list.sort((a, b) => a.tsUtc - b.tsUtc);

  const recordedStart = Math.min(...records.map((r) => r.tsUtc));
  const recordedEnd = Math.max(...records.map((r) => r.tsUtc));

  const replays: WindowReplay[] = [];
  const skipped: Array<{ windowId: string; reason: string }> = [];

  for (const w of windowSet.windows) {
    // Freeze candidate: last trading day's close (16:00 ET). Thaw candidate: the thaw date's open (09:30 ET).
    const freezeMs = etDateToUtcMs(w.freezeStart, 16, 0);
    const thawMs = etDateToUtcMs(w.thawDate, 9, 30);

    if (freezeMs < recordedStart || thawMs > recordedEnd) {
      skipped.push({ windowId: w.id, reason: "outside the recorder's covered period" });
      continue;
    }

    let anyPair = false;
    for (const [pairKey, list] of byPair) {
      const lastBeforeFreeze = [...list].reverse().find((r) => r.tsUtc <= freezeMs);
      const firstAfterThaw = list.find((r) => r.tsUtc >= thawMs);
      if (!lastBeforeFreeze || !firstAfterThaw) continue;
      if (lastBeforeFreeze.indexPrice <= 0 || firstAfterThaw.indexPrice <= 0) continue;
      anyPair = true;
      replays.push({
        windowId: w.id,
        pair: pairKey,
        frozenAnchor: lastBeforeFreeze.indexPrice,
        firstPostThawPrint: firstAfterThaw.indexPrice,
        gW: Math.log(firstAfterThaw.indexPrice / lastBeforeFreeze.indexPrice),
        shadowSpotMove: Math.log(firstAfterThaw.spotLast / lastBeforeFreeze.spotLast),
      });
    }
    if (!anyPair) skipped.push({ windowId: w.id, reason: "window is inside the recorded period but no pair had both a pre-freeze and a post-thaw tick" });
  }

  await mkdir("data/windows", { recursive: true });
  await writeFile(
    "data/windows/replay-results.json",
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        recordedPeriod: { start: new Date(recordedStart).toISOString(), end: new Date(recordedEnd).toISOString() },
        windowsInSet: windowSet.windows.length,
        windowsReplayed: new Set(replays.map((r) => r.windowId)).size,
        pairWindowObservations: replays.length,
        skipped,
        replays,
      },
      null,
      2,
    ),
  );

  console.log(
    `[e4-replay] ${new Set(replays.map((r) => r.windowId)).size}/${windowSet.windows.length} window(s) replayable from the recorder's own log (${replays.length} pair-window observation(s)); ${skipped.length} skipped. -> data/windows/replay-results.json`,
  );
  if (replays.length === 0) {
    console.log("[e4-replay] 0 observations - expected until a full closed-market window (e.g. the 2026-10-09 to 2026-10-12 weekend) has fully elapsed while the recorder is running. Re-run this after that weekend passes.");
  }
}

main().catch((e) => {
  console.error("[e4-replay] fatal:", e);
  process.exitCode = 1;
});
