export const revalidate = 300;

import Image from "next/image";
import Link from "next/link";
import { getSummary, ageLabel } from "../lib/data";
import { buildContourFrames, X_RANGE, Y_RANGE } from "../lib/contourDemo";
import { ContourChart } from "../components/ContourChart";

export default async function LandingPage() {
  const summary = await getSummary();
  const frames = buildContourFrames();
  const confirmed = summary.clock.confirmedFreezeThaw;

  return (
    <>
      <section className="container" style={{ paddingTop: 56, paddingBottom: 40, overflowX: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 32 }}>
          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                right: "-24px",
                zIndex: 0,
                overflow: "hidden",
                borderRadius: "var(--radius-panel)",
                maskImage: "linear-gradient(90deg, transparent 0%, transparent 38%, black 62%)",
                WebkitMaskImage: "linear-gradient(90deg, transparent 0%, transparent 38%, black 62%)",
              }}
            >
              <Image
                src="/img/IMG_1_Hero.jpeg"
                alt="Topographic relief, the project's contour motif"
                fill
                priority
                style={{ objectFit: "cover" }}
                sizes="100vw"
              />
            </div>
            <div style={{ position: "relative", zIndex: 1, maxWidth: 640 }}>
              <h1 style={{ fontSize: "clamp(2.6rem, 6vw, 5rem)", lineHeight: 0.98 }}>
                Your margin ratio
                <br />
                is a snapshot.
                <br />
                The boundary moves.
              </h1>
              <p className="lead" style={{ marginTop: 24 }}>
                Isopleth maps the boundary your Bitget cross-asset book is sitting next to, and
                names the smallest move that keeps you inside it.
              </p>
              <div style={{ display: "flex", gap: 16, marginTop: 32, flexWrap: "wrap" }}>
                <Link href="/workbench" className="btn btn-primary">
                  Map the boundary
                </Link>
                <Link href="/proof" className="btn btn-secondary">
                  See the proof
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 48, padding: "16px 24px", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          <span className="mono" style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            COLLATERAL CLOCK
          </span>
          <span className="mono" style={{ fontSize: 13 }}>
            {summary.clock.pairCount} pairs tracked · {summary.clock.rawRecordCount.toLocaleString()} ticks recorded
          </span>
          <span className="mono" style={{ fontSize: 13 }}>
            snapshot age: {ageLabel(summary.clock.latestSampleUtc)}
          </span>
          <span className={`chip ${summary.clock.pairsWithConfirmedFreezeThaw > 0 ? "chip-safe" : "chip-warn"}`}>
            {summary.clock.pairsWithConfirmedFreezeThaw > 0
              ? `${summary.clock.pairsWithConfirmedFreezeThaw} confirmed freeze+thaw`
              : "no confirmed freeze+thaw yet"}
          </span>
        </div>
      </section>

      <section className="container" style={{ paddingBottom: 56 }}>
        <div className="panel" style={{ padding: 32 }}>
          <h2 style={{ fontSize: 28, marginBottom: 8 }}>Drag the reopening gap, watch the contour move</h2>
          <p style={{ color: "var(--ink-soft)", marginBottom: 24, fontSize: 15 }}>
            A fixed demo book (SYNTHETIC — never a real holding). The contour marks where the modelled
            cross margin rate crosses Bitget&apos;s documented 80% warning line. Computed live by the same
            deterministic kernel that powers the Workbench.
          </p>
          <ContourChart frames={frames} xRange={X_RANGE} yRange={Y_RANGE} />
        </div>
      </section>

      <section className="container" style={{ paddingBottom: 72 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
          <Stat label="rToken universe discovered" value={String(summary.universe.pairCount)} note="live, not hardcoded" />
          <Stat label="closed-market windows mapped" value={String(summary.windows.count)} note="NYSE 2026 calendar" />
          <Stat label="bitget-signal tools wired" value={String(summary.mcp.toolCount)} note="public, no key" />
          <Stat
            label="F8 candle trap"
            value={summary.f8Trap.confirmed ? "confirmed" : "unconfirmed"}
            note="silent type=index fallback"
          />
        </div>

        {confirmed.length > 0 && (
          <div className="panel" style={{ marginTop: 24, padding: 24 }}>
            <h3 style={{ fontSize: 18, marginBottom: 12 }}>Measured transitions (not modelled)</h3>
            {confirmed.map((c) => (
              <p key={c.pair} className="mono" style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                {c.pair}: froze {c.freezeStartEt} ET → thawed {c.thawEt} ET
              </p>
            ))}
          </div>
        )}
      </section>

      <section className="container" style={{ paddingBottom: 96 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32 }}>
          <div>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Who it&apos;s for</h3>
            <p style={{ color: "var(--ink-soft)", fontSize: 15 }}>
              Semi-professional cross-asset traders and small desks holding rTokens as UTA Advanced
              Mode margin behind leveraged crypto positions.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Why they return</h3>
            <p style={{ color: "var(--ink-soft)", fontSize: 15 }}>
              State changes recur: every weekend, every US holiday, every tier crossing, every
              collateral-ratio announcement.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>What breaks the thesis</h3>
            <p style={{ color: "var(--ink-soft)", fontSize: 15 }}>
              If the recorder runs through a full closed-market window with no freeze at all, the
              central claim is wrong and <Link href="/proof">/proof</Link> says so.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="slab" style={{ padding: 20 }}>
      <div className="mono" style={{ fontSize: 32, fontWeight: 500 }}>
        {value}
      </div>
      <div style={{ fontSize: 14, marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>{note}</div>
    </div>
  );
}
