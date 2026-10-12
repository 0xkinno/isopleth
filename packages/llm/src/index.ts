// One interface, three drivers. Selection is a config change, never a code change:
//   LLM_PROVIDER=auto (default)  prefer Qwen when QWEN_API_KEY is set, else Gemini when
//                                GEMINI_API_KEY is set, else the deterministic "none" driver.
//   LLM_PROVIDER=qwen|gemini     that provider first, with the other as a fallback when its key exists.
//   LLM_PROVIDER=none            deterministic template only.
// When a preferred provider errors (quota, outage), the next one is tried before the
// caller falls back to the template. `lastProvider` reports which driver actually answered.
import { noneDriver } from "./drivers/none";
import { makeGeminiDriver } from "./drivers/gemini";
import { makeQwenDriver } from "./drivers/qwen";
import type { LlmDriver, LlmProviderName, LlmRequest, LlmResult } from "./types";

export * from "./types";
export * from "./bind";
export * from "./toolLoop";

export function makeFallbackDriver(drivers: readonly LlmDriver[]): LlmDriver {
  if (drivers.length === 0) return noneDriver;
  if (drivers.length === 1) return drivers[0]!;
  const composite: LlmDriver = {
    name: drivers[0]!.name,
    lastProvider: undefined as LlmProviderName | undefined,
    async complete(req: LlmRequest): Promise<LlmResult> {
      let lastErr: unknown;
      for (const d of drivers) {
        try {
          const res = await d.complete(req);
          composite.lastProvider = res.provider;
          return res;
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    },
  };
  return composite;
}

export function getLlmDriver(env: NodeJS.ProcessEnv = process.env): LlmDriver {
  const provider = (env.LLM_PROVIDER ?? "auto").toLowerCase();
  if (provider === "none") return noneDriver;

  const qwen = env.QWEN_API_KEY
    ? makeQwenDriver({
        apiKey: env.QWEN_API_KEY,
        baseUrl: env.QWEN_BASE_URL ?? "https://hackathon.bitgetops.com/v1",
        model: env.QWEN_MODEL ?? "qwen3.8-max",
        enableThinking: env.QWEN_ENABLE_THINKING === undefined ? undefined : env.QWEN_ENABLE_THINKING.toLowerCase() === "true",
      })
    : null;
  const gemini = env.GEMINI_API_KEY
    ? makeGeminiDriver(env.GEMINI_MODEL ? { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL } : { apiKey: env.GEMINI_API_KEY })
    : null;

  if (provider === "qwen" && !qwen) console.warn("[llm] LLM_PROVIDER=qwen but QWEN_API_KEY is empty - using the next available provider.");
  if (provider === "gemini" && !gemini) console.warn("[llm] LLM_PROVIDER=gemini but GEMINI_API_KEY is empty - using the next available provider.");

  const order = provider === "gemini" ? [gemini, qwen] : [qwen, gemini];
  return makeFallbackDriver(order.filter((d): d is LlmDriver => d !== null));
}
