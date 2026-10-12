import { describe, expect, it } from "vitest";
import { getLlmDriver, makeFallbackDriver, type LlmDriver } from "@isopleth/llm";

const ok = (name: "qwen" | "gemini", text: string): LlmDriver => ({ name, async complete() { return { text, provider: name, raw: null }; } });
const bad = (name: "qwen" | "gemini"): LlmDriver => ({ name, async complete() { throw new Error(`${name} down`); } });

describe("provider selection", () => {
  it("auto prefers Qwen when its key is present, else Gemini, else none", () => {
    expect(getLlmDriver({ QWEN_API_KEY: "k", GEMINI_API_KEY: "g" } as NodeJS.ProcessEnv).name).toBe("qwen");
    expect(getLlmDriver({ GEMINI_API_KEY: "g" } as NodeJS.ProcessEnv).name).toBe("gemini");
    expect(getLlmDriver({} as NodeJS.ProcessEnv).name).toBe("none");
  });

  it("an explicit none is honoured even when keys exist", () => {
    expect(getLlmDriver({ LLM_PROVIDER: "none", QWEN_API_KEY: "k", GEMINI_API_KEY: "g" } as NodeJS.ProcessEnv).name).toBe("none");
  });

  it("an explicit provider without its key falls through to the one that has a key", () => {
    expect(getLlmDriver({ LLM_PROVIDER: "qwen", GEMINI_API_KEY: "g" } as NodeJS.ProcessEnv).name).toBe("gemini");
    expect(getLlmDriver({ LLM_PROVIDER: "gemini", QWEN_API_KEY: "k" } as NodeJS.ProcessEnv).name).toBe("qwen");
  });
});

describe("fallback chain", () => {
  it("uses the first driver that answers and reports which one it was", async () => {
    const d = makeFallbackDriver([bad("qwen"), ok("gemini", "from gemini")]);
    const r = await d.complete({ prompt: "x" });
    expect(r.text).toBe("from gemini");
    expect(d.lastProvider).toBe("gemini");
  });

  it("throws only when every provider failed, so the caller can serve the verified template", async () => {
    const d = makeFallbackDriver([bad("qwen"), bad("gemini")]);
    await expect(d.complete({ prompt: "x" })).rejects.toThrow(/gemini down/);
  });
});
