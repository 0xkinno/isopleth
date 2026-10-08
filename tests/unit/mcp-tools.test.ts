import { describe, expect, it } from "vitest";
import { TOOLS, listTools } from "../../apps/web/lib/mcpTools";
import { demoBook } from "../../apps/web/lib/demoBook";
import { ask } from "../../apps/web/lib/ask";

const tool = (name: string) => TOOLS.find((t) => t.name === name)!;

describe("MCP tool surface", () => {
  it("is read-only: no tool name suggests an order, transfer or write", () => {
    const names = listTools().map((t) => t.name).join(" ");
    expect(names).not.toMatch(/order|trade|withdraw|transfer|place|write|delete/i);
    expect(listTools().length).toBeGreaterThanOrEqual(6);
  });

  it("evaluates the demo book and returns a receipt that verifies, and stops verifying when the result is edited", async () => {
    const book = demoBook();
    const out = (await tool("isopleth_evaluate_book").run({ book })) as { result: { ok: boolean; value: { adjEquityUsd: number } }; receipt: { hash: string } };
    expect(out.result.ok).toBe(true);
    const good = (await tool("isopleth_verify_receipt").run({ input: book, result: out.result, hash: out.receipt.hash })) as { valid: boolean };
    expect(good.valid).toBe(true);
    const edited = { ...out.result, value: { ...out.result.value, adjEquityUsd: out.result.value.adjEquityUsd + 1 } };
    const bad = (await tool("isopleth_verify_receipt").run({ input: book, result: edited, hash: out.receipt.hash })) as { valid: boolean };
    expect(bad.valid).toBe(false);
  });

  it("refuses an invalid book instead of guessing", async () => {
    await expect(tool("isopleth_evaluate_book").run({ book: { nonsense: true } })).rejects.toThrow(/invalid book/);
  });

  it("locates a contour point by bisection that re-evaluates within tolerance", async () => {
    const out = (await tool("isopleth_locate_contour").run({ book: demoBook(), steps: 6 })) as { points: Array<{ y: number | null }>; allLocatedPointsReEvaluatedWithinTolerance: boolean };
    expect(out.points.some((p) => p.y !== null)).toBe(true);
    expect(out.allLocatedPointsReEvaluatedWithinTolerance).toBe(true);
  });
});

describe("Ask bar router", () => {
  it("answers a what-if with numbers that all come from the kernel trace", async () => {
    const r = await ask("What if BTC drops 10%?", null, "my rNVDA collateral");
    expect(r.route).toBe("what-if");
    expect(r.thesis).toBe("my rNVDA collateral");
    expect(r.trace.map((s) => s.tool)).toEqual(["isopleth_evaluate_book"]);
    expect(r.answer.join(" ")).toMatch(/If crypto -10%/);
    expect(r.receipt?.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("routes a boundary question through the contour tool and the plan question through the optimizer", async () => {
    const b = await ask("Where does my book break first?", null, "");
    expect(b.trace.map((s) => s.tool)).toContain("isopleth_locate_contour");
    const p = await ask("What is the smallest move that keeps me safe?", null, "");
    expect(p.trace.map((s) => s.tool)).toContain("isopleth_minimum_intervention");
    expect(p.answer.join(" ")).toMatch(/ADD_CASH/);
  });
});
