// Isopleth as an MCP server (Streamable HTTP, JSON-RPC 2.0). Read-only: every
// tool is a typed view over the deterministic kernel or stored measurements.
// Add it next to Bitget's own server:
//   claude mcp add isopleth --transport http https://isopleth-blue.vercel.app/mcp
import { NextResponse } from "next/server";
import { TOOLS, listTools } from "../../lib/mcpTools";

const SERVER = { name: "isopleth", version: "0.1.0" };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, mcp-session-id, mcp-protocol-version", "access-control-allow-methods": "POST, GET, OPTIONS" };

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const fail = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handle(msg: Rpc) {
  const { id, method, params } = msg;
  switch (method) {
    case "initialize":
      return ok(id, { protocolVersion: typeof params?.protocolVersion === "string" ? params.protocolVersion : "2025-03-26", capabilities: { tools: { listChanged: false } }, serverInfo: SERVER, instructions: "Read-only margin-safety tools. Every kernel answer carries a receipt; verify it with isopleth_verify_receipt." });
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: listTools() });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return fail(id, -32602, `unknown tool "${String(params?.name)}"; this server is read-only and exposes only: ${TOOLS.map((t) => t.name).join(", ")}`);
      try {
        const out = await tool.run((params?.arguments as Record<string, unknown>) ?? {});
        return ok(id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] });
      } catch (e) {
        return ok(id, { isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] });
      }
    }
    default:
      return fail(id, -32601, `method not found: ${String(method)}`);
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(fail(null, -32700, "parse error: body must be JSON"), { status: 400, headers: CORS });
  }
  const batch = Array.isArray(body) ? (body as Rpc[]) : [body as Rpc];
  const replies: unknown[] = [];
  for (const m of batch) {
    if (m.id === undefined) continue; // a notification gets no reply
    replies.push(await handle(m));
  }
  if (replies.length === 0) return new NextResponse(null, { status: 202, headers: CORS });
  return NextResponse.json(Array.isArray(body) ? replies : replies[0], { headers: CORS });
}

export async function GET() {
  return NextResponse.json({ ...SERVER, transport: "streamable-http (POST JSON-RPC)", tools: listTools().map((t) => t.name) }, { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
