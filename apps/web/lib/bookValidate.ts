// Fail-closed structural validation (I5) for a user-supplied book, before it
// ever reaches @isopleth/core. A malformed or incomplete book is rejected
// with a specific reason, never coerced into something the kernel would
// silently misread.
import type { Book } from "@isopleth/core";

export type ValidationResult = { ok: true; book: Book } | { ok: false; errors: string[] };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

const REFERENCE_STATES = new Set(["OPEN_LIVE", "MARKET_CLOSED_FROZEN", "REOPENING", "STALE", "UNKNOWN"]);
const EVIDENCE_CLASSES = new Set(["MEASURED", "REPLAYED", "SYNTHETIC", "UNKNOWN"]);

export function validateBook(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null) return { ok: false, errors: ["book must be a JSON object"] };
  const b = input as Record<string, unknown>;

  if (!Array.isArray(b.collateral)) errors.push("collateral must be an array (use [] if none)");
  if (!Array.isArray(b.positions)) errors.push("positions must be an array (use [] if none)");
  for (const k of ["cashUsd", "liabilitiesUsd", "unrealisedPnlUsd", "partialLiqFeeUsd"]) {
    if (!isFiniteNumber(b[k])) errors.push(`${k} must be a finite number`);
  }
  if (errors.length > 0) return { ok: false, errors };

  (b.collateral as unknown[]).forEach((raw, i) => {
    const a = raw as Record<string, unknown>;
    if (typeof a.coin !== "string" || a.coin.length === 0) errors.push(`collateral[${i}].coin must be a non-empty string`);
    if (!isFiniteNumber(a.qty)) errors.push(`collateral[${i}].qty must be a finite number`);
    if (a.referenceUsd !== null && !isFiniteNumber(a.referenceUsd)) errors.push(`collateral[${i}].referenceUsd must be a number or null`);
    if (typeof a.referenceState !== "string" || !REFERENCE_STATES.has(a.referenceState))
      errors.push(`collateral[${i}].referenceState must be one of ${[...REFERENCE_STATES].join("/")}`);
    if (!Array.isArray(a.tiers) || a.tiers.some((t) => !isFiniteNumber((t as Record<string, unknown>)?.startUsd) || !isFiniteNumber((t as Record<string, unknown>)?.rate)))
      errors.push(`collateral[${i}].tiers must be an array of { startUsd, rate }`);
    if (typeof a.rulesetVersion !== "string") errors.push(`collateral[${i}].rulesetVersion must be a string`);
    if (typeof a.evidence !== "string" || !EVIDENCE_CLASSES.has(a.evidence)) errors.push(`collateral[${i}].evidence must be one of ${[...EVIDENCE_CLASSES].join("/")}`);
    if (!Array.isArray(a.sourceRefs)) errors.push(`collateral[${i}].sourceRefs must be an array of strings`);
  });

  (b.positions as unknown[]).forEach((raw, i) => {
    const p = raw as Record<string, unknown>;
    if (typeof p.symbol !== "string" || p.symbol.length === 0) errors.push(`positions[${i}].symbol must be a non-empty string`);
    if (p.side !== "LONG" && p.side !== "SHORT") errors.push(`positions[${i}].side must be LONG or SHORT`);
    if (!isFiniteNumber(p.qty)) errors.push(`positions[${i}].qty must be a finite number`);
    if (!isFiniteNumber(p.markUsd)) errors.push(`positions[${i}].markUsd must be a finite number`);
    if (p.kind !== "crypto" && p.kind !== "stock") errors.push(`positions[${i}].kind must be crypto or stock`);
    if (!Array.isArray(p.tiers) || p.tiers.length === 0) errors.push(`positions[${i}].tiers must be a non-empty array of position tiers`);
    else {
      (p.tiers as unknown[]).forEach((raw2, j) => {
        const t = raw2 as Record<string, unknown>;
        if (typeof t.symbol !== "string") errors.push(`positions[${i}].tiers[${j}].symbol must be a string`);
        if (!isFiniteNumber(t.minNotional)) errors.push(`positions[${i}].tiers[${j}].minNotional must be a finite number`);
        if (!isFiniteNumber(t.maxNotional)) errors.push(`positions[${i}].tiers[${j}].maxNotional must be a finite number`);
        if (!isFiniteNumber(t.maintenanceMarginRate)) errors.push(`positions[${i}].tiers[${j}].maintenanceMarginRate must be a finite number`);
        if (!isFiniteNumber(t.takerFee)) errors.push(`positions[${i}].tiers[${j}].takerFee must be a finite number`);
        if (typeof t.sourceRef !== "string") errors.push(`positions[${i}].tiers[${j}].sourceRef must be a string`);
      });
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, book: b as unknown as Book };
}
