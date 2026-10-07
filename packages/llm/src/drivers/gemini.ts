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

      // 429/503 from Google are transient ("high demand"); retry briefly instead of failing the whole narration.
      let res: Response | undefined;
      let json: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } = {};
      for (let attempt = 0; attempt < 4; attempt += 1) {
        res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        json = (await res.json()) as typeof json;
        if (res.ok || (res.status !== 503 && res.status !== 429)) break;
        await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
      }
      if (!res || !res.ok) {
        throw new Error(`Gemini request failed: status=${res?.status} body=${JSON.stringify(json).slice(0, 500)}`);
      }
      const text: string = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      return { text, provider: "gemini", raw: json };
    },
  };
}
