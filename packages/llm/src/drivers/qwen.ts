// Qwen driver: OpenAI-compatible wire at the hackathon gateway
// (https://hackathon.bitgetops.com/v1, model qwen3.8-max). Plain chat
// completions, no assumption of native tool calling: the tool loop in
// toolLoop.ts speaks strict JSON on top of this.
import type { LlmDriver, LlmRequest, LlmResult } from "../types";

const TIMEOUT_MS = 30_000;

export function makeQwenDriver(opts: { apiKey: string; baseUrl: string; model: string; enableThinking?: boolean | undefined }): LlmDriver {
  return {
    name: "qwen",
    async complete(req: LlmRequest): Promise<LlmResult> {
      // The gateway rejects response_format=json_object (HTTP 400) unless the word "json"
      // appears somewhere in the messages, so make sure it does whenever JSON is requested.
      const needsJsonWord = req.json === true && !/json/i.test(`${req.system ?? ""}
${req.prompt}`);
      const messages = [
        ...(req.system ? [{ role: "system", content: req.system }] : []),
        { role: "user", content: needsJsonWord ? `${req.prompt}

Respond with valid JSON only.` : req.prompt },
      ];
      const body = JSON.stringify({
        model: opts.model,
        messages,
        ...(req.json ? { response_format: { type: "json_object" } } : {}),
        // Optional: Qwen3 models can spend a long time "thinking"; QWEN_ENABLE_THINKING=false asks the gateway not to.
        ...(opts.enableThinking === undefined ? {} : { enable_thinking: opts.enableThinking }),
      });

      let lastStatus = 0;
      let lastBody: unknown = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
            body,
            signal: controller.signal,
          });
          const json = (await res.json().catch(() => ({}))) as { choices?: Array<{ message?: { content?: string } }> };
          if (res.ok) {
            const text: string = json.choices?.[0]?.message?.content ?? "";
            return { text, provider: "qwen", raw: json };
          }
          lastStatus = res.status;
          lastBody = json;
          // retry once on rate limit or a transient server error; never on a 4xx that retrying cannot fix
          if (res.status !== 429 && res.status < 500) break;
        } catch (e) {
          lastStatus = 0;
          lastBody = e instanceof Error ? e.message : String(e);
        } finally {
          clearTimeout(timer);
        }
        await new Promise((r) => setTimeout(r, 800));
      }
      throw new Error(`Qwen request failed: status=${lastStatus} body=${JSON.stringify(lastBody).slice(0, 500)}`);
    },
  };
}
