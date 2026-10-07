// Client for the bitget-signal MCP (public, no key, no account). Confirmed
// live endpoint and tool list: docs/mcp-tools.json. Streamable-HTTP JSON-RPC:
// initialize once per session to get an Mcp-Session-Id, then reuse it on
// every tools/call. Every response is cached to disk with a timestamp so
// replay works offline (FINAL_INSTRUCTION.md section 7).
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const MCP_URL = "https://datahub.noxiaohao.com/mcp";
const CACHE_DIR = "data/mcp-cache/bitget-signal";

interface JsonRpcEnvelope<T = unknown> {
  jsonrpc: "2.0";
  id: number | string;
  result?: T;
  error?: { code: number; message: string };
}

function parseSse(body: string): JsonRpcEnvelope {
  const line = body.split("\n").find((l) => l.startsWith("data:"));
  if (!line) throw new Error(`bitget-signal MCP: no SSE "data:" line in response: ${body.slice(0, 300)}`);
  return JSON.parse(line.slice(5)) as JsonRpcEnvelope;
}

let cachedSessionId: string | null = null;

async function initSession(): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "isopleth", version: "0.1.0" } },
    }),
  });
  const sessionId = res.headers.get("mcp-session-id");
  if (!sessionId) throw new Error("bitget-signal MCP: initialize response carried no Mcp-Session-Id header");
  cachedSessionId = sessionId;
  return sessionId;
}

/** Call a bitget-signal MCP tool. Caches every response to disk (I1 provenance + offline replay). */
export async function callBitgetSignalTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const sessionId = await initSession();
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-session-id": sessionId,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: toolName, arguments: args } }),
  });
  const body = await res.text();
  const envelope = parseSse(body);
  if (envelope.error) throw new Error(`bitget-signal tool ${toolName} failed: ${envelope.error.message}`);

  await mkdir(CACHE_DIR, { recursive: true });
  const key = createHash("sha256").update(JSON.stringify({ toolName, args })).digest("hex").slice(0, 16);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  await writeFile(
    `${CACHE_DIR}/${toolName}.${key}.${ts}.json`,
    JSON.stringify({ toolName, args, capturedAt: ts, result: envelope.result }, null, 2),
  );

  return envelope.result;
}
