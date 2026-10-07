// A minimal, real multi-step tool-calling loop (Phase E). The gemini/qwen
// drivers only expose a single text-completion call (packages/llm/src/types.ts),
// not native function-calling, so this implements the loop on top of that:
// the model is told which read-only tools exist and must respond with
// EXACTLY `{"tool": "<name>", "args": {...}}` to call one, or
// `{"final": "<text>"}` to answer. Each tool call is executed locally
// against already-computed kernel facts (never a new computation - the
// tools only let the model ask for pieces of data it wasn't initially
// given, they never let it compute anything itself) and the result is fed
// back as the next turn. Bounded by maxSteps so a misbehaving driver can
// never loop forever.
import type { LlmDriver } from "./types";

export interface ToolSpec {
  name: string;
  description: string;
  run: (args: Record<string, unknown>) => unknown;
}

export interface ToolLoopResult {
  finalText: string;
  steps: Array<{ tool: string; args: unknown; result: unknown }>;
  stoppedReason: "final" | "max-steps" | "parse-error";
}

function tryParseStep(text: string): { kind: "tool"; name: string; args: Record<string, unknown> } | { kind: "final"; text: string } | null {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof parsed.final === "string") return { kind: "final", text: parsed.final };
    if (typeof parsed.tool === "string") return { kind: "tool", name: parsed.tool, args: (parsed.args as Record<string, unknown>) ?? {} };
  } catch {
    // fall through - not valid JSON, treat the whole response as the final answer
  }
  return null;
}

export async function runToolLoop(driver: LlmDriver, tools: ToolSpec[], question: string, opts: { maxSteps?: number } = {}): Promise<ToolLoopResult> {
  const maxSteps = opts.maxSteps ?? 4;
  const toolList = tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");
  const system = [
    "You narrate pre-computed margin-risk numbers for a trading product called Isopleth.",
    "You have no numbers yet. You may call a read-only tool to fetch exactly what you need, one at a time:",
    toolList,
    'To call a tool, respond with EXACTLY {"tool": "<name>", "args": {}} and nothing else - no markdown, no extra text.',
    'When you have enough information, respond with EXACTLY {"final": "<2-4 sentence narration, plain language, every number taken from a tool result>"}.',
    "Never invent a number that was not in a tool result.",
  ].join("\n");

  const steps: ToolLoopResult["steps"] = [];
  let prompt = question;

  for (let i = 0; i < maxSteps; i += 1) {
    const res = await driver.complete({ system, prompt, json: true });
    const step = tryParseStep(res.text);

    if (!step) {
      // Not parseable as the tool-call protocol - treat the raw text as the final answer rather than looping forever on a malformed response.
      return { finalText: res.text, steps, stoppedReason: "parse-error" };
    }
    if (step.kind === "final") {
      return { finalText: step.text, steps, stoppedReason: "final" };
    }

    const tool = tools.find((t) => t.name === step.name);
    const result = tool ? tool.run(step.args) : { error: `unknown tool "${step.name}"` };
    steps.push({ tool: step.name, args: step.args, result });
    prompt = `Tool "${step.name}" returned: ${JSON.stringify(result)}. Call another tool, or respond with your final narration.`;
  }

  return { finalText: "", steps, stoppedReason: "max-steps" };
}
