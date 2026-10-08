"use client";

// Reference Lag Atlas + margin replay. Every price here is a REAL recorded tick
// from the Collateral Clock; the book is a fixed SYNTHETIC one. The two margin
// lines differ only in which price values the collateral: the public reference
// index (what the clock measures) or market spot. Which one Bitget's private
// engine uses is an open claim (C5), so both are shown rather than one assumed.
import { useMemo, useState } from "react";

export interface ReplayPoint { t: number; et: string; idx: number; spot: number; gap: number; rRef: number | null; rMkt: number | null; frozen: boolean }
export interface ReplayData {
  evidence: string;
  book: { collateralUsdAtStart: number; collateralRate: number; cashUsd: number; btcLongQty: number; btcMarkUsd: number };
  totals: { recordsInChain: number; pairsAnalysed: number; ticksAnalysed: number; frozenShare: number };
  gapShare: { medianPct: number; p95Pct: number; over1pct: number };
  anomalies: Array<{ perp: string; p95GapPct: number }>;
  top: Array<{ perp: string; n: number; frozenFrac: number; longestFrozenMin: number; maxGapPct: number; p95GapPct: number; maxMarginShift: number }>;
  featured: string[];
  series: Record<string, { collateralQty: number; points: ReplayPoint[] }>;
}

const W = 880;
const PAD = { l: 64, r: 16, t: 14, b: 26 };

function scale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const span = d1 - d0 || 1;
  return (v: number) => range[0] + ((v - d0) / span) * (range[1] - range[0]);
}

function fmtDay(et: string) {
  return et.replace(", ", " ").slice(5, 16);
}

