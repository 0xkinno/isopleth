import Image from "next/image";
import { evaluate, applyScenario, type Scenario } from "@isopleth/core";
import { demoBook } from "../../lib/demoBook";

const PRESETS = [
  { id: "reference-shock", label: "Reference shock", desc: "The rToken reference moves by x%.", refPct: -15, markPct: 0 },
  { id: "reopening", label: "Reopening gap", desc: "A MARKET_CLOSED_FROZEN reference becomes REOPENING, applying the first post-thaw print.", refPct: -25, markPct: 0 },
  { id: "joint", label: "Joint transition", desc: "Reference + crypto mark move together — the worst documented realistic case.", refPct: -10, markPct: -9.5 },
  { id: "crypto-crash", label: "Crypto mark shock", desc: "Crypto legs move independently of the reference axis.", refPct: 0, markPct: -10.5 },
];

export default function ScenariosPage() {
  const book = demoBook();

  return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 96 }}>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>Scenarios</h1>
      <p className="lead" style={{ marginBottom: 32 }}>
        Named state transitions, run through the same kernel as the Workbench. Historical analog
        replay is planned once the recorder has enough elapsed windows (see /method).
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
    </div>
  );
}
