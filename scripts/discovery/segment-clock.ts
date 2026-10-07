// E1 segmentation: turn the raw hash-chained tick log into classified
// reference-state segments and extract every transition instant, per
// FINAL_INSTRUCTION.md section 4.2.
//
// Classification per sample, computed per (perp,spot) pair over time:
//   OPEN_LIVE             indexPrice is actively changing
//   MARKET_CLOSED_FROZEN  indexPrice constant across >= FREEZE_MIN_RUN
//                         consecutive samples while markPrice or rToken
//                         spot is still moving
//   STALE                 indexPrice constant AND markPrice/spot also idle
//                         (nothing is moving - could be a dead feed, not
//                         necessarily a real freeze)
//   REOPENING             the single sample where indexPrice first changes
//                         again after a MARKET_CLOSED_FROZEN run
//   UNKNOWN               a sampling gap longer than GAP_TOLERANCE_MS - never
//                         interpolated, never silently bridged
//
// Reads data/clock/raw/e1.jsonl (hash-chained, append-only). Writes
// data/clock/clock-map.json: per-pair segments + every extracted transition
// with its ET timestamp and the evidence (raw record) backing it.
import { mkdir, readFile, writeFile } from "node:fs/promises";

const RAW_FILE = "data/clock/raw/e1.jsonl";
const OUT_FILE = "data/clock/clock-map.json";

const FREEZE_MIN_RUN = 10; // consecutive constant-indexPrice samples required to confirm a freeze
const GAP_TOLERANCE_MS = 5 * 60_000; // > 5x the 60s tick cadence => treat as a gap, not a continuation

interface TickRecord {
  tsUtc: number;
  tsEt: string;
  perp: string;
  spot: string;
  indexPrice: number;
  markPrice: number;
  spotLast: number;
  spotBid: number;
  spotAsk: number;
  hash: string;
}

type State = "OPEN_LIVE" | "MARKET_CLOSED_FROZEN" | "REOPENING" | "STALE" | "UNKNOWN";

interface Segment {
  state: State;
  startUtc: number;
  startEt: string;
  endUtc: number;
  endEt: string;
  sampleCount: number;
  startHash: string;
  endHash: string;
}

interface Transition {
  pair: string;
  fromState: State;
  toState: State;
  atUtc: number;
  atEt: string;
  evidenceHash: string;
}

async function loadRecords(): Promise<TickRecord[]> {
  const raw = await readFile(RAW_FILE, "utf8").catch(() => "");
  const lines = raw.trimEnd().split("\n").filter(Boolean);
  return lines.map((l) => JSON.parse(l) as TickRecord);
}

const approxEq = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9;

// Raw per-sample label, before run-length confirmation and before the
// REOPENING marker is carved out. Deliberately has no "REOPENING" case:
// reopening is not a property of a single sample in isolation, it is a
// property of a LIVE run's position relative to the run before it, so it is
// only assigned once runs have been grouped (see classifyPair).
type RawLabel = "OPEN_LIVE" | "FROZEN_CANDIDATE" | "STALE" | "UNKNOWN";

function rawLabelFor(prev: TickRecord | null, r: TickRecord): RawLabel {
  if (prev === null) return "OPEN_LIVE"; // no history yet to classify against
  if (r.tsUtc - prev.tsUtc > GAP_TOLERANCE_MS) return "UNKNOWN";
  const indexConstant = approxEq(r.indexPrice, prev.indexPrice);
  const somethingElseMoving = !approxEq(r.markPrice, prev.markPrice) || !approxEq(r.spotLast, prev.spotLast);
  if (!indexConstant) return "OPEN_LIVE";
  return somethingElseMoving ? "FROZEN_CANDIDATE" : "STALE";
}

