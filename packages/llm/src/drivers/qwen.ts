// Qwen driver: OpenAI-compatible wire at the hackathon's bitgetops.com proxy.
// Not assumed to support native tool calling or JSON mode until E6 confirms
// it - see docs/mcp-tools.json / DISCOVERY.md for what was actually proven.
import type { LlmDriver, LlmRequest, LlmResult } from "../types";

export function makeQwenDriver(opts: { apiKey: string; baseUrl: string; model: string }): LlmDriver {
  return {
    name: "qwen",
    async complete(req: LlmRequest): Promise<LlmResult> {
      const messages = [
        ...(req.system ? [{ role: "system", content: req.system }] : []),
        { role: "user", content: req.prompt },
      ];
      const res = await fetch(`${opts.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          messages,
          ...(req.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      if (!res.ok) {
        throw new Error(`Qwen request failed: status=${res.status} body=${JSON.stringify(json).slice(0, 500)}`);
      }
      const text: string = json.choices?.[0]?.message?.content ?? "";
      return { text, provider: "qwen", raw: json };
    },
  };
}
