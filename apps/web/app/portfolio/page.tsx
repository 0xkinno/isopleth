export const revalidate = 300;

import Image from "next/image";
import { getSummary } from "../../lib/data";
import { logoUrlFor } from "../../lib/logos";

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
              <Th></Th>
              <Th>Stock perp</Th>
              <Th>rToken spot</Th>
              <Th>Underlying</Th>
            </tr>
          </thead>
          <tbody>
            {summary.universe.sample.map((p) => {
              const logo = logoUrlFor(p.underlying);
              return (
                <tr key={p.perp} style={{ borderBottom: "1px solid var(--rule)" }}>
                  <Td>
                    {logo ? (
                      <Image src={logo} alt="" width={24} height={24} style={{ borderRadius: 6, display: "block" }} unoptimized />
                    ) : (
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: "var(--rule)" }} />
                    )}
                  </Td>
                  <Td mono>{p.perp}</Td>
                  <Td mono>{p.spot}</Td>
                  <Td>{p.underlying}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 12 }}>
        Showing a sample of {summary.universe.sample.length} of {summary.universe.pairCount}. Full
        list: <code>data/clock/pairs.json</code>. Logos via Clearbit, keyed by underlying ticker —
        a gray square means no mapping exists yet for that ticker, never a wrong logo.
      </p>

      <div className="panel" style={{ padding: 24, marginTop: 32 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Book builder</h2>
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
          Manual entry, CSV import, and JSON import are built — see the &quot;Your Book&quot; panel
          on <a href="/workbench">/workbench</a>, which also runs the fixed demo book and a
          personalized-thesis prompt.
        </p>
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
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
