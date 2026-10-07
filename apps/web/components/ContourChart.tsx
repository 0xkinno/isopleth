"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { line as d3line, curveMonotoneX } from "d3-shape";
import type { ContourFrame } from "../lib/contourDemo";

const WIDTH = 640;
const HEIGHT = 420;
const MARGIN = { top: 20, right: 24, bottom: 48, left: 60 };

// Safe -> warn -> breach, matching the design tokens in globals.css
// (--safe/--warn/--breach) as RGB triples so they can be interpolated -
// CSS custom properties can't be lerped directly in JS.
const SAFE: [number, number, number] = [63, 143, 107];
const WARN: [number, number, number] = [217, 164, 65];
const BREACH: [number, number, number] = [176, 48, 42];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function mixColor(a: [number, number, number], b: [number, number, number], t: number): string {
  return `rgb(${Math.round(lerp(a[0], b[0], t))}, ${Math.round(lerp(a[1], b[1], t))}, ${Math.round(lerp(a[2], b[2], t))})`;
}

/** Maps a cross margin rate to a color: green well below threshold, amber approaching it, red beyond it. Null (kernel refused - insolvent) gets its own dark marker, never silently blended into the scale. */
function rateColor(rate: number | null, threshold: number): string {
  if (rate === null) return "#2A2420"; // insolvent - deliberately outside the safe/warn/breach gradient, not a "worse red"
  const t = rate / threshold;
  if (t <= 0.6) return mixColor(SAFE, SAFE, 0);
  if (t <= 1) return mixColor(SAFE, WARN, (t - 0.6) / 0.4);
  return mixColor(WARN, BREACH, Math.min(1, (t - 1) / 0.8));
}

function niceTicks(min: number, max: number, count: number): number[] {
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(min + i * step));
}

