export const revalidate = 300;

import { getSummary } from "../../lib/data";

export default async function PortfolioPage() {
  const summary = await getSummary();

  return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 96 }}>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>Portfolio</h1>
      <p className="lead" style={{ marginBottom: 32 }}>
        The rToken universe, discovered live from Bitget&apos;s public API —{" "}
        {summary.universe.pairCount} pairs, no hardcoded symbol list.
      </p>

      <div className="panel" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--rule)" }}>
              <Th>Stock perp</Th>
              <Th>rToken spot</Th>
              <Th>Underlying</Th>
            </tr>
          </thead>
          <tbody>
            {summary.universe.sample.map((p) => (
              <tr key={p.perp} style={{ borderBottom: "1px solid var(--rule)" }}>
                <Td mono>{p.perp}</Td>
                <Td mono>{p.spot}</Td>
                <Td>{p.underlying}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 12 }}>
        Showing a sample of {summary.universe.sample.length} of {summary.universe.pairCount}. Full
        list: <code>data/clock/pairs.json</code>.
      </p>

      <div className="panel" style={{ padding: 24, marginTop: 32 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Book builder</h2>
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
          Manual entry, CSV/JSON import, and a Demo book are planned for this view (Phase D). The
          Workbench currently runs against a fixed demo book — see <a href="/workbench">/workbench</a>.
        </p>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: "left", padding: "12px 20px", fontSize: 13, color: "var(--ink-soft)", fontWeight: 500 }}>
      {children}
    </th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={mono ? "mono" : undefined} style={{ padding: "10px 20px", fontSize: 14 }}>
      {children}
    </td>
  );
}