function classifyPair(pairKey: string, records: TickRecord[]): { segments: Segment[]; transitions: Transition[] } {
  const segments: Segment[] = [];
  const transitions: Transition[] = [];

  const rawLabels: RawLabel[] = records.map((r, i) => rawLabelFor(i > 0 ? records[i - 1]! : null, r));

  // Group into maximal runs of the same raw label, then decide the final
  // state per run. A FROZEN_CANDIDATE run only becomes MARKET_CLOSED_FROZEN
  // once it has run long enough to be confirmed (FREEZE_MIN_RUN); otherwise
  // it is unconfirmed and downgraded to STALE rather than asserted. The
  // sample immediately after a *confirmed* frozen run - and only that one
  // sample - is relabelled REOPENING; everything else in an OPEN_LIVE run
  // stays OPEN_LIVE even though, tick to tick, indexPrice keeps changing
  // throughout a normal live market (that is not evidence of reopening, it
  // is evidence of being open).
  interface Run { rawLabel: RawLabel; start: number; end: number /* exclusive */ }
  const runs: Run[] = [];
  let runStart = 0;
  for (let i = 1; i <= rawLabels.length; i += 1) {
    if (i < rawLabels.length && rawLabels[i] === rawLabels[runStart]) continue;
    runs.push({ rawLabel: rawLabels[runStart]!, start: runStart, end: i });
    runStart = i;
  }

  const finalStates: State[] = new Array(records.length);
  let prevRunWasConfirmedFreeze = false;
  for (const run of runs) {
    const len = run.end - run.start;
    let state: State;
    if (run.rawLabel === "FROZEN_CANDIDATE") {
      state = len >= FREEZE_MIN_RUN ? "MARKET_CLOSED_FROZEN" : "STALE"; // unconfirmed - do not assert a freeze on weak evidence
    } else {
      state = run.rawLabel;
    }
    for (let j = run.start; j < run.end; j += 1) {
      finalStates[j] = j === run.start && prevRunWasConfirmedFreeze && state === "OPEN_LIVE" ? "REOPENING" : state;
    }
    prevRunWasConfirmedFreeze = state === "MARKET_CLOSED_FROZEN";
  }
  const runStates = finalStates;

  // Build segments + transitions from the confirmed per-sample state sequence.
  let segStart = 0;
  for (let i = 1; i <= records.length; i += 1) {
    const atEnd = i === records.length;
    if (!atEnd && runStates[i] === runStates[segStart]) continue;
    const segRecords = records.slice(segStart, i);
    const first = segRecords[0]!;
    const last = segRecords[segRecords.length - 1]!;
    segments.push({
      state: runStates[segStart]!,
      startUtc: first.tsUtc,
      startEt: first.tsEt,
      endUtc: last.tsUtc,
      endEt: last.tsEt,
      sampleCount: segRecords.length,
      startHash: first.hash,
      endHash: last.hash,
    });
    if (segStart > 0) {
      const prevState = runStates[segStart - 1]!;
      const toState = runStates[segStart]!;
      if (prevState !== toState) {
        transitions.push({
          pair: pairKey,
          fromState: prevState,
          toState,
          atUtc: first.tsUtc,
          atEt: first.tsEt,
          evidenceHash: first.hash,
        });
      }
    }
    segStart = i;
  }

  return { segments, transitions };
}

async function main() {
  const records = await loadRecords();
  if (records.length === 0) {
    console.error(`[clockmap] ${RAW_FILE} is empty or missing - nothing recorded yet. Run the E1 recorder first.`);
    process.exitCode = 1;
    return;
  }

  const byPair = new Map<string, TickRecord[]>();
  for (const r of records) {
    const key = `${r.perp}<->${r.spot}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key)!.push(r);
  }

  const result: Record<string, { segments: Segment[]; transitions: Transition[] }> = {};
  let totalTransitions = 0;
  let freezeThawPairs = 0;
  for (const [pairKey, recs] of byPair) {
    recs.sort((a, b) => a.tsUtc - b.tsUtc);
    const { segments, transitions } = classifyPair(pairKey, recs);
    result[pairKey] = { segments, transitions };
    totalTransitions += transitions.length;
    if (transitions.some((t) => t.toState === "MARKET_CLOSED_FROZEN") && transitions.some((t) => t.toState === "REOPENING")) {
      freezeThawPairs += 1;
    }
  }

  await mkdir("data/clock", { recursive: true });
  await writeFile(
    OUT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        rawRecordCount: records.length,
        pairCount: byPair.size,
        freezeMinRunSamples: FREEZE_MIN_RUN,
        gapToleranceMs: GAP_TOLERANCE_MS,
        totalTransitions,
        pairsWithAtLeastOneFreezeAndThaw: freezeThawPairs,
        byPair: result,
      },
      null,
      2,
    ),
  );

  console.log(`[clockmap] ${records.length} record(s) across ${byPair.size} pair(s) -> ${OUT_FILE}`);
  console.log(`[clockmap] total transitions: ${totalTransitions}, pairs with >=1 freeze+thaw: ${freezeThawPairs}`);
  if (freezeThawPairs === 0) {
    console.log(
      "[clockmap] no freeze+thaw pair observed yet. That is expected until the recorder has run across a full " +
        "weekend/holiday close-and-reopen; this is not a failure, it is an honest N=0-so-far result (Gate A allows " +
        "stating this explicitly if the window hasn't elapsed).",
    );
  }
}

main().catch((e) => {
  console.error("[clockmap] fatal:", e);
  process.exitCode = 1;
});
