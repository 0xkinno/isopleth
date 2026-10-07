// Single-shot version of E1 for the GitHub Actions cron workflow
// (.github/workflows/recorder.yml): run exactly one tick, then exit, so the
// collateral clock keeps recording even while the local machine sleeps.
//
// PUBLIC ONLY. No API key. No account. No cost.
import { loadPairs, lastHash, runTick } from "../../packages/data/src/tick";

async function main() {
  const pairs = await loadPairs();
  const prev = await lastHash();
  const next = await runTick(pairs, prev);
  console.log(`[e1-tick] ${pairs.length} pair(s) recorded. chain head: ${next}`);
}

main().catch((e) => {
  console.error("[e1-tick] fatal:", e);
  process.exitCode = 1;
});
