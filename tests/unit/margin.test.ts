import { describe, expect, it } from "vitest";
import { evaluate, effectiveCollateral } from "@isopleth/core";
import type { Book, CollateralAsset } from "@isopleth/core";

function book(overrides: Partial<Book> = {}): Book {
  const collateral: CollateralAsset[] = [
    {
      coin: "rAAPL",
      qty: 100,
      referenceUsd: 200,
      referenceState: "OPEN_LIVE",
      tiers: [
        { startUsd: 0, rate: 0.95 },
        { startUsd: 10_000, rate: 0.9 },
      ],
      rulesetVersion: "test-1",
      evidence: "SYNTHETIC",
      sourceRefs: [],
    },
  ];
  return {
    collateral,
    positions: [
      { symbol: "BTCUSDT", side: "LONG", qty: 1, markUsd: 60_000, kind: "crypto", tiers: [{ symbol: "BTCUSDT", minNotional: 0, maxNotional: 1_000_000, maintenanceMarginRate: 0.004, takerFee: 0.0006, sourceRef: "test" }] },
    ],
    cashUsd: 0,
    liabilitiesUsd: 0,
    unrealisedPnlUsd: 0,
    partialLiqFeeUsd: 0,
    ...overrides,
  };
}

describe("effectiveCollateral", () => {
  it("refuses on missing reference price (I5)", () => {
    const a = book().collateral[0]!;
    const r = effectiveCollateral({ ...a, referenceUsd: null });
    expect(r.ok).toBe(false);
  });

  it("applies tiers correctly across the boundary", () => {
    // value = 100 * 200 = 20,000: first 10,000 at 0.95, remaining 10,000 at 0.9
    const r = effectiveCollateral(book().collateral[0]!);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(10_000 * 0.95 + 10_000 * 0.9, 6);
  });

  it("is monotonic in qty", () => {
    const low = effectiveCollateral({ ...book().collateral[0]!, qty: 10 });
    const high = effectiveCollateral({ ...book().collateral[0]!, qty: 20 });
    expect(low.ok && high.ok && high.value > low.value).toBe(true);
  });
});

describe("evaluate", () => {
  it("computes a sane cross margin rate for a healthy book", () => {
    const r = evaluate(book());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.adjEquityUsd).toBeGreaterThan(0);
      expect(r.value.crossMarginRate).toBeGreaterThan(0);
    }
  });

  it("refuses on non-positive adjusted equity (I5)", () => {
    const r = evaluate(book({ liabilitiesUsd: 1_000_000 }));
    expect(r.ok).toBe(false);
  });

  it("refuses when a position has no covering tier", () => {
    const b = book();
    b.positions[0]!.tiers = [];
    const r = evaluate(b);
    expect(r.ok).toBe(false);
  });

  it("I4: identical inputs produce identical output", () => {
    const r1 = evaluate(book());
    const r2 = evaluate(book());
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("I9: a strictly worsening mark shock never improves crossMarginRate", () => {
    const base = evaluate(book());
    const worse = evaluate(book({ positions: book().positions.map((p) => ({ ...p, markUsd: p.markUsd * 1.5 })) }));
    expect(base.ok && worse.ok).toBe(true);
    if (base.ok && worse.ok) expect(worse.value.crossMarginRate).toBeGreaterThanOrEqual(base.value.crossMarginRate);
  });
});
