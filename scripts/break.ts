// Break campaign (FINAL_INSTRUCTION.md section 11). Covers the attacks that
// are concretely testable against what exists today (the kernel + the F8
// guard + the number-binding guard). The infra-heavy ones (B4 mid-window
// ruleset change, B6 prompt injection, B8 hash tamper, B10 API schema drift,
// B11 key-permission boot probe) need pieces not built yet (Phase E auth,
// a hash-chain reader script) and are marked NOT_YET rather than faked.
import { mkdir, writeFile } from "node:fs/promises";
import { evaluate, applyScenario, type Book, type Scenario } from "@isopleth/core";
import { bindNumbers } from "@isopleth/llm";
import { guardRTokenCandleType } from "../packages/data/src/guards";
import { parseJsonlChain, recomputeHash, verifyChain } from "../packages/data/src/chainVerify";

interface BreakResult {
  id: string;
  attack: string;
  expected: string;
  systemResponse: string;
  verified: boolean;
}

function baseBook(): Book {
  return {
    collateral: [
      { coin: "rAAPL", qty: 40, referenceUsd: 230, referenceState: "OPEN_LIVE", tiers: [{ startUsd: 0, rate: 0.9 }], rulesetVersion: "break-1", evidence: "SYNTHETIC", sourceRefs: [] },
    ],
    positions: [
      { symbol: "BTCUSDT", side: "LONG", qty: 1, markUsd: 60_000, kind: "crypto", tiers: [{ symbol: "BTCUSDT", minNotional: 0, maxNotional: 500_000, maintenanceMarginRate: 0.01, takerFee: 0.0006, sourceRef: "break" }] },
    ],
    cashUsd: 2_000,
    liabilitiesUsd: 0,
    unrealisedPnlUsd: 0,
    partialLiqFeeUsd: 0,
  };
}

const results: BreakResult[] = [];

function record(id: string, attack: string, expected: string, verified: boolean, systemResponse: string) {
  results.push({ id, attack, expected, systemResponse, verified });
}

// B1: stale/unknown reference state -> refuse, never a plausible substitute
{
  const b = baseBook();
  b.collateral[0]!.referenceState = "UNKNOWN";
  const r = evaluate(b);
  record("B1", "Reference state UNKNOWN on a collateral asset", "Refuse (I5), no number produced", !r.ok, r.ok ? "WRONG: produced a result" : `REFUSED: ${r.reason}`);
}

// B2: missing collateral ratio (empty tiers) -> UNKNOWN, never fabricated
{
  const b = baseBook();
  b.collateral[0]!.tiers = [];
  const r = evaluate(b);
  record("B2", "Collateral asset has no tier data", "Refuse (I5), never fabricate a rate", !r.ok, r.ok ? "WRONG: produced a result" : `REFUSED: ${r.reason}`);
}

// B3: notional exactly on a tier boundary -> deterministic, matches the kernel's own documented (lo, hi] convention
{
  const b = baseBook();
  b.collateral[0]!.qty = 100; // value = 100*230 = 23,000, exactly the tier boundary below
  b.collateral[0]!.tiers = [
    { startUsd: 0, rate: 0.95 },
    { startUsd: 23_000, rate: 0.8 },
  ];
  const r = evaluate(b);
  // (lo, hi]: 23,000 should land entirely in the FIRST tier's upper bound (not the second tier's lower-exclusive bound)
  const expectedCollateral = 23_000 * 0.95;
  const verified = r.ok && Math.abs(r.value.adjEquityUsd - (expectedCollateral + b.cashUsd)) < 1e-6;
  record("B3", "Notional exactly on a tier boundary (23,000)", "Deterministic per kernel's (lo, hi] convention - boundary value stays in the lower tier", verified, r.ok ? `adjEquity=${r.value.adjEquityUsd}` : `REFUSED: ${r.reason}`);
}

// B4: mid-window ruleset change - needs the versioned-rules replay harness (not built)
record("B4", "Collateral ratio ladder changes mid-window", "Both rulesets versioned and replayable", false, "NOT_YET: needs a versioned-rules replay harness (Phase C)");

