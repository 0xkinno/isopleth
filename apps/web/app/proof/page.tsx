export const revalidate = 300;

import { getSummary, ageLabel } from "../../lib/data";

const STATUS_CHIP: Record<string, string> = {
  PROVEN: "chip-safe",
  PARTIAL: "chip-warn",
  UNKNOWN: "chip-warn",
};

export default async function ProofPage() {
  const summary = await getSummary();

  return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 96 }}>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>Proof</h1>
      <p className="lead" style={{ marginBottom: 32 }}>
        The claims ledger, live. Nothing here is PROVEN until a real artifact in this repo backs
        it — see <code>CLAIMS.json</code> and <code>EVIDENCE_MANIFEST.md</code> for the full trail.
      </p>

      <div style={{ display: "grid", gap: 16, marginBottom: 48 }}>
        {summary.claims.map((c) => (
          <div key={c.id} className="panel" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 500 }}>
                {c.id} — {c.label}
              </div>
              <span className={`chip ${STATUS_CHIP[c.status] ?? "chip-warn"}`}>{c.status}</span>
            </div>
            <p style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: 8 }}>{c.statement}</p>
            {c.note && <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 8, fontStyle: "italic" }}>{c.note}</p>}
          </div>
        ))}
      </div>

      <div className="panel" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Reproduce from a clean clone</h2>
        <pre
          className="mono"
          tabIndex={0}
          aria-label="Reproduction commands"
          style={{ fontSize: 13, overflowX: "auto", background: "var(--vellum)", padding: 16, borderRadius: "var(--radius-slab)" }}
        >
{`pnpm install
pnpm discovery:e2          # instrument scan -> pairs.json
pnpm discovery:e2:rules    # tier ladders
pnpm discovery:e3          # confirm the F8 candle trap
pnpm discovery:e4:windows  # NYSE calendar window set
pnpm discovery:e1          # long-running recorder - leave it going
pnpm discovery:clockmap    # check classification progress anytime
pnpm test                  # kernel + I6 cross-driver determinism test`}
        </pre>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 12 }}>
          Last synced: {summary.generatedAt} · clock snapshot age: {ageLabel(summary.clock.latestSampleUtc)}
        </p>
      </div>
    </div>
  );
}
