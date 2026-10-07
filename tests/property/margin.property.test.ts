import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { effectiveCollateral } from "@isopleth/core";
import type { CollateralAsset } from "@isopleth/core";

const tierArb = fc
  .array(fc.record({ startUsd: fc.integer({ min: 0, max: 1_000_000 }), rate: fc.double({ min: 0, max: 1, noNaN: true }) }), {
    minLength: 1,
    maxLength: 5,
  })
  .map((tiers) => {
    const sorted = [...tiers].sort((a, b) => a.startUsd - b.startUsd);
    sorted[0]!.startUsd = 0; // guarantee a tier starting at 0 so any positive value is covered
    return sorted;
  });

describe("effectiveCollateral (property)", () => {
  it("is monotonic non-decreasing in qty for a fixed reference price and tier ladder", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 10_000, noNaN: true }),
        fc.double({ min: 0.01, max: 1, noNaN: true }),
        tierArb,
        (qtyBase, referenceUsd, tiers) => {
          const asset: CollateralAsset = {
            coin: "TEST",
            qty: qtyBase,
            referenceUsd,
            referenceState: "OPEN_LIVE",
            tiers,
            rulesetVersion: "prop-test",
            evidence: "SYNTHETIC",
            sourceRefs: [],
          };
          const low = effectiveCollateral(asset);
          const high = effectiveCollateral({ ...asset, qty: qtyBase * 1.5 });
          if (!low.ok || !high.ok) return true; // refusal is acceptable, just not a violation of monotonicity
          return high.value >= low.value - 1e-9;
        },
      ),
      { numRuns: 200 },
    );
  });

  it("never returns a negative effective collateral value", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100_000, noNaN: true }), fc.double({ min: 0.01, max: 1, noNaN: true }), tierArb, (qty, referenceUsd, tiers) => {
        const r = effectiveCollateral({
          coin: "TEST",
          qty,
          referenceUsd,
          referenceState: "OPEN_LIVE",
          tiers,
          rulesetVersion: "prop-test",
          evidence: "SYNTHETIC",
          sourceRefs: [],
        });
        return !r.ok || r.value >= -1e-9;
      }),
      { numRuns: 200 },
    );
  });
});
