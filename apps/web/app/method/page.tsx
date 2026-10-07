export const revalidate = 300;

import Image from "next/image";
import { getSummary } from "../../lib/data";

export default async function MethodPage() {
  const summary = await getSummary();

  return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 96 }}>
      <div className="two-col-responsive">
        <div style={{ position: "relative", borderRadius: "var(--radius-panel)", overflow: "hidden", minHeight: 320 }}>
          <Image src="/img/IMG_2.jpeg" alt="" fill style={{ objectFit: "cover" }} />
        </div>
        <div>
          <h1 style={{ fontSize: 36, marginBottom: 8 }}>Method</h1>
          <p className="lead" style={{ marginBottom: 32 }}>
            What is measured, what is modelled, and what is still unknown — stated plainly, not
            implied by polish. Full detail in <code>METHOD.md</code> and <code>LIMITATIONS.md</code>.
          </p>

          <Section title="MEASURED">
            <ul>
              <li>The rToken-eligible stock-perp universe ({summary.universe.pairCount} pairs) — discovered live, not hardcoded.</li>
              <li>Collateral discount-rate and position-tier ladders, content-hashed for change detection.</li>
              <li>
                The F8 silent-fallback trap (rToken candle <code>type=index/mark/premium</code> silently
                returns <code>type=market</code> data) — {summary.f8Trap.confirmed ? "confirmed live" : "not yet confirmed"}.
              </li>
              <li>indexPrice / markPrice / rToken spot, sampled every 60s since recording began.</li>
            </ul>
          </Section>

          <Section title="MEASURING RIGHT NOW">
            <p>
              Whether the reference clock actually freezes and thaws on the documented schedule.
              {summary.clock.pairsWithConfirmedFreezeThaw > 0
                ? ` ${summary.clock.pairsWithConfirmedFreezeThaw} pair(s) show a confirmed freeze+thaw so far — see /proof for which ones and whether that generalizes to liquid names.`
                : " No confirmed freeze+thaw yet."}
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

          <Section title="UNKNOWN">
            <ul>
              <li>Whether collateral tiers apply marginally per coin or on aggregated value (U5).</li>
              <li>Whether markPrice clamps to the frozen index or floats independently (U6).</li>
              <li>Tier boundary inclusivity/exclusivity (U8).</li>
              <li>Whether private per-coin valuation tracks the public index (U3/U4 — needs an optional read-only key, never a prerequisite).</li>
            </ul>
          </Section>
        </div>
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
