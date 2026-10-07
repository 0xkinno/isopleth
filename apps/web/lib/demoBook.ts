// A single, fixed, clearly-labelled demo book used for the landing page's
// interactive contour moment and the workbench default. SYNTHETIC evidence
// class throughout - never presented as a real user's holdings.
import type { Book } from "@isopleth/core";

export function demoBook(): Book {
  return {
    collateral: [
      {
        coin: "rAAPL",
        qty: 40,
        referenceUsd: 230,
        referenceState: "OPEN_LIVE",
        tiers: [{ startUsd: 0, rate: 0.9 }],
        rulesetVersion: "demo-1",
        evidence: "SYNTHETIC",
        sourceRefs: [],
      },
    ],
    positions: [
      {
        symbol: "BTCUSDT",
        side: "LONG",
        qty: 1.1,
        markUsd: 62_000,
        kind: "crypto",
        tiers: [{ symbol: "BTCUSDT", minNotional: 0, maxNotional: 500_000, maintenanceMarginRate: 0.01, takerFee: 0.0006, sourceRef: "demo" }],
      },
      {
        symbol: "ETHUSDT",
        side: "LONG",
        qty: 10,
        markUsd: 3_200,
        kind: "crypto",
        tiers: [{ symbol: "ETHUSDT", minNotional: 0, maxNotional: 500_000, maintenanceMarginRate: 0.01, takerFee: 0.0006, sourceRef: "demo" }],
      },
    ],
    // Deliberately leveraged (~9x notional/equity) so the 80% threshold
    // actually falls inside a live, reachable region - an over-collateralized
    // book never crosses it at all, which would make the signature visual
    // show nothing but a flat safe plane. Still SYNTHETIC, still fixed.
    cashUsd: 3_000,
    liabilitiesUsd: 0,
    unrealisedPnlUsd: 0,
    partialLiqFeeUsd: 0,
  };
}
