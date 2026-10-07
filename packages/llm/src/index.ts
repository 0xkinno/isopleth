// One interface, three drivers, selected by LLM_PROVIDER. Swapping the
// provider is a one-line env change - no other code change, anywhere.
import { noneDriver } from "./drivers/none";
import { makeGeminiDriver } from "./drivers/gemini";
import { makeQwenDriver } from "./drivers/qwen";
import type { LlmDriver } from "./types";

export * from "./types";
export * from "./bind";
export * from "./toolLoop";

export function getLlmDriver(env: NodeJS.ProcessEnv = process.env): LlmDriver {
  const provider = (env.LLM_PROVIDER ?? "none").toLowerCase();

  if (provider === "gemini") {
    if (!env.GEMINI_API_KEY) {
      console.warn("[llm] LLM_PROVIDER=gemini but GEMINI_API_KEY is empty - falling back to the none driver.");
      return noneDriver;
    }
    return makeGeminiDriver(env.GEMINI_MODEL ? { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL } : { apiKey: env.GEMINI_API_KEY });
  }

  if (provider === "qwen") {
    if (!env.QWEN_API_KEY) {
      console.warn("[llm] LLM_PROVIDER=qwen but QWEN_API_KEY is empty - falling back to the none driver.");
      return noneDriver;
    }
    return makeQwenDriver({
      apiKey: env.QWEN_API_KEY,
      baseUrl: env.QWEN_BASE_URL ?? "https://hackathon.bitgetops.com/v1",
      model: env.QWEN_MODEL ?? "qwen3.8-max",
    });
  }

  return noneDriver;
}
