// Runs a user-supplied book through the real deterministic kernel
// (@isopleth/core, Phase B) server-side - never re-implemented in the route,
// never computed in the browser, so the hashing in packages/core/src/hash.ts
// (node:crypto) stays server-only.
import { NextResponse } from "next/server";
import { evaluate, applyScenario, minimumIntervention, type Scenario } from "@isopleth/core";
import { validateBook } from "../../../lib/bookValidate";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["request body must be valid JSON"] }, { status: 400 });
  }

  const { book: bookInput, stress } = (body ?? {}) as { book?: unknown; stress?: { referenceShockPct?: number; markShockPct?: number } };
  const validated = validateBook(bookInput);
  if (!validated.ok) return NextResponse.json({ ok: false, errors: validated.errors }, { status: 400 });

  const book = validated.book;
  const result = evaluate(book);

  const referenceShockPct = stress?.referenceShockPct ?? -12;
  const markShockPct = stress?.markShockPct ?? -15;
  const scenario: Scenario = {
    id: "api-evaluate-stress",
    referenceShockPct: Object.fromEntries(book.collateral.map((c) => [c.coin, referenceShockPct])),
    collateralRatioOverride: {},
    markShockPct: Object.fromEntries(book.positions.filter((p) => p.kind === "crypto").map((p) => [p.symbol, markShockPct])),
    asOf: "api-evaluate",
  };
  const shocked = applyScenario(book, scenario);
  const shockedResult = evaluate(shocked);
  const plan = minimumIntervention(shocked, 0.8);

  return NextResponse.json({ ok: true, result, shockedResult, plan, scenario });
}
