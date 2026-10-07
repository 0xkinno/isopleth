// E1: the Collateral Clock recorder. Long-running local process: every 60s,
// for every stock-perp / rToken-spot pair in data/clock/pairs.json (produced
// by the E2 instrument scan - run that first), capture indexPrice/markPrice
// and the spot quote, hash-chain the record, append to data/clock/raw/e1.jsonl.
//
// PUBLIC ONLY. No API key. No account. No cost.
import { setTimeout as sleep } from "node:timers/promises";
import { loadPairs, lastHash, runTick, ERROR_FILE } from "../../packages/data/src/tick";
import { appendFile } from "node:fs/promises";

const TICK_MS = 60_000;

async function main() {
  const pairs = await loadPairs();
  console.log(`[e1] recorder starting. ${pairs.length} pair(s): ${pairs.map((p) => p.perp).join(", ")}`);
  console.log(`[e1] ticking every ${TICK_MS / 1000}s. Ctrl+C to stop.`);

  let prev = await lastHash();
  console.log(`[e1] chain head: ${prev}`);

  for (;;) {
    const start = Date.now();
    try {
      prev = await runTick(pairs, prev);
      console.log(`[e1] tick ok @ ${new Date(start).toISOString()} chain=${prev.slice(0, 12)}`);
    } catch (e) {
      console.error("[e1] tick failed:", e);
      await appendFile(ERROR_FILE, `${JSON.stringify({ t: Date.now(), fatal: true, e: String(e) })}\n`);
    }
    const elapsed = Date.now() - start;
    await sleep(Math.max(0, TICK_MS - elapsed));
  }
}

main().catch((e) => {
  console.error("[e1] fatal:", e);
  process.exitCode = 1;
});
