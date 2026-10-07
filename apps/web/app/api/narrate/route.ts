// LLM narration behind the number-binding guard (I6, FINAL_INSTRUCTION.md
// section 7). The LLM explains a result the kernel already computed; it
// never computes one itself. Any narrated number that isn't already in the
// kernel's own output is rejected and the deterministic template is served
// instead - this is what makes the product run correctly with the LLM
// removed entirely (LLM_PROVIDER=none).
import { NextResponse } from "next/server";
import { getLlmDriver, bindNumbers, type LlmRequest } from "@isopleth/llm";
import type { MarginResult } from "@isopleth/core";

function collectFacts(result: MarginResult, shockedResult: MarginResult | null, plan: unknown): number[] {
  const facts: number[] = [result.adjEquityUsd, result.maintenanceMarginUsd, result.crossMarginRate, result.crossMarginRate * 100];
  if (shockedResult) facts.push(shockedResult.adjEquityUsd, shockedResult.maintenanceMarginUsd, shockedResult.crossMarginRate, shockedResult.crossMarginRate * 100);
  if (Array.isArray(plan)) {
    for (const p of plan as Array<{ interventionCostUsd: number; residualCrossMarginRate: number }>) {
      facts.push(p.interventionCostUsd, p.residualCrossMarginRate, p.residualCrossMarginRate * 100);
    }
  }
  return facts;
}

function template(result: MarginResult, shockedResult: MarginResult | null, thesis: string): string {
  const pct = (result.crossMarginRate * 100).toFixed(2);
  const lines = [`Cross margin rate is ${pct}%, backed by $${result.adjEquityUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} of adjusted equity against $${result.maintenanceMarginUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} of maintenance margin.`];
  if (shockedResult) {
    lines.push(`Under the stress scenario, the rate moves to ${(shockedResult.crossMarginRate * 100).toFixed(2)}%.`);
  }
  if (thesis.trim().length > 0) lines.push(`You said you are protecting: "${thesis.trim()}" — the plan below is the smallest move that keeps the book inside the threshold.`);
  return lines.join(" ");
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "request body must be valid JSON" }, { status: 400 });
  }

  const { result, shockedResult, plan, thesis } = (body ?? {}) as {
    result?: MarginResult;
    shockedResult?: MarginResult;
    plan?: unknown;
    thesis?: string;
  };
  if (!result || typeof result.crossMarginRate !== "number") {
    return NextResponse.json({ ok: false, error: "result (a MarginResult) is required" }, { status: 400 });
  }

  const facts = collectFacts(result, shockedResult ?? null, plan ?? null);
  const safeThesis = typeof thesis === "string" ? thesis.slice(0, 280) : "";

  const driver = getLlmDriver();
  const fallback = template(result, shockedResult ?? null, safeThesis);

  if (driver.name === "none") {
    return NextResponse.json({ ok: true, text: fallback, provider: "none", verified: true, orphans: [] });
  }

  const req2: LlmRequest = {
    system:
      "You narrate pre-computed margin-risk numbers for a trading product called Isopleth. " +
      "Every number you state must already appear in the facts you are given - never invent, round differently, or recompute one. " +
      "Two to four sentences, plain language, no markdown.",
    prompt: `Facts (already computed by a deterministic kernel): ${JSON.stringify(facts)}. Cross margin rate: ${(result.crossMarginRate * 100).toFixed(2)}%. ${
      shockedResult ? `Under stress, cross margin rate: ${(shockedResult.crossMarginRate * 100).toFixed(2)}%.` : ""
    } ${safeThesis ? `The user says they are protecting: "${safeThesis}".` : ""} Narrate this for a trader.`,
  };

  try {
    const res = await driver.complete(req2);
    const bound = bindNumbers(res.text, facts);
    if (!bound.ok) {
      return NextResponse.json({ ok: true, text: fallback, provider: driver.name, verified: false, orphans: bound.orphans, rejectedText: res.text });
    }
    return NextResponse.json({ ok: true, text: res.text, provider: driver.name, verified: true, orphans: [] });
  } catch (err) {
    return NextResponse.json({ ok: true, text: fallback, provider: driver.name, verified: true, orphans: [], driverError: String(err) });
  }
}
