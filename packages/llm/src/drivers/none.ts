// The zero-network fallback driver. Deterministic template narration only -
// used whenever LLM_PROVIDER=none, or whenever gemini/qwen fail and the
// product falls back per FINAL_INSTRUCTION.md section 7 ("the product must
// work fully with Qwen removed"). Narration is always labelled
// NARRATION: TEMPLATE by the caller, never passed off as model-generated.
import type { LlmDriver, LlmRequest, LlmResult } from "../types";

export const noneDriver: LlmDriver = {
  name: "none",
  async complete(req: LlmRequest): Promise<LlmResult> {
    const text = req.json
      ? JSON.stringify({ narration: "NARRATION: TEMPLATE", note: "No LLM configured (LLM_PROVIDER=none)." })
      : "NARRATION: TEMPLATE - no LLM configured (LLM_PROVIDER=none). The kernel result is unaffected either way.";
    return { text, provider: "none", raw: null };
  },
};
