"use client";

// Ask bar: preset chips, a plain-language question, and a visible tool trace.
// Intent is routed by rules to read-only tools; the sentence is assembled by
// code from the tools' own outputs, so every number shown came from the kernel
// or the recorder. Expand any call to see its raw inputs and outputs.
import { useState } from "react";

interface Step { tool: string; args: Record<string, unknown>; output: unknown; ms: number; error?: string }
interface Reply { ok: true; route: string; answer: string[]; trace: Step[]; receipt: { engineVersion: string; hash: string } | null; thesis: string | null }

const PRESETS = [
  "Where does my book break first?",
  "What if rAAPL reopens down 7%?",
  "What if BTC drops 10%?",
  "What is the smallest move that keeps me safe?",
  "How frozen is the reference clock?",
];

export function AskBar() {
  const [q, setQ] = useState("");
  const [thesis, setThesis] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [verify, setVerify] = useState<string | null>(null);

  async function run(question: string) {
    if (!question.trim()) return;
    setQ(question);
    setBusy(true);
    setErr(null);
    setVerify(null);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, thesis }) });
      const data = (await res.json()) as Reply | { ok: false; error: string };
      if (!data.ok) setErr(data.error);
      else setReply(data);
    } catch (e) {
      setErr(`request failed: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function verifyReceipt() {
    if (!reply?.receipt) return;
    const evalStep = reply.trace.find((s) => s.tool === "isopleth_evaluate_book");
    const out = evalStep?.output as { result?: unknown } | undefined;
    if (!out?.result) return;
    setVerify("recomputing…");
    try {
      const book = await (await fetch("/api/demo-book")).json();
      const res = await fetch("/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "isopleth_verify_receipt", arguments: { input: book, result: out.result, hash: reply.receipt.hash } } }),
      });
      const j = (await res.json()) as { result: { content: Array<{ text: string }> } };
      const v = JSON.parse(j.result.content[0]!.text) as { valid: boolean };
      setVerify(v.valid ? "VALID: recomputed hash matches" : "MISMATCH");
    } catch (e) {
      setVerify(`could not verify: ${String(e)}`);
    }
  }

  return (
    <div className="panel" style={{ padding: 32, marginBottom: 40 }}>
      <h2 style={{ fontSize: 22, marginBottom: 6 }}>Ask the desk</h2>
      <p style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 16 }}>
        Runs on the fixed demo book. Every answer is built from kernel and recorder outputs, and every tool call is shown below it.
      </p>

      <label htmlFor="ask-thesis" style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
        What are you protecting? <span style={{ color: "var(--ink-soft)" }}>(shown above every answer)</span>
      </label>
      <input
        id="ask-thesis"
        value={thesis}
        onChange={(e) => setThesis(e.target.value)}
        placeholder="e.g. my rNVDA collateral through the next NYSE close"
        style={{ width: "100%", padding: "10px 12px", marginBottom: 16, border: "1px solid var(--rule)", borderRadius: 8, background: "var(--paper)", color: "var(--ink)" }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {PRESETS.map((p) => (
          <button key={p} onClick={() => run(p)} disabled={busy} className="mono" style={{ padding: "8px 14px", borderRadius: 999, border: "1px solid var(--ink)", background: "transparent", color: "var(--ink)", fontSize: 12, cursor: "pointer" }}>
            {p}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(q);
        }}
        style={{ display: "flex", gap: 10 }}
      >
        <input
          aria-label="Ask a question"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask about your book, a what-if, the smallest safe move, or the clock"
          style={{ flex: 1, padding: "12px 14px", border: "1px solid var(--rule)", borderRadius: 8, background: "var(--paper)", color: "var(--ink)" }}
        />
        <button type="submit" disabled={busy} className="mono" style={{ padding: "10px 18px", borderRadius: 999, border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--vellum)", fontSize: 13, cursor: "pointer" }}>
          {busy ? "Working…" : "Map the boundary"}
        </button>
      </form>

      {err && <p style={{ color: "var(--breach)", fontSize: 13, marginTop: 14 }}>{err}</p>}

      {reply && (
        <div style={{ marginTop: 22 }}>
          {reply.thesis && (
            <div className="mono" style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 8 }}>
              PROTECTING: {reply.thesis}
            </div>
          )}
          <div className="slab" style={{ padding: 18 }}>
            {reply.answer.map((line, i) => (
              <p key={i} style={{ margin: i === 0 ? 0 : "10px 0 0", fontSize: 15, lineHeight: 1.5 }}>
                {line}
              </p>
            ))}
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 12 }}>
              ROUTE: {reply.route} · NARRATION: TEMPLATE (no model involved) · EVIDENCE: SYNTHETIC book
            </div>
            {reply.receipt && (
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6, wordBreak: "break-all" }}>
                RECEIPT sha256 {reply.receipt.hash.slice(0, 24)}…{" "}
                <button onClick={verifyReceipt} className="mono" style={{ background: "none", border: "none", color: "var(--contour)", cursor: "pointer", textDecoration: "underline", fontSize: 11 }}>
                  verify
                </button>{" "}
                {verify}
              </div>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="mono" style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 8 }}>TOOL TRACE · {reply.trace.length} call(s)</div>
            {reply.trace.map((s, i) => (
              <details key={i} style={{ borderTop: "1px solid var(--rule)", padding: "8px 0" }}>
                <summary className="mono" style={{ fontSize: 13, cursor: "pointer" }}>
                  {i + 1}. {s.tool} · {s.ms} ms {s.error ? "· ERROR" : ""}
                </summary>
                <div className="mono" style={{ fontSize: 11, marginTop: 8 }}>input</div>
                <pre className="mono" style={{ fontSize: 11, background: "var(--vellum)", padding: 10, borderRadius: 8, overflowX: "auto" }}>{JSON.stringify(s.args, null, 2)}</pre>
                <div className="mono" style={{ fontSize: 11, marginTop: 8 }}>output</div>
                <pre className="mono" style={{ fontSize: 11, background: "var(--vellum)", padding: 10, borderRadius: 8, overflowX: "auto", maxHeight: 260 }}>{s.error ?? JSON.stringify(s.output, null, 2)}</pre>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
