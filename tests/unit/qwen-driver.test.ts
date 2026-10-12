import { afterEach, describe, expect, it, vi } from "vitest";
import { makeQwenDriver } from "../../packages/llm/src/drivers/qwen";

function stubFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  let i = 0;
  vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
    calls.push({ url, body: JSON.parse(init.body) as Record<string, unknown> });
    const r = responses[Math.min(i, responses.length - 1)]!;
    i += 1;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const okBody = { choices: [{ message: { content: '{"final":"x"}' } }] };
const drv = () => makeQwenDriver({ apiKey: "k", baseUrl: "https://gw.example/v1/", model: "qwen3.8-max", enableThinking: false });

describe("Qwen driver wire rules", () => {
  it("adds the word json when JSON mode is requested and the prompt never says it (the gateway 400s otherwise)", async () => {
    const calls = stubFetch([{ status: 200, body: okBody }]);
    await drv().complete({ system: "Answer with a tool call.", prompt: "Narrate.", json: true });
    const msgs = calls[0]!.body.messages as Array<{ role: string; content: string }>;
    expect(msgs.some((m) => /json/i.test(m.content))).toBe(true);
    expect(calls[0]!.body.response_format).toEqual({ type: "json_object" });
    expect(calls[0]!.body.enable_thinking).toBe(false);
    expect(calls[0]!.url).toBe("https://gw.example/v1/chat/completions");
  });

  it("does not touch a prompt that already mentions JSON", async () => {
    const calls = stubFetch([{ status: 200, body: okBody }]);
    await drv().complete({ prompt: "Reply with JSON: {}", json: true });
    const msgs = calls[0]!.body.messages as Array<{ content: string }>;
    expect(msgs[0]!.content).toBe("Reply with JSON: {}");
  });

  it("retries once on a 429 and then succeeds", async () => {
    const calls = stubFetch([{ status: 429, body: { error: "slow down" } }, { status: 200, body: okBody }]);
    const r = await drv().complete({ prompt: "hi" });
    expect(r.provider).toBe("qwen");
    expect(calls.length).toBe(2);
  });

  it("does not retry a 400 that retrying cannot fix", async () => {
    const calls = stubFetch([{ status: 400, body: { error: "bad" } }]);
    await expect(drv().complete({ prompt: "hi" })).rejects.toThrow(/status=400/);
    expect(calls.length).toBe(1);
  });
});
