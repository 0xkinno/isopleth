export const revalidate = 300;

import Image from "next/image";
import { getSummary } from "../../lib/data";

export default async function MethodPage() {
  const summary = await getSummary();

  return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 96 }}>
      <div style={{ position: "relative", borderRadius: "var(--radius-panel)", overflow: "hidden", marginBottom: 48 }}>
        <div style={{ position: "relative", aspectRatio: "21 / 9", width: "100%" }}>
          <Image
            src="/img/IMG_2.jpeg"
            alt="An antique brass surveyor's instrument on paper, evoking precise measurement"
            fill
            style={{ objectFit: "cover", objectPosition: "center 35%" }}
            sizes="100vw"
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, var(--vellum) 0%, rgba(236,239,234,0.85) 28%, rgba(236,239,234,0.15) 60%, transparent 100%)",
            }}
          />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center" }}>
            <div style={{ maxWidth: 520, padding: "0 40px" }}>
              <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", marginBottom: 12 }}>Method</h1>
              <p className="lead" style={{ fontSize: 17 }}>
                What is measured, what is modelled, and what is still unknown — stated plainly, not
                implied by polish. Full detail in <code>METHOD.md</code> and <code>LIMITATIONS.md</code>.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760 }}>
        <Section title="MEASURED">
          <ul>
            <li>The rToken-eligible stock-perp universe ({summary.universe.pairCount} pairs) — discovered live, not hardcoded.</li>
            <li>Collateral discount-rate tier ladders, content-hashed for change detection (520 real entries).</li>
            <li>
              The F8 silent-fallback trap (rToken candle <code>type=index/mark/premium</code> silently
              returns <code>type=market</code> data) — {summary.f8Trap.confirmed ? "confirmed live" : "not yet confirmed"}.
            </li>
            <li>indexPrice / markPrice / rToken spot, sampled every 60s since recording began.</li>
          </ul>
        </Section>

        <Section title="MEASURING RIGHT NOW">
          <p>
            Whether the reference clock actually freezes and thaws on the documented schedule, in a
            liquid name — the GitHub Actions recorder runs on a 10-minute cron independent of any
            laptop staying on.
            {summary.clock.pairsWithConfirmedFreezeThaw > 0
              ? ` ${summary.clock.pairsWithConfirmedFreezeThaw} thin-liquidity pair(s) show a confirmed freeze+thaw so far — see /proof for which ones and whether that generalizes to liquid names.`
              : " No confirmed freeze+thaw yet."}{" "}
            Next clean test window: the 2026-10-09–12 weekend close. This cannot be sped up by
            writing more code — it depends on that weekend actually happening.
          </p>
        </Section>

        <Section title="MODELLED">
          <p>
            The margin kernel, the counterfactual surface, the contour, and the minimum-intervention
            optimizer (<code>@isopleth/core</code>) are deterministic functions over whatever state is
            fed in. Every result they produce carries an explicit <code>evidence</code> field —
            SYNTHETIC for demo books, REPLAYED for real historical windows. Nothing is presented as
            more certain than its evidence class says it is.
          </p>
        </Section>

        <Section title="KNOWN ISSUE, BEING FIXED">
          <p>
            Position-tier capture currently fails against Bitget&apos;s live API (wrong request
            parameter) and was silently recorded as succeeded — see{" "}
            <a href="https://github.com/0xkinno/isopleth/blob/main/ARCHITECTURE.md#known-issues-stated-plainly-not-buried" target="_blank" rel="noreferrer">
              ARCHITECTURE.md
            </a>{" "}
            for the exact cause and fix in progress. This is why U5/U8 below remain open — there has
            never been real tier-ladder data to check them against.
          </p>
        </Section>

        <Section title="UNKNOWN">
          <ul>
            <li>Whether collateral tiers apply marginally per coin or on aggregated value (U5) — blocked on the position-tier fix above.</li>
            <li>Whether markPrice clamps to the frozen index or floats independently (U6) — needs more elapsed closed-market time.</li>
            <li>Tier boundary inclusivity/exclusivity (U8) — blocked on the position-tier fix above.</li>
            <li>Whether private per-coin valuation tracks the public index (U3/U4) — needs an optional read-only key, never a prerequisite.</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 className="mono" style={{ fontSize: 15, letterSpacing: "0.04em", color: "var(--ink-soft)", marginBottom: 8 }}>
        {title}
      </h2>
      <div style={{ fontSize: 15, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}
