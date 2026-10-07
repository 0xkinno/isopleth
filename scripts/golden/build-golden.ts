// One-time generator for data/verify/golden.json - the fixed input books +
// their expected deterministic resultHash that `pnpm verify:offline`
// recomputes against. Re-run this ONLY when the kernel's output is meant to
// change (a real fix, a documented ruleset update) - never to make a
// verify:offline failure disappear without understanding why it failed.
import { mkdir, writeFile } from "node:fs/promises";
import { evaluate, resultHash, type Book } from "@isopleth/core";

// Self-contained fixtures (never imported from apps/web, so this script has
// no cross-package build dependency) - "leveraged-demo" deliberately mirrors
// the shape of the Workbench's demo book without importing it, so the two
// can drift independently without breaking this verifier.
const fixtures: Record<string, Book> = {
  "leveraged-demo": {
    collateral: [
      {
        coin: "rAAPL",
        qty: 40,
        referenceUsd: 230,
        referenceState: "OPEN_LIVE",
        tiers: [{ startUsd: 0, rate: 0.9 }],
        rulesetVersion: "golden-1",
        evidence: "SYNTHETIC",
        sourceRefs: [],
      },
    ],
    positions: [
      { symbol: "BTCUSDT", side: "LONG", qty: 1.1, markUsd: 62_000, kind: "crypto", tiers: [{ symbol: "BTCUSDT", minNotional: 0, maxNotional: 500_000, maintenanceMarginRate: 0.01, takerFee: 0.0006, sourceRef: "golden" }] },
      { symbol: "ETHUSDT", side: "LONG", qty: 10, markUsd: 3_200, kind: "crypto", tiers: [{ symbol: "ETHUSDT", minNotional: 0, maxNotional: 500_000, maintenanceMarginRate: 0.01, takerFee: 0.0006, sourceRef: "golden" }] },
    ],
    cashUsd: 3_000,
    liabilitiesUsd: 0,
    unrealisedPnlUsd: 0,
    partialLiqFeeUsd: 0,
  },
  "cash-only": {
    collateral: [],
    positions: [],
    cashUsd: 10_000,
    liabilitiesUsd: 0,
    unrealisedPnlUsd: 0,
    partialLiqFeeUsd: 0,
  },
  "single-rtoken": {
    collateral: [
      {
        coin: "rAAPL",
        qty: 50,
        referenceUsd: 220,
        referenceState: "OPEN_LIVE",
        tiers: [
          { startUsd: 0, rate: 0.95 },
          { startUsd: 8_000, rate: 0.85 },
        ],
        rulesetVersion: "golden-1",
        evidence: "SYNTHETIC",
        sourceRefs: ["golden-fixture"],
      },
    ],
    positions: [],
    cashUsd: 500,
    liabilitiesUsd: 0,
    unrealisedPnlUsd: 0,
    partialLiqFeeUsd: 0,
  },
};

async function main() {
  const golden: Record<string, { book: Book; expectedHash: string }> = {};
  for (const [name, book] of Object.entries(fixtures)) {
    const r = evaluate(book);
    if (!r.ok) throw new Error(`golden fixture "${name}" refused: ${r.reason} - fix the fixture, not the kernel`);
    golden[name] = { book, expectedHash: resultHash(book, r.value) };
  }
  await mkdir("data/verify", { recursive: true });
  await writeFile("data/verify/golden.json", JSON.stringify(golden, null, 2));
  console.log(`[build-golden] wrote data/verify/golden.json (${Object.keys(golden).length} fixtures)`);
}

main().catch((e) => {
  console.error("[build-golden] fatal:", e);
  process.exitCode = 1;
});