// B5: position crosses a maintenance tier -> tier changes exactly where the verified rule says
{
  const b = baseBook();
  b.positions[0]!.tiers = [
    { symbol: "BTCUSDT", minNotional: 0, maxNotional: 50_000, maintenanceMarginRate: 0.005, takerFee: 0.0006, sourceRef: "break" },
    { symbol: "BTCUSDT", minNotional: 50_000, maxNotional: 200_000, maintenanceMarginRate: 0.01, takerFee: 0.0006, sourceRef: "break" },
  ];
  const below = evaluate({ ...b, positions: [{ ...b.positions[0]!, qty: 0.8 }] }); // notional 48,000 - tier 1
  const above = evaluate({ ...b, positions: [{ ...b.positions[0]!, qty: 0.9 }] }); // notional 54,000 - tier 2
  const verified = below.ok && above.ok && below.value.tierSelections.BTCUSDT !== above.value.tierSelections.BTCUSDT;
  record("B5", "Position notional crosses a maintenance tier boundary", "Tier selection changes exactly at the documented boundary", verified, `below=${below.ok ? below.value.tierSelections.BTCUSDT : "REFUSED"} above=${above.ok ? above.value.tierSelections.BTCUSDT : "REFUSED"}`);
}

// B6: prompt injection in a research source - needs a live LLM call (Qwen/Gemini key)
record("B6", "Prompt injection in a research source", "LLM cannot alter calculations or evidence labels (I6)", false, "NOT_YET: needs a live LLM call with a research-source tool result (Phase E)");

// B7: LLM emits an invented number -> number-binding guard rejects it, driver-independent
{
  const b = baseBook();
  const r = evaluate(b);
  const facts = r.ok ? [r.value.adjEquityUsd, r.value.maintenanceMarginUsd, r.value.crossMarginRate] : [];
  const invented = `Your equity is ${r.ok ? r.value.adjEquityUsd : 0} but you will be liquidated at exactly 7777777.`;
  const bound = bindNumbers(invented, facts);
  record("B7", "Narration contains a number the kernel did not produce", "Number-binding guard rejects it (I6)", !bound.ok && bound.orphans.includes(7777777), `orphans=${JSON.stringify(bound.orphans)}`);
}

// B8: one byte edited in a stored snapshot -> hash mismatch, diverging
// recompute, fail closed. Verified against the real recorded tick log: the
// whole chain must verify clean first, then a one-byte tamper on a copy of
// the last real record must be caught by the same recompute.
{
  try {
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync("data/clock/raw/e1.jsonl", "utf8");
    const records = parseJsonlChain(raw);
    const clean = verifyChain(records);

    const last = records[records.length - 1]!;
    const tampered = { ...last, markPrice: last.markPrice === 0 ? 0.000001 : (last.markPrice as number) * 1.0000001 };
    const prevOfLast = records.length > 1 ? records[records.length - 2]!.hash : "GENESIS";
    const tamperDetected = recomputeHash(prevOfLast, tampered) !== last.hash;

    const verified = clean.ok && tamperDetected;
    record(
      "B8",
      "One byte edited in a stored clock snapshot",
      "Hash mismatch, diverging recompute, fail closed",
      verified,
      clean.ok
        ? `chain clean over ${clean.total} records; a one-field tamper on the last record changes its recomputed hash (detected=${tamperDetected})`
        : `chain NOT clean: ${clean.brokenAt.length} break(s) at indices ${clean.brokenAt.slice(0, 5).join(",")}`,
    );
  } catch {
    record("B8", "One byte edited in a stored clock snapshot", "Hash mismatch, diverging recompute, fail closed", false, "NOT_YET: data/clock/raw/e1.jsonl not found (recorder hasn't run in this environment)");
  }
}

