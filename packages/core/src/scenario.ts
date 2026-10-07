// Six scenario operators, one engine (FINAL_INSTRUCTION.md section 6.3):
// reference shock, haircut shock, position-tier shock, joint transition,
// reopening, and historical analog (the last is just applyScenario fed with
// a measured window's real shock values instead of hypothetical ones - same
// function, different input source).
import type { Book, CollateralAsset, Position, ReferenceState } from "./types";

export interface Scenario {
  id: string;
  referenceShockPct: Record<string, number>; // keyed by collateral coin, percent move applied to referenceUsd
  collateralRatioOverride: Record<string, number>; // keyed by collateral coin, replaces every tier's rate with this flat rate
  markShockPct: Record<string, number>; // keyed by position symbol, percent move applied to markUsd
  forceReferenceState?: ReferenceState; // applied to every collateral asset, e.g. REOPENING
  asOf: string;
}

function shockedCollateral(a: CollateralAsset, s: Scenario): CollateralAsset {
  const pct = s.referenceShockPct[a.coin];
  const referenceUsd = a.referenceUsd === null || pct === undefined ? a.referenceUsd : a.referenceUsd * (1 + pct / 100);

  const flatRate = s.collateralRatioOverride[a.coin];
  const tiers = flatRate === undefined ? a.tiers : a.tiers.map((t) => ({ ...t, rate: flatRate }));

  const referenceState = s.forceReferenceState ?? a.referenceState;

  return { ...a, referenceUsd, tiers, referenceState };
}

function shockedPosition(p: Position, s: Scenario): { position: Position; pnlDeltaUsd: number } {
  const pct = s.markShockPct[p.symbol];
  if (pct === undefined) return { position: p, pnlDeltaUsd: 0 };
  const markUsd = p.markUsd * (1 + pct / 100);
  // A mark move changes maintenance margin (via notional) AND unrealized PnL
  // (via equity) - the margin kernel's notional-based formula (F4) only
  // captures the first effect on its own. A LONG loses when mark falls, a
  // SHORT loses when mark rises; omitting this made a crashing book look
  // *safer* (lower notional -> lower maintenance margin) instead of riskier,
  // which is backwards. This is what keeps crossMarginRate responsive to
  // the scenario operators in the way the product's whole thesis depends on.
  const priceDelta = markUsd - p.markUsd;
  const pnlDeltaUsd = p.side === "LONG" ? p.qty * priceDelta : -p.qty * priceDelta;
  return { position: { ...p, markUsd }, pnlDeltaUsd };
}

/** Pure: returns a new Book, never mutates the input. */
export function applyScenario(book: Book, s: Scenario): Book {
  const shocked = book.positions.map((p) => shockedPosition(p, s));
  const totalPnlDelta = shocked.reduce((sum, r) => sum + r.pnlDeltaUsd, 0);
  return {
    ...book,
    collateral: book.collateral.map((a) => shockedCollateral(a, s)),
    positions: shocked.map((r) => r.position),
    unrealisedPnlUsd: book.unrealisedPnlUsd + totalPnlDelta,
  };
}

export function noShock(id: string, asOf: string): Scenario {
  return { id, referenceShockPct: {}, collateralRatioOverride: {}, markShockPct: {}, asOf };
}
