import { describe, expect, it } from "vitest";
import { locateContour, verifyContourPoint } from "@isopleth/core";
import type { Book, Scenario } from "@isopleth/core";

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

const axis = (x: number, y: number): Scenario => ({
  id: `x${x}-y${y}`,
  referenceShockPct: { rAAPL: x },
  collateralRatioOverride: {},
  markShockPct: { BTCUSDT: y },
  asOf: "test",
});

describe("locateContour", () => {
  it("I10: every located point is within tolerance of the threshold when re-evaluated", () => {
    const b = book();
    const threshold = 0.05;
    const xs = [-50, -30, -10, 0, 10];
    const points = locateContour(b, axis, threshold, xs, [0, 400], 1e-5);
    for (const p of points) {
      expect(verifyContourPoint(b, axis, threshold, p, 1e-2)).toBe(true);
    }
  });

  it("returns a gap (y: null) for a row with no sign change", () => {
    const b = book();
    // an absurdly high threshold that nothing in this range can reach
    const points = locateContour(b, axis, 1000, [0], [0, 10], 1e-5);
    expect(points[0]!.y).toBeNull();
  });
});