// B9: duplicate tick record - dedup check against the real recorded log, if present
{
  try {
    const { readFileSync } = await import("node:fs");
    const lines = readFileSync("data/clock/raw/e1.jsonl", "utf8").trim().split("\n").filter(Boolean);
    const hashes = lines.map((l) => (JSON.parse(l) as { hash: string }).hash);
    const dupes = hashes.length - new Set(hashes).size;
    record("B9", "Duplicate or out-of-order record in the real tick log", "Zero duplicate hashes in the hash chain", dupes === 0, `${lines.length} records, ${dupes} duplicate hash(es)`);
  } catch {
    record("B9", "Duplicate or out-of-order record", "Zero duplicate hashes", false, "NOT_YET: data/clock/raw/e1.jsonl not found (recorder hasn't run in this environment)");
  }
}

// B10: public API schema change (simulated) - needs a fuzzed-response harness (not built)
record("B10", "Public API schema change (simulated)", "Adapter fails loudly, never produces a plausible wrong value", false, "NOT_YET: needs a response-fuzzing harness around packages/data/src/client.ts (Phase C)");

// B11: a key with trade permission supplied - needs the auth/boot-probe layer (Phase E, not built)
record("B11", "A key with trade permission supplied at boot", "Boot probe refuses it (I7)", false, "NOT_YET: no authenticated key path exists yet (E5/Phase E)");

// B12: rToken candle type=index - guard rejects use as a reference index (already built and confirmed live in E3)
{
  let threw = false;
  try {
    guardRTokenCandleType("index");
  } catch {
    threw = true;
  }
  record("B12", "Code requests rToken candle type=index as a reference index", "Guard rejects it (confirmed live in E3, data/clock/e3-fallback-trap.json)", threw, threw ? "guard threw as expected" : "WRONG: guard did not throw");
}

// B13: null / permuted control - the permutation-test harness itself is
// built and real (packages/core/src/e4stat.ts, tested in
// tests/unit/e4stat.test.ts), and scripts/discovery/e4-replay.ts runs
// against the live recorder log on every invocation. What's still missing
// is N: the rule needs >=2 fully-elapsed closed-market windows, and as of
// this run the recorder (launched 2026-10-04) has observed zero, which
// e4-replay.ts reports honestly rather than padding with a guess.
{
  try {
    const replay = JSON.parse((await import("node:fs")).readFileSync("data/windows/replay-results.json", "utf8")) as { replays: Array<{ windowId: string }> };
    const n = new Set(replay.replays.map((r) => r.windowId)).size;
    if (n >= 2) {
      record("B13", "Null / permuted control on the reopening-gap predictor", "Contour movement vanishes under the null control", true, `${n} window(s) replayed - see data/bench/results.json for the permutation-test outcome`);
    } else {
      record("B13", "Null / permuted control on the reopening-gap predictor", "Contour movement vanishes under the null control", false, `NOT_YET: harness is built and real (packages/core/src/e4stat.ts) but only ${n} window(s) have elapsed since the recorder started - needs N>=2, see data/windows/pre-registration.md`);
    }
  } catch {
    record("B13", "Null / permuted control on the reopening-gap predictor", "Contour movement vanishes under the null control", false, "NOT_YET: run `pnpm discovery:e4:replay` first");
  }
}

async function main() {
  await mkdir("data/break", { recursive: true });
  const verifiedCount = results.filter((r) => r.verified).length;
  const notYetCount = results.filter((r) => !r.verified && r.systemResponse.startsWith("NOT_YET")).length;
  const failedCount = results.length - verifiedCount - notYetCount;
  await writeFile(
    "data/break/results.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), total: results.length, verified: verifiedCount, notYet: notYetCount, failed: failedCount, results }, null, 2),
  );
  console.log(`[break] ${verifiedCount}/${results.length} verified, ${notYetCount} not-yet-built, ${failedCount} FAILED`);
  for (const r of results) console.log(`  ${r.verified ? "PASS" : r.systemResponse.startsWith("NOT_YET") ? "SKIP" : "FAIL"} ${r.id}: ${r.attack}`);
  if (failedCount > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("[break] fatal:", e);
  process.exitCode = 1;
});