export function ContourChart({
  frames,
  xRange,
  yRange,
}: {
  frames: ContourFrame[];
  xRange: { min: number; max: number };
  yRange: [number, number];
}) {
  const [frameIdx, setFrameIdx] = useState(Math.floor(frames.length / 2));
  const frame = frames[frameIdx]!;
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);
  const hasDrawnIn = useRef(false);

  // One orchestrated load moment (FINAL_INSTRUCTION.md 9.6): the contour
  // draws itself once, 1.4s, on first mount only - never on every scenario
  // change, and never at all under prefers-reduced-motion.
  useEffect(() => {
    if (hasDrawnIn.current) return;
    hasDrawnIn.current = true;
    const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const path of pathRefs.current) {
      if (!path) continue;
      const length = path.getTotalLength();
      if (reduceMotion) {
        path.style.strokeDasharray = "";
        path.style.strokeDashoffset = "0";
        continue;
      }
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      path.style.transition = "none";
      path.getBoundingClientRect();
      path.style.transition = "stroke-dashoffset 1.4s cubic-bezier(0.22, 1, 0.36, 1)";
      path.style.strokeDashoffset = "0";
    }
    // frame.points intentionally not a dependency - this effect must run
    // exactly once, on mount, regardless of which frame is initially shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const xScale = useMemo(() => scaleLinear().domain([xRange.min, xRange.max]).range([MARGIN.left, WIDTH - MARGIN.right]), [xRange]);
  const yScale = useMemo(() => scaleLinear().domain(yRange).range([HEIGHT - MARGIN.bottom, MARGIN.top]), [yRange]);

  const xTicks = useMemo(() => niceTicks(xRange.min, xRange.max, 6), [xRange]);
  const yTicks = useMemo(() => niceTicks(yRange[0], yRange[1], 5), [yRange]);

  // Heatmap cell size, derived from the surface grid's own resolution so
  // cells tile exactly with no gaps or overlap.
  const surfaceXs = Array.from(new Set(frame.surface.map((c) => c.x))).sort((a, b) => a - b);
  const surfaceYs = Array.from(new Set(frame.surface.map((c) => c.y))).sort((a, b) => a - b);
  const cellW = surfaceXs.length > 1 ? xScale(surfaceXs[1]!) - xScale(surfaceXs[0]!) : 0;
  const cellH = surfaceYs.length > 1 ? yScale(surfaceYs[0]!) - yScale(surfaceYs[1]!) : 0;

  // Split into contiguous runs so a null (no-crossing) gap renders as a real
  // gap in the line, never bridged - a contour must never be drawn through a
  // region the kernel refused or that has no crossing (FINAL_INSTRUCTION.md 6.4).
  const runs: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];
  for (const p of frame.points) {
    if (p.y === null) {
      if (current.length > 0) runs.push(current);
      current = [];
    } else {
      current.push({ x: p.x, y: p.y });
    }
  }
  if (current.length > 0) runs.push(current);

  const pathGen = d3line<{ x: number; y: number }>()
    .x((d) => xScale(d.x))
    .y((d) => yScale(d.y))
    .curve(curveMonotoneX);

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        role="img"
        aria-label="Isopleth counterfactual surface: modelled cross margin rate across reference shock and crypto mark shock, with the threshold contour overlaid"
      >
        <defs>
          <filter id="contourGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="var(--vellum)" />

        {/* the surface heatmap: the real kernel evaluated across the grid, not a decorative gradient */}
        <g>
          {frame.surface.map((cell, i) => (
            <rect
              key={i}
              x={xScale(cell.x) - cellW / 2}
              y={yScale(cell.y) - cellH / 2}
              width={Math.max(cellW, 1)}
              height={Math.max(cellH, 1)}
              fill={rateColor(cell.crossMarginRate, 0.8)}
              opacity={0.85}
            />
          ))}
        </g>

        {/* gridlines, drawn over the heatmap so the surface still reads as structured data */}
        {xTicks.map((t) => (
          <line key={`vx${t}`} x1={xScale(t)} y1={MARGIN.top} x2={xScale(t)} y2={HEIGHT - MARGIN.bottom} stroke="rgba(18,34,46,0.12)" strokeWidth={1} />
        ))}
        {yTicks.map((t) => (
          <line key={`hy${t}`} x1={MARGIN.left} y1={yScale(t)} x2={WIDTH - MARGIN.right} y2={yScale(t)} stroke="rgba(18,34,46,0.12)" strokeWidth={1} />
        ))}

        {/* axis frame */}
        <rect x={MARGIN.left} y={MARGIN.top} width={WIDTH - MARGIN.left - MARGIN.right} height={HEIGHT - MARGIN.top - MARGIN.bottom} fill="none" stroke="var(--ink)" strokeOpacity={0.25} />

        {/* tick labels */}
        {xTicks.map((t) => (
          <text key={`xl${t}`} x={xScale(t)} y={HEIGHT - MARGIN.bottom + 18} textAnchor="middle" className="mono" fontSize={11} fill="var(--ink-soft)">
            {t > 0 ? `+${t}%` : `${t}%`}
          </text>
        ))}
        {yTicks.map((t) => (
          <text key={`yl${t}`} x={MARGIN.left - 10} y={yScale(t) + 4} textAnchor="end" className="mono" fontSize={11} fill="var(--ink-soft)">
            {t > 0 ? `+${t}%` : `${t}%`}
          </text>
        ))}

        {/* the contour itself: the located threshold crossing, bisected by the kernel */}
        {runs.map((run, i) => (
          <path
            key={i}
            ref={(el) => {
              pathRefs.current[i] = el;
            }}
            d={pathGen(run) ?? undefined}
            fill="none"
            stroke="var(--contour)"
            strokeWidth={3}
            strokeLinecap="round"
            filter="url(#contourGlow)"
          />
        ))}

        {/* current book position crosshair, at (0% shock, 0% shock) */}
        <line x1={xScale(0)} y1={MARGIN.top} x2={xScale(0)} y2={HEIGHT - MARGIN.bottom} stroke="var(--ink)" strokeDasharray="2,4" strokeOpacity={0.4} />
        <line x1={MARGIN.left} y1={yScale(0)} x2={WIDTH - MARGIN.right} y2={yScale(0)} stroke="var(--ink)" strokeDasharray="2,4" strokeOpacity={0.4} />
        <circle cx={xScale(0)} cy={yScale(0)} r={6} fill="var(--paper)" stroke="var(--ink)" strokeWidth={2} />
        <text x={xScale(0) + 12} y={yScale(0) - 12} className="mono" fontSize={13} fontWeight={600} fill="var(--ink)">
          book: (0%, 0%)
        </text>

        <text x={(MARGIN.left + WIDTH - MARGIN.right) / 2} y={HEIGHT - 8} textAnchor="middle" className="mono" fontSize={12} fill="var(--ink-soft)">
          reference shock %
        </text>
        <text x={16} y={(MARGIN.top + HEIGHT - MARGIN.bottom) / 2} className="mono" fontSize={12} fill="var(--ink-soft)" transform={`rotate(-90 16 ${(MARGIN.top + HEIGHT - MARGIN.bottom) / 2})`}>
          crypto mark shock %
        </text>

        {/* legend */}
        <g transform={`translate(${WIDTH - MARGIN.right - 150}, ${MARGIN.top + 4})`}>
          <rect x={0} y={0} width={10} height={10} fill={mixColor(SAFE, SAFE, 0)} />
          <text x={16} y={9} className="mono" fontSize={10} fill="var(--ink-soft)">safe</text>
          <rect x={60} y={0} width={10} height={10} fill={mixColor(SAFE, WARN, 1)} />
          <text x={76} y={9} className="mono" fontSize={10} fill="var(--ink-soft)">80%</text>
          <rect x={112} y={0} width={10} height={10} fill={mixColor(WARN, BREACH, 1)} />
          <text x={128} y={9} className="mono" fontSize={10} fill="var(--ink-soft)">breach</text>
        </g>
      </svg>

      <div style={{ marginTop: 16 }}>
        <label className="mono" style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          drag the reopening gap: {frame.reopeningGapPct > 0 ? "+" : ""}
          {frame.reopeningGapPct}%
        </label>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          step={1}
          value={frameIdx}
          onChange={(e) => setFrameIdx(Number(e.target.value))}
          style={{ width: "100%", marginTop: 8 }}
          aria-label="Reopening gap scenario slider"
        />
      </div>
    </div>
  );
}
