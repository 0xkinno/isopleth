// E6: probe whichever LLM provider is actually configured (LLM_PROVIDER env),
// plus the bitget-signal MCP (always available, no key). Records what each
// provider actually supports - never assumed. Does NOT block on Qwen: if
// LLM_PROVIDER=gemini (the current default) or no key is set at all, this
// still runs and produces an honest result for whatever is configured.
import { mkdir, writeFile } from "node:fs/promises";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { getLlmDriver } from "../../packages/llm/src/index";
import { callBitgetSignalTool } from "../../packages/llm/src/bitget-signal";

const OUT = "docs/sources/e6-llm-probe-result.json";

async function probeDriver() {
  const provider = (process.env.LLM_PROVIDER ?? "none").toLowerCase();
  const driver = getLlmDriver();
  const result: Record<string, unknown> = { configuredProvider: provider, driverSelected: driver.name };

  if (driver.name === "none") {
    result.probed = false;
    result.note = provider === "none" ? "LLM_PROVIDER=none - template narration only, by design." : `LLM_PROVIDER=${provider} but no API key set - fell back to none driver.`;
    return result;
  }

  try {
    const plain = await driver.complete({ prompt: "Reply with exactly the word: ok" });
    result.plainTextWireWorks = true;
    result.plainTextSample = plain.text.slice(0, 200);
  } catch (e) {
    result.plainTextWireWorks = false;
    result.plainTextError = e instanceof Error ? e.message : String(e);
  }

  try {
    const json = await driver.complete({ prompt: 'Reply with exactly this JSON and nothing else: {"ok": true}', json: true });
    result.jsonModeWorks = true;
    result.jsonSample = json.text.slice(0, 200);
  } catch (e) {
    result.jsonModeWorks = false;
    result.jsonModeError = e instanceof Error ? e.message : String(e);
  }

  // Neither driver implements native tool-calling yet (packages/llm/src/types.ts
  // has no tool-calling surface) - record that honestly rather than guessing
  // whether the underlying API supports it.
  result.toolCallingImplementedInDriver = false;
  result.toolCallingNote = "packages/llm/src/types.ts has no tool-calling surface yet; not probed at the wire level either. Add when the product's tool loop (Phase E) needs it.";

  return result;
}

async function probeMcp() {
  try {
    const r = await callBitgetSignalTool("sentiment_index", { action: "current" });
    return { reachable: true, sample: r };
  } catch (e) {
    return { reachable: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const [llm, mcp] = await Promise.all([probeDriver(), probeMcp()]);
  const result = { probedAt: new Date().toISOString(), llm, bitgetSignalMcp: mcp };
  await mkdir("docs/sources", { recursive: true });
  await writeFile(OUT, JSON.stringify(result, null, 2));
  console.log(`[e6] LLM provider probed: ${JSON.stringify(llm, null, 2)}`);
  console.log(`[e6] bitget-signal MCP: ${JSON.stringify(mcp, null, 2).slice(0, 400)}`);
  console.log(`[e6] -> ${OUT}`);
}

main().catch((e) => {
  console.error("[e6] fatal:", e);
  process.exitCode = 1;
});
