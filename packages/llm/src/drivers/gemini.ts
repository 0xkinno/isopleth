// Gemini driver: the default LLM_PROVIDER until Qwen credits arrive.
// aistudio.google.com/apikey - free tier, no card. Plain REST, no SDK, so
// swapping providers is genuinely a config change, not a dependency change.
import type { LlmDriver, LlmRequest, LlmResult } from "../types";

const DEFAULT_MODEL = "gemini-3.8-flash";

export function makeGeminiDriver(opts: { apiKey: string; model?: string }): LlmDriver {
  const model = opts.model ?? DEFAULT_MODEL;
  return {
    name: "gemini",
    async complete(req: LlmRequest): Promise<LlmResult> {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${opts.apiKey}`;
      const body: Record<string, unknown> = {
        contents: [{ role: "user", parts: [{ text: req.prompt }] }],
      };
      if (req.system) body.systemInstruction = { role: "system", parts: [{ text: req.system }] };
      if (req.json) body.generationConfig = { responseMimeType: "application/json" };

      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      if (!res.ok) {
        throw new Error(`Gemini request failed: status=${res.status} body=${JSON.stringify(json).slice(0, 500)}`);
      }
      const text: string = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      return { text, provider: "gemini", raw: json };
    },
  };
}
