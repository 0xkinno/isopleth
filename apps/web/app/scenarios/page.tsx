import Image from "next/image";
import { evaluate, applyScenario, type Scenario } from "@isopleth/core";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { demoBook } from "../../lib/demoBook";
import { ClockReplay, type ReplayData } from "../../components/ClockReplay";

const PRESETS = [
  { id: "reference-shock", label: "Reference shock", desc: "The rToken reference moves by x%.", refPct: -15, markPct: 0 },
  { id: "reopening", label: "Reopening gap", desc: "A MARKET_CLOSED_FROZEN reference becomes REOPENING, applying the first post-thaw print.", refPct: -25, markPct: 0 },
  { id: "joint", label: "Joint transition", desc: "Reference + crypto mark move together — the worst documented realistic case.", refPct: -10, markPct: -9.5 },
  { id: "crypto-crash", label: "Crypto mark shock", desc: "Crypto legs move independently of the reference axis.", refPct: 0, markPct: -10.5 },
];

async function loadReplay(): Promise<ReplayData | null> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "public", "data", "clock-replay.json"), "utf8")) as ReplayData;
  } catch {
    return null;
  }
}

export default async function ScenariosPage() {
  const book = demoBook();
  const replay = await loadReplay();

  return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 96 }}>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>Scenarios</h1>
      <p className="lead" style={{ marginBottom: 32 }}>
        Named state transitions, run through the same kernel as the Workbench, and below them a replay
        of the real recorded reference clock: how long the public reference sat frozen while market
        spot kept moving, and what that does to a leveraged book.
      </p>

      <div style={{ position: "relative", borderRadius: "var(--radius-panel)", overflow: "hidden", marginBottom: 32, height: 180 }}>
        <Image src="/img/IMG_3.jpeg" alt="" fill style={{ objectFit: "cover", opacity: 0.5 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
        {PRESETS.map((preset) => {
          // applyScenario, not a hand-rolled shock - the kernel's own
          // scenario operator correctly moves unrealized PnL along with
          // markUsd (see packages/core/src/scenario.ts); duplicating that
          // logic ad hoc here already caused a real bug once (see Workbench).
          const scenario: Scenario = {
            id: preset.id,
            referenceShockPct: { rAAPL: preset.refPct },
            collateralRatioOverride: {},
            markShockPct: { BTCUSDT: preset.markPct, ETHUSDT: preset.markPct },
            asOf: "demo",
          };
          const r = evaluate(applyScenario(book, scenario));
          return (
            <div key={preset.id} className="slab" style={{ padding: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>{preset.label}</div>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 12 }}>{preset.desc}</p>
              {r.ok ? (
                <div className={`chip ${r.value.crossMarginRate > 1 ? "chip-breach" : r.value.crossMarginRate > 0.8 ? "chip-warn" : "chip-safe"}`}>
                  {(r.value.crossMarginRate * 100).toFixed(1)}% cross margin rate
                </div>
              ) : (
                <div className="chip chip-breach">REFUSED: {r.reason}</div>
              )}
            </div>
          );
        })}
      </div>

      {replay && (
        <div style={{ marginTop: 56 }}>
          <h2 style={{ fontSize: 28, marginBottom: 8 }}>Clock replay</h2>
          <p className="lead" style={{ marginBottom: 24 }}>
            Measured, not modelled: every price below is a real tick from the hash-chained Collateral Clock.
          </p>
          <ClockReplay data={replay} />
        </div>
      )}
    </div>
  );
}