export function ClockReplay({ data }: { data: ReplayData }) {
  const [pair, setPair] = useState(data.featured[0]!);
  const series = data.series[pair]!;
  const pts = series.points;

  const view = useMemo(() => {
    const xs = scale([0, pts.length - 1], [PAD.l, W - PAD.r]);
    const prices = pts.flatMap((p) => [p.idx, p.spot]);
    const pMin = Math.min(...prices);
    const pMax = Math.max(...prices);
    const padP = (pMax - pMin) * 0.12 || pMax * 0.002;
    const ys1 = scale([pMin - padP, pMax + padP], [190 - PAD.b, PAD.t]);
    const rates = pts.flatMap((p) => [p.rRef, p.rMkt]).filter((v): v is number => v !== null);
    const rMin = Math.min(...rates);
    const rMax = Math.max(...rates);
    const padR = (rMax - rMin) * 0.2 || 0.5;
    const ys2 = scale([rMin - padR, rMax + padR], [150 - PAD.b, PAD.t]);

    // the index is a step function: hold the previous value until the next tick
    let idxPath = `M${xs(0)} ${ys1(pts[0]!.idx)}`;
    for (let i = 1; i < pts.length; i += 1) idxPath += ` H${xs(i)} V${ys1(pts[i]!.idx)}`;
    const spotPath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i)} ${ys1(p.spot)}`).join(" ");
    const refPath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i)} ${ys2(p.rRef ?? 0)}`).join(" ");
    const mktPath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i)} ${ys2(p.rMkt ?? 0)}`).join(" ");

    const frozenCount = pts.filter((p) => p.frozen).length;
    let longest = 0;
    let runStart = 0;
    pts.forEach((p, i) => {
      if (p.frozen) {
        if (runStart === 0) runStart = pts[i - 1]!.t;
        longest = Math.max(longest, p.t - runStart);
      } else runStart = 0;
    });
    const maxGap = Math.max(...pts.map((p) => Math.abs(p.gap)));
    let maxShift = 0;
    pts.forEach((p) => {
      if (p.rRef !== null && p.rMkt !== null && Math.abs(p.rMkt - p.rRef) > Math.abs(maxShift)) maxShift = p.rMkt - p.rRef;
    });
    return { xs, ys1, ys2, idxPath, spotPath, refPath, mktPath, frozenShare: frozenCount / (pts.length - 1), longestMin: Math.round(longest / 60000), maxGap, maxShift, pMin, pMax, rMin, rMax };
  }, [pts]);

  const tick = (i: number) => view.xs(i);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Tile k="ticks analysed" v={data.totals.ticksAnalysed.toLocaleString()} s={`${data.totals.pairsAnalysed} rToken pairs, real recorded chain`} />
        <Tile k="reference frozen" v={`${(data.totals.frozenShare * 100).toFixed(1)}%`} s="of ticks: index unchanged since the previous tick" />
        <Tile k="spot vs reference" v={`${data.gapShare.medianPct}%`} s={`median gap, p95 ${data.gapShare.p95Pct}%, ${(data.gapShare.over1pct * 100).toFixed(1)}% of ticks above 1%`} />
        <Tile k="anomalies kept out" v={String(data.anomalies.length)} s={data.anomalies.map((a) => `${a.perp} (${a.p95GapPct.toFixed(0)}% gap, unit mapping)`).join(", ") || "none"} />
      </div>

      <div role="tablist" aria-label="Pair" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {data.featured.map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={p === pair}
            onClick={() => setPair(p)}
            className="mono"
            style={{ padding: "8px 14px", borderRadius: 999, border: "1px solid var(--ink)", background: p === pair ? "var(--ink)" : "transparent", color: p === pair ? "var(--vellum)" : "var(--ink)", fontSize: 13, cursor: "pointer" }}
          >
            {p.replace("USDT", "")}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
        <Mini k="frozen share" v={`${(view.frozenShare * 100).toFixed(1)}%`} />
        <Mini k="longest freeze" v={`${view.longestMin} min`} />
        <Mini k="max |spot − index|" v={`${view.maxGap.toFixed(2)}%`} />
        <Mini k="max margin shift" v={`${view.maxShift >= 0 ? "+" : ""}${view.maxShift.toFixed(2)} pts`} />
      </div>

      <svg viewBox={`0 0 ${W} 360`} width="100%" role="img" aria-label={`Reference index versus market spot for ${pair}, and the cross margin rate under each valuation`}>
        <rect width={W} height={360} fill="var(--vellum)" rx={12} />
        <text x={PAD.l} y={12} className="mono" fontSize={11} fill="var(--ink-soft)">price · index (step) vs spot · one tick per step, recorder gaps not stretched</text>
        {pts.map((p, i) => (p.frozen ? <rect key={i} x={tick(i) - 2} y={190 - PAD.b + 3} width={4} height={8} fill="var(--warn)" /> : null))}
        <path d={view.idxPath} fill="none" stroke="var(--ink)" strokeWidth={2} />
        <path d={view.spotPath} fill="none" stroke="var(--contour)" strokeWidth={2} />
        <text x={PAD.l - 8} y={PAD.t + 4} textAnchor="end" className="mono" fontSize={10} fill="var(--ink-soft)">{view.pMax.toFixed(2)}</text>
        <text x={PAD.l - 8} y={190 - PAD.b} textAnchor="end" className="mono" fontSize={10} fill="var(--ink-soft)">{view.pMin.toFixed(2)}</text>
        <text x={W - PAD.r} y={190 - 2} textAnchor="end" className="mono" fontSize={10} fill="var(--warn-text)">amber ticks = reference frozen</text>

        <g transform="translate(0,190)">
          <text x={PAD.l} y={12} className="mono" fontSize={11} fill="var(--ink-soft)">cross margin rate % · collateral valued at reference (ink) vs spot (teal)</text>
          <path d={view.refPath} fill="none" stroke="var(--ink)" strokeWidth={2} />
          <path d={view.mktPath} fill="none" stroke="var(--contour)" strokeWidth={2} />
          <text x={PAD.l - 8} y={PAD.t + 4} textAnchor="end" className="mono" fontSize={10} fill="var(--ink-soft)">{view.rMax.toFixed(1)}</text>
          <text x={PAD.l - 8} y={150 - PAD.b} textAnchor="end" className="mono" fontSize={10} fill="var(--ink-soft)">{view.rMin.toFixed(1)}</text>
        </g>
        <text x={PAD.l} y={354} className="mono" fontSize={10} fill="var(--ink-soft)">{fmtDay(pts[0]!.et)} ET</text>
        <text x={W - PAD.r} y={354} textAnchor="end" className="mono" fontSize={10} fill="var(--ink-soft)">{fmtDay(pts[pts.length - 1]!.et)} ET</text>
      </svg>

      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 12 }}>
        Evidence: <strong>{data.evidence}</strong>. Book: ${data.book.collateralUsdAtStart.toLocaleString()} of rToken at a {data.book.collateralRate * 100}% collateral rate, ${data.book.cashUsd.toLocaleString()} cash,
        long {data.book.btcLongQty} BTC at ${data.book.btcMarkUsd.toLocaleString()}, held fixed so only the collateral valuation differs. Whether Bitget&apos;s private engine values collateral at the
        public reference index is claim C5 and is still open; this replay shows what each answer would imply instead of assuming one. In a quiet week the effect is small. The real test is a weekend close.
      </p>

      <h3 style={{ fontSize: 18, margin: "28px 0 10px" }}>Reference lag atlas · widest gaps</h3>
      <div className="panel" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--ink-soft)" }}>
              {["pair", "ticks", "frozen", "longest freeze", "max gap", "p95 gap", "max margin shift"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.top.map((r) => (
              <tr key={r.perp} style={{ borderTop: "1px solid var(--rule)" }}>
                <td className="mono" style={{ padding: "8px 16px" }}>{r.perp}</td>
                <td className="mono" style={{ padding: "8px 16px" }}>{r.n}</td>
                <td className="mono" style={{ padding: "8px 16px" }}>{(r.frozenFrac * 100).toFixed(0)}%</td>
                <td className="mono" style={{ padding: "8px 16px" }}>{r.longestFrozenMin} min</td>
                <td className="mono" style={{ padding: "8px 16px" }}>{r.maxGapPct.toFixed(2)}%</td>
                <td className="mono" style={{ padding: "8px 16px" }}>{r.p95GapPct.toFixed(2)}%</td>
                <td className="mono" style={{ padding: "8px 16px" }}>{r.maxMarginShift >= 0 ? "+" : ""}{r.maxMarginShift.toFixed(2)} pts</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ k, v, s }: { k: string; v: string; s: string }) {
  return (
    <div className="slab" style={{ padding: 16 }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-soft)" }}>{k}</div>
      <div className="mono" style={{ fontSize: 28, fontWeight: 600, margin: "4px 0" }}>{v}</div>
      <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{s}</div>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ borderLeft: "3px solid var(--contour)", paddingLeft: 12 }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{k}</div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>{v}</div>
    </div>
  );
}
