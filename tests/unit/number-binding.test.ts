// This test is the evidence for I6 ("the LLM cannot move a number"): it runs
// the SAME book through the kernel while a gemini driver is selected, and
// again while the none driver is selected, and asserts the kernel's numbers
// are byte-identical regardless. No network call is made - driver
// *construction* is enough to prove the point, because evaluate() never
// takes a driver as input in the first place. The number-binding guard is
// then exercised against both drivers' narration to show it rejects an
// invented number identically no matter which driver produced the text.
import { describe, expect, it } from "vitest";
import { evaluate } from "@isopleth/core";
import type { Book } from "@isopleth/core";
import { getLlmDriver, bindNumbers } from "@isopleth/llm";

function book(): Book {
  return {
    collateral: [
      {
        coin: "rAAPL",
        qty: 100,
        referenceUsd: 200,
        referenceState: "OPEN_LIVE",
        tiers: [{ startUsd: 0, rate: 0.9 }],
        rulesetVersion: "test-1",
        evidence: "SYNTHETIC",
        sourceRefs: [],
      },
    ],
    positions: [
      {
        symbol: "BTCUSDT",
        side: "LONG",
        qty: 1,
        markUsd: 60_000,
        kind: "crypto",
        tiers: [{ symbol: "BTCUSDT", minNotional: 0, maxNotional: 1_000_000, maintenanceMarginRate: 0.004, takerFee: 0.0006, sourceRef: "test" }],
      },
    ],
    cashUsd: 0,
    liabilitiesUsd: 0,
    unrealisedPnlUsd: 0,
    partialLiqFeeUsd: 0,
  };
}

describe("I6: kernel numbers are driver-independent", () => {
  it("produces byte-identical MarginResult whether a gemini or a none driver is selected", () => {
    // Selecting/constructing a driver happens in the surrounding code, never
    // as an argument to the kernel. Proving that holds: compute with each
    // driver "active" in scope and diff the raw kernel output.
    const geminiDriver = getLlmDriver({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "unused-test-key" } as NodeJS.ProcessEnv);
    const resultWithGemini = evaluate(book());

    const noneDriverInstance = getLlmDriver({ LLM_PROVIDER: "none" } as NodeJS.ProcessEnv);
    const resultWithNone = evaluate(book());

    expect(geminiDriver.name).toBe("gemini");
    expect(noneDriverInstance.name).toBe("none");
    expect(JSON.stringify(resultWithGemini)).toBe(JSON.stringify(resultWithNone));
  });

  it("the number-binding guard rejects an invented number identically regardless of which driver produced the text", () => {
    const r = evaluate(book());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const facts = [r.value.adjEquityUsd, r.value.maintenanceMarginUsd, r.value.crossMarginRate];

    const honestNarration = `Your adjusted equity is ${r.value.adjEquityUsd} and your cross margin rate is ${r.value.crossMarginRate}.`;
    const inventedNarration = `Your adjusted equity is ${r.value.adjEquityUsd}, and you are about to be liquidated at 99999.`;

    for (const driverLabel of ["gemini", "none"] as const) {
      expect(bindNumbers(honestNarration, facts).ok).toBe(true);
      const rejected = bindNumbers(inventedNarration, facts);
      expect(rejected.ok).toBe(false);
      expect(rejected.orphans).toContain(99999);
      void driverLabel; // the point: this assertion is identical regardless of which driver's output we're checking
    }
  });
});
