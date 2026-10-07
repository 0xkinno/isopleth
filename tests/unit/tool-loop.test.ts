import { describe, expect, it } from "vitest";
import { runToolLoop, type ToolSpec } from "@isopleth/llm";
import type { LlmDriver, LlmRequest, LlmResult } from "@isopleth/llm";

function scriptedDriver(responses: string[]): LlmDriver {
  let i = 0;
  return {
    name: "none",
    async complete(_req: LlmRequest): Promise<LlmResult> {
      const text = responses[Math.min(i, responses.length - 1)]!;
      i += 1;
      return { text, provider: "none", raw: null };
    },
  };
}

const tools: ToolSpec[] = [{ name: "get_rate", description: "returns the margin rate", run: () => ({ rate: 42 }) }];

describe("runToolLoop", () => {
  it("calls a tool then returns a final answer bound to the tool's result", async () => {
    const driver = scriptedDriver(['{"tool":"get_rate","args":{}}', '{"final":"Your margin rate is 42%."}']);
    const result = await runToolLoop(driver, tools, "What is my rate?");
    expect(result.stoppedReason).toBe("final");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]!.result).toEqual({ rate: 42 });
    expect(result.finalText).toContain("42");
  });

  it("stops at maxSteps rather than looping forever on a driver that never finalizes", async () => {
    const driver = scriptedDriver(['{"tool":"get_rate","args":{}}']);
    const result = await runToolLoop(driver, tools, "loop forever", { maxSteps: 3 });
    expect(result.stoppedReason).toBe("max-steps");
    expect(result.steps).toHaveLength(3);
  });

  it("treats an unparseable response as the final answer instead of crashing", async () => {
    const driver = scriptedDriver(["not json at all"]);
    const result = await runToolLoop(driver, tools, "x");
    expect(result.stoppedReason).toBe("parse-error");
    expect(result.finalText).toBe("not json at all");
  });

  it("returns an error observation for an unknown tool name rather than throwing", async () => {
    const driver = scriptedDriver(['{"tool":"nonexistent","args":{}}', '{"final":"done"}']);
    const result = await runToolLoop(driver, tools, "x");
    expect(result.steps[0]!.result).toEqual({ error: 'unknown tool "nonexistent"' });
  });
});
