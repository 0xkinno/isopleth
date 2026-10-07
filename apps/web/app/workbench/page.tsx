import { evaluate, applyScenario, minimumIntervention, type Scenario } from "@isopleth/core";
import { demoBook } from "../../lib/demoBook";
import { buildContourFrames, X_RANGE, Y_RANGE } from "../../lib/contourDemo";
import { ContourChart } from "../../components/ContourChart";
import { YourBookPanel } from "../../components/YourBookPanel";

export default function WorkbenchPage() {
  const book = demoBook();
  const result = evaluate(book);
  const frames = buildContourFrames();

  // Stress the book -15% on crypto and -12% on the reference axis, via the
  // same applyScenario every other page uses - never a hand-rolled shock.
  // A hand-rolled version of this exact shock shipped here once already and
  // silently dropped the unrealized-PnL effect of the mark move, which made
  // a worsening book look safer. Routing through applyScenario is what
  // prevents that class of bug from coming back.
  const stressScenario: Scenario = {
    id: "workbench-demo-stress",
    referenceShockPct: { rAAPL: -12 },
    collateralRatioOverride: {},
    markShockPct: { BTCUSDT: -15, ETHUSDT: -15 },
    asOf: "demo",
  };
  const shocked = applyScenario(book, stressScenario);
  const shockedResult = evaluate(shocked);
  // The optimizer runs on the shocked book regardless of whether it refused -
  // a refusal (non-positive equity) is exactly the case minimum-intervention
  // exists for. It evaluates candidate ACTIONS applied to the shocked book,
  // never the raw shocked book itself, so a refusal here doesn't block it.
  const plan = minimumIntervention(shocked, 0.8);

  return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 96 }}>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>Workbench</h1>
      <p className="lead" style={{ marginBottom: 32 }}>
        A fixed demo book (SYNTHETIC). Every number below comes from <code>@isopleth/core</code>&apos;s
        deterministic kernel — nothing here is typed by hand.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 40 }}>
        <ResultCard title="Current book" result={result} />
        <ResultCard title="Shocked (-15% crypto, -12% reference)" result={shockedResult} />
      </div>

      <div className="panel" style={{ padding: 32, marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, marginBottom: 16 }}>Counterfactual surface</h2>
        <ContourChart frames={frames} xRange={X_RANGE} yRange={Y_RANGE} />
      </div>

      <div className="panel" style={{ padding: 32, marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, marginBottom: 16 }}>Minimum-intervention plan</h2>
        {!shockedResult.ok && (
          <p style={{ color: "var(--breach)", marginBottom: 16 }}>
            Shocked book REFUSED ({shockedResult.reason}) — exactly the case this optimizer exists for.
          </p>
        )}
        {!plan.ok && <p style={{ color: "var(--breach)" }}>{plan.reason}</p>}
        {plan.ok && (
          <ol style={{ paddingLeft: 20 }}>
            {plan.value.map((p, i) => (
              <li key={i} style={{ marginBottom: 16 }}>
                <div className="mono" style={{ fontSize: 14 }}>
                  cost ${p.interventionCostUsd.toLocaleString()} → residual cross margin rate{" "}
                  {(p.residualCrossMarginRate * 100).toFixed(2)}%
                </div>
                <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>
                  {p.actions.map((a) => `${a.kind}${a.target ? ` (${a.target})` : ""} $${a.amountUsd.toLocaleString()}`).join(" + ")}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <YourBookPanel />
    </div>
  );
}

function ResultCard({ title, result }: { title: string; result: ReturnType<typeof evaluate> }) {
  return (
    <div className="slab" style={{ padding: 20 }}>
      <div style={{ fontSize: 14, marginBottom: 8 }}>{title}</div>
      {!result.ok && <div style={{ color: "var(--breach)", fontSize: 14 }}>REFUSED: {result.reason}</div>}
      {result.ok && (
        <>
          <div className="mono" style={{ fontSize: 24 }}>
            {(result.value.crossMarginRate * 100).toFixed(2)}%
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>cross margin rate</div>
          <div className="mono" style={{ fontSize: 13, marginTop: 8 }}>
            equity ${result.value.adjEquityUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </>
      )}
    </div>
  );
}
