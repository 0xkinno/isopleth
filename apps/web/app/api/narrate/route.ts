// LLM narration behind the number-binding guard (I6, FINAL_INSTRUCTION.md
// section 7). The LLM explains a result the kernel already computed; it
// never computes one itself. Any narrated number that isn't already in the
// kernel's own output is rejected and the deterministic template is served
// instead - this is what makes the product run correctly with the LLM
// removed entirely (LLM_PROVIDER=none).
import { NextResponse } from "next/server";
import { getLlmDriver, bindNumbers, runToolLoop, type ToolSpec } from "@isopleth/llm";
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

  // Real multi-step tool loop (packages/llm/src/toolLoop.ts): the model is
  // given no numbers upfront and must call a read-only tool to fetch each
  // one it needs, one at a time, before narrating - never a single-shot
  // "here are all the facts, talk about them" prompt. Every tool only
  // returns data the kernel already computed; none of them let the model
  // compute anything.
  const tools: ToolSpec[] = [
    { name: "get_current_margin", description: "the book's current cross margin rate, adjusted equity, and maintenance margin", run: () => result },
    { name: "get_stressed_margin", description: "the same, after the standard stress scenario", run: () => shockedResult ?? { note: "no stress scenario was computed" } },
    { name: "get_intervention_plan", description: "the minimum-cost plan(s) that restore the margin threshold", run: () => plan ?? { note: "no plan was computed" } },
    { name: "get_user_thesis", description: "what the user said they are protecting, if anything", run: () => ({ thesis: safeThesis || null }) },
  ];

  try {
    const loop = await runToolLoop(driver, tools, "Narrate this trader's current risk position in 2-4 sentences, calling tools to gather what you need first.");
    if (loop.stoppedReason === "max-steps" || loop.finalText.trim().length === 0) {
      return NextResponse.json({ ok: true, text: fallback, provider: driver.name, verified: true, orphans: [], note: `tool loop stopped: ${loop.stoppedReason}`, steps: loop.steps.length });
    }
    const bound = bindNumbers(loop.finalText, facts);
    if (!bound.ok) {
      return NextResponse.json({ ok: true, text: fallback, provider: driver.name, verified: false, orphans: bound.orphans, rejectedText: loop.finalText, steps: loop.steps.length });
    }
    return NextResponse.json({ ok: true, text: loop.finalText, provider: driver.name, verified: true, orphans: [], steps: loop.steps.length });
  } catch (err) {
    return NextResponse.json({ ok: true, text: fallback, provider: driver.name, verified: true, orphans: [], driverError: String(err) });
  }
}
