// CSV book input (Phase D). A deliberately simplified, single-tier
// approximation of the full Book shape - documented as such, never
// silently passed off as exact. Anyone who needs real tier ladders should
// use the JSON path instead (the Workbench always offers both).
//
// Columns: type,symbol,qty,price,side,rate
//   type=cash         -> qty is cashUsd (other columns ignored)
//   type=liabilities  -> qty is liabilitiesUsd (other columns ignored)
//   type=collateral   -> symbol=coin, qty, price=referenceUsd, rate=flat collateral rate (0-1)
//   type=position      -> symbol, qty, price=markUsd, side=LONG/SHORT, rate=maintenance margin rate (0-1, e.g. 0.01)
import type { Book } from "@isopleth/core";

export interface CsvParseResult {
  ok: true;
  book: Book;
  warnings: string[];
}
export interface CsvParseError {
  ok: false;
  errors: string[];
}

function parseCsvLines(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .map((l) => l.split(",").map((c) => c.trim()));
}

export function parseCsvBook(text: string): CsvParseResult | CsvParseError {
  const lines = parseCsvLines(text);
  if (lines.length === 0) return { ok: false, errors: ["CSV is empty"] };

  const header = lines[0]!.map((h) => h.toLowerCase());
  const required = ["type", "symbol", "qty", "price", "side", "rate"];
  if (required.some((c) => !header.includes(c))) {
    return { ok: false, errors: [`CSV header must contain columns: ${required.join(",")} (got: ${header.join(",")})`] };
  }
  const idx = (col: string) => header.indexOf(col);

  const errors: string[] = [];
  const warnings: string[] = [
    "CSV uses a single flat tier per collateral asset / position (no tier ladder) - this is a simplified approximation. For the real discovered tier ladders, use the JSON book input instead.",
  ];

  let cashUsd = 0;
  let liabilitiesUsd = 0;
  const collateral: Book["collateral"] = [];
  const positions: Book["positions"] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const row = lines[i]!;
    const type = row[idx("type")]?.toLowerCase();
    const num = (col: string): number => Number(row[idx(col)]);

    if (type === "cash") {
      const v = num("qty");
      if (!Number.isFinite(v)) { errors.push(`row ${i + 1}: cash qty must be a number`); continue; }
      cashUsd += v;
    } else if (type === "liabilities") {
      const v = num("qty");
      if (!Number.isFinite(v)) { errors.push(`row ${i + 1}: liabilities qty must be a number`); continue; }
      liabilitiesUsd += v;
    } else if (type === "collateral") {
      const symbol = row[idx("symbol")];
      const qty = num("qty");
      const price = num("price");
      const rate = idx("rate") >= 0 && row[idx("rate")] ? num("rate") : 0.9;
      if (!symbol) { errors.push(`row ${i + 1}: collateral needs a symbol`); continue; }
      if (!Number.isFinite(qty) || !Number.isFinite(price) || !Number.isFinite(rate)) { errors.push(`row ${i + 1}: collateral qty/price/rate must be numbers`); continue; }
      collateral.push({ coin: symbol, qty, referenceUsd: price, referenceState: "OPEN_LIVE", tiers: [{ startUsd: 0, rate }], rulesetVersion: "csv-import", evidence: "SYNTHETIC", sourceRefs: ["csv-upload"] });
    } else if (type === "position") {
      const symbol = row[idx("symbol")];
      const qty = num("qty");
      const price = num("price");
      const side = (row[idx("side")] ?? "LONG").toUpperCase();
      const rate = idx("rate") >= 0 && row[idx("rate")] ? num("rate") : 0.01;
      if (!symbol) { errors.push(`row ${i + 1}: position needs a symbol`); continue; }
      if (!Number.isFinite(qty) || !Number.isFinite(price) || !Number.isFinite(rate)) { errors.push(`row ${i + 1}: position qty/price/rate must be numbers`); continue; }
      if (side !== "LONG" && side !== "SHORT") { errors.push(`row ${i + 1}: side must be LONG or SHORT`); continue; }
      positions.push({ symbol, side, qty, markUsd: price, kind: symbol.toUpperCase().startsWith("R") ? "stock" : "crypto", tiers: [{ symbol, minNotional: 0, maxNotional: Number.POSITIVE_INFINITY, maintenanceMarginRate: rate, takerFee: 0.0006, sourceRef: "csv-upload" }] });
    } else {
      errors.push(`row ${i + 1}: unknown type "${row[idx("type")]}" (expected cash/liabilities/collateral/position)`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    book: { collateral, positions, cashUsd, liabilitiesUsd, unrealisedPnlUsd: 0, partialLiqFeeUsd: 0 },
    warnings,
  };
}

export const CSV_TEMPLATE = `type,symbol,qty,price,side,rate
cash,CASH,3000,,,
collateral,rAAPL,40,230,,0.9
position,BTCUSDT,1.1,62000,LONG,0.01
position,ETHUSDT,10,3200,LONG,0.01
`;
