// Pure, deterministic margin kernel. No I/O, no randomness, no clock reads.
// Fails closed (I5): any missing/non-finite/unknown input is a Refusal, never
// a plausible substitute. See FINAL_INSTRUCTION.md section 6.2.
import type { Book, CollateralAsset, MarginResult, Outcome, Position, ReferenceState } from "./types";

export function effectiveCollateral(a: CollateralAsset): Outcome<number> {
  if (a.referenceUsd === null) return { ok: false, reason: "missing reference price", field: a.coin };
  if (!Number.isFinite(a.referenceUsd) || !Number.isFinite(a.qty)) return { ok: false, reason: "non-finite input", field: a.coin };
  if (a.referenceState === "UNKNOWN") return { ok: false, reason: "reference state unknown", field: a.coin };
  if (a.tiers.length === 0) return { ok: false, reason: "no collateral tier data", field: a.coin };

  const value = a.qty * a.referenceUsd;
  const tiers = [...a.tiers].sort((x, y) => x.startUsd - y.startUsd);
  let out = 0;
  for (let i = 0; i < tiers.length; i += 1) {
    const lo = tiers[i]!.startUsd;
    const hi = i + 1 < tiers.length ? tiers[i + 1]!.startUsd : Number.POSITIVE_INFINITY;
    if (value <= lo) break;
    out += (Math.min(value, hi) - lo) * tiers[i]!.rate;
  }
  return { ok: true, value: out };
}

function maintenanceFor(p: Position): Outcome<{ mm: number; tier: string }> {
  const notional = p.qty * p.markUsd;
  const t = p.tiers.find((x) => notional > x.minNotional && notional <= x.maxNotional);
  if (!t) return { ok: false, reason: "no position tier covers notional", field: p.symbol };
  return { ok: true, value: { mm: p.qty * (t.maintenanceMarginRate + t.takerFee) * p.markUsd, tier: `${t.minNotional}-${t.maxNotional}` } };
}

export function evaluate(book: Book): Outcome<MarginResult> {
  let collateral = 0;
  const referenceStates: Record<string, ReferenceState> = {};
  for (const a of book.collateral) {
    const c = effectiveCollateral(a);
    if (!c.ok) return c;
    collateral += c.value;
    referenceStates[a.coin] = a.referenceState;
  }

  const tierSelections: Record<string, string> = {};
  let mmLong = 0;
  let mmShort = 0;
  for (const p of book.positions) {
    const m = maintenanceFor(p);
    if (!m.ok) return m;
    tierSelections[p.symbol] = m.value.tier;
    if (p.side === "LONG") mmLong += m.value.mm;
    else mmShort += m.value.mm;
  }

  const adjEquityUsd = collateral + book.cashUsd + book.unrealisedPnlUsd - book.liabilitiesUsd;
  const maintenanceMarginUsd = Math.max(mmLong, mmShort);
  if (!Number.isFinite(adjEquityUsd)) return { ok: false, reason: "non-finite equity", field: "book" };
  if (adjEquityUsd <= 0) return { ok: false, reason: "non-positive adjusted equity", field: "book" };

  return {
    ok: true,
    value: {
      adjEquityUsd,
      maintenanceMarginUsd,
      crossMarginRate: (maintenanceMarginUsd + book.partialLiqFeeUsd) / adjEquityUsd,
      tierSelections,
      referenceStates,
      rulesetVersions: [...new Set(book.collateral.map((a) => a.rulesetVersion))],
      evidence: book.collateral.some((a) => a.evidence === "SYNTHETIC") ? "SYNTHETIC" : "REPLAYED",
    },
  };
}
