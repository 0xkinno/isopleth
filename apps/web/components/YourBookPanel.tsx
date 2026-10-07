"use client";

// Phase D: book input (manual JSON / file upload) + personalized thesis +
// AI narration behind the number-binding guard + export. Recompute happens
// server-side at /api/evaluate so the kernel's hashing (node:crypto) never
// has to be bundled for the browser - this component only renders what
// comes back.
import { useRef, useState } from "react";
import type { MarginResult } from "@isopleth/core";
import { demoBookJson } from "../lib/demoBook";
import { parseCsvBook, CSV_TEMPLATE } from "../lib/csvBook";

type Plan = { actions: Array<{ kind: string; target?: string; amountUsd: number }>; interventionCostUsd: number; residualCrossMarginRate: number };
type EvalResponse =
  | { ok: true; result: { ok: true; value: MarginResult } | { ok: false; reason: string; field: string }; shockedResult: { ok: true; value: MarginResult } | { ok: false; reason: string; field: string }; plan: { ok: true; value: Plan[] } | { ok: false; reason: string } }
  | { ok: false; errors: string[] };

type NarrateResponse = { ok: true; text: string; provider: string; verified: boolean; orphans: number[] } | { ok: false; error: string };

export function YourBookPanel() {
  const [bookText, setBookText] = useState(demoBookJson());
  const [thesis, setThesis] = useState("");
  const [response, setResponse] = useState<EvalResponse | null>(null);
  const [narration, setNarration] = useState<NarrateResponse | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function recompute() {
    setBusy(true);
    setErrors([]);
    setNarration(null);
    let book: unknown;
    try {
      book = JSON.parse(bookText);
    } catch (e) {
      setErrors([`book is not valid JSON: ${String(e)}`]);
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/evaluate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ book }) });
      const data = (await res.json()) as EvalResponse;
      if (!data.ok) setErrors(data.errors);
      setResponse(data);
    } catch (e) {
      setErrors([`request failed: ${String(e)}`]);
    } finally {
      setBusy(false);
    }
  }

  async function explainWithAi() {
    if (!response || !response.ok || !response.result.ok) return;
    setNarrating(true);
    try {
      const res = await fetch("/api/narrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          result: response.result.value,
          shockedResult: response.shockedResult.ok ? response.shockedResult.value : null,
          plan: response.plan.ok ? response.plan.value : null,
          thesis,
        }),
      });
      setNarration((await res.json()) as NarrateResponse);
    } catch (e) {
      setNarration({ ok: false, error: String(e) });
    } finally {
      setNarrating(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      if (!isCsv) {
        setBookText(text);
        return;
      }
      const parsed = parseCsvBook(text);
      if (!parsed.ok) {
        setErrors(parsed.errors);
        return;
      }
      setErrors(parsed.warnings);
      setBookText(JSON.stringify(parsed.book, null, 2));
    };
    reader.readAsText(file);
  }

  function downloadCsvTemplate() {
    download("isopleth-book-template.csv", CSV_TEMPLATE, "text/csv");
  }

  function exportRiskPlan() {
    if (!response || !response.ok) return;
    const lines = ["ISOPLETH RISK PLAN (generated, SYNTHETIC/MEASURED per evidence field - see /proof)", `Generated: ${new Date().toISOString()}`, ""];
    if (thesis.trim()) lines.push(`What you said you are protecting: ${thesis.trim()}`, "");
    if (response.result.ok) {
      lines.push(`Current cross margin rate: ${(response.result.value.crossMarginRate * 100).toFixed(2)}%`);
      lines.push(`Adjusted equity: $${response.result.value.adjEquityUsd.toLocaleString()}`);
      lines.push(`Maintenance margin: $${response.result.value.maintenanceMarginUsd.toLocaleString()}`, "");
    }
    if (response.plan.ok) {
      lines.push("Minimum-intervention plan:");
      for (const p of response.plan.value) {
        lines.push(`  - cost $${p.interventionCostUsd.toLocaleString()} -> residual cross margin rate ${(p.residualCrossMarginRate * 100).toFixed(2)}%`);
        lines.push(`    ${p.actions.map((a) => `${a.kind}${a.target ? ` (${a.target})` : ""} $${a.amountUsd.toLocaleString()}`).join(" + ")}`);
      }
    } else {
      lines.push(`Minimum-intervention plan: ${response.plan.reason}`);
    }
    download("isopleth-risk-plan.txt", lines.join("\n"), "text/plain");
  }

  function exportIcs() {
    const now = new Date();
    const next = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Isopleth//Risk Plan//EN",
      "BEGIN:VEVENT",
      `UID:isopleth-${now.getTime()}@isopleth`,
      `DTSTAMP:${fmt(now)}`,
      `DTSTART:${fmt(next)}`,
      "SUMMARY:Isopleth: recheck your margin surface",
      `DESCRIPTION:${thesis.trim() ? `Protecting: ${thesis.trim()}. ` : ""}Recheck the contour before the next reference-price transition.`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    download("isopleth-recheck.ics", ics, "text/calendar");
  }

  function download(name: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="panel" style={{ padding: 32, marginBottom: 40 }}>
      <h2 style={{ fontSize: 22, marginBottom: 8 }}>Your book</h2>
      <p style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 16 }}>
        Paste JSON (same shape as <code>@isopleth/core</code>&apos;s <code>Book</code> type), or upload a <code>.json</code> or <code>.csv</code> file — CSV uses a
        simplified single-tier format (download the template below). It never leaves this server — the kernel runs the same deterministic code path as the
        demo above. Malformed input is refused, never guessed at.
      </p>

      <label style={{ display: "block", fontSize: 13, marginBottom: 6 }} htmlFor="thesis-input">
        What are you protecting? <span style={{ color: "var(--ink-soft)" }}>(personalized thesis, optional)</span>
      </label>
      <input
        id="thesis-input"
        type="text"
        value={thesis}
        onChange={(e) => setThesis(e.target.value)}
        placeholder="e.g. my rNVDA collateral through the next NYSE close"
        style={{ width: "100%", padding: "10px 12px", marginBottom: 16, border: "1px solid var(--rule)", borderRadius: 8, background: "var(--paper)", color: "var(--ink)" }}
      />

      <textarea
        aria-label="Book JSON"
        value={bookText}
        onChange={(e) => setBookText(e.target.value)}
        rows={10}
        className="mono"
        style={{ width: "100%", padding: 12, border: "1px solid var(--rule)", borderRadius: 8, background: "var(--paper)", color: "var(--ink)", fontSize: 13 }}
      />

      <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={recompute} disabled={busy} className="mono" style={buttonStyle}>
          {busy ? "Computing…" : "Recompute"}
        </button>
        <button onClick={() => setBookText(demoBookJson())} className="mono" style={buttonStyle}>
          Load demo book
        </button>
        <button onClick={() => fileInput.current?.click()} className="mono" style={buttonStyle}>
          Upload .json / .csv
        </button>
        <button onClick={downloadCsvTemplate} className="mono" style={buttonStyle}>
          Download CSV template
        </button>
        <input ref={fileInput} type="file" accept=".json,application/json,.csv,text/csv" onChange={onFile} style={{ display: "none" }} />
      </div>

      {errors.length > 0 && (
        <ul style={{ color: "var(--breach)", fontSize: 13, marginTop: 16 }}>
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {response && response.ok && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div className="slab" style={{ padding: 16 }}>
              <div style={{ fontSize: 13 }}>Current</div>
              {response.result.ok ? (
                <div className="mono" style={{ fontSize: 22 }}>
                  {(response.result.value.crossMarginRate * 100).toFixed(2)}%
                </div>
              ) : (
                <div style={{ color: "var(--breach)", fontSize: 13 }}>REFUSED: {response.result.reason}</div>
              )}
            </div>
            <div className="slab" style={{ padding: 16 }}>
              <div style={{ fontSize: 13 }}>Stressed (-15% crypto, -12% reference)</div>
              {response.shockedResult.ok ? (
                <div className="mono" style={{ fontSize: 22 }}>
                  {(response.shockedResult.value.crossMarginRate * 100).toFixed(2)}%
                </div>
              ) : (
                <div style={{ color: "var(--breach)", fontSize: 13 }}>REFUSED: {response.shockedResult.reason}</div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button onClick={explainWithAi} disabled={narrating} className="mono" style={buttonStyle}>
              {narrating ? "Asking…" : "Explain with AI"}
            </button>
            <button onClick={exportRiskPlan} className="mono" style={{ ...buttonStyle, marginLeft: 12 }}>
              Export risk plan (.txt)
            </button>
            <button onClick={exportIcs} className="mono" style={{ ...buttonStyle, marginLeft: 12 }}>
              Export recheck reminder (.ics)
            </button>
          </div>

          {narration && (
            <div className="slab" style={{ padding: 16, marginTop: 16 }}>
              {narration.ok ? (
                <>
                  <p style={{ margin: 0 }}>{narration.text}</p>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 8 }}>
                    provider: {narration.provider} · {narration.verified ? "every number bound to a kernel fact (I6)" : "narration rejected by the number-binding guard — template served instead"}
                  </div>
                </>
              ) : (
                <div style={{ color: "var(--breach)" }}>{narration.error}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid var(--ink)",
  background: "var(--ink)",
  color: "var(--vellum)",
  fontSize: 13,
  cursor: "pointer",
};
