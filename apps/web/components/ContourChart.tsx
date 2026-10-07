"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { line as d3line, curveMonotoneX } from "d3-shape";
import type { ContourFrame } from "../lib/contourDemo";

const WIDTH = 640;
const HEIGHT = 380;
const MARGIN = { top: 24, right: 24, bottom: 40, left: 56 };

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
      // Force layout before the transition so the browser animates from the
      // offset above, not from whatever it painted first.
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
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="Isopleth contour: crypto mark shock vs reference reopening gap">
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="var(--vellum)" />
        {/* fragile region wash, above the contour */}
        <rect x={MARGIN.left} y={MARGIN.top} width={WIDTH - MARGIN.left - MARGIN.right} height={HEIGHT - MARGIN.top - MARGIN.bottom} fill="#F3E6D8" opacity={0.4} />

        {/* axes */}
        <line x1={MARGIN.left} y1={HEIGHT - MARGIN.bottom} x2={WIDTH - MARGIN.right} y2={HEIGHT - MARGIN.bottom} stroke="var(--rule)" />
        <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={HEIGHT - MARGIN.bottom} stroke="var(--rule)" />

        {runs.map((run, i) => (
          <path
            key={i}
            ref={(el) => {
              pathRefs.current[i] = el;
            }}
            d={pathGen(run) ?? undefined}
            fill="none"
            stroke="var(--contour)"
            strokeWidth={2.5}
            style={{ filter: "drop-shadow(0 0 6px rgba(47,123,146,0.35))" }}
          />
        ))}

        {/* current book position crosshair, at (0% shock, 0% shock) */}
        <circle cx={xScale(0)} cy={yScale(0)} r={5} fill="var(--ink)" />
        <text x={xScale(0) + 10} y={yScale(0) - 10} className="mono" fontSize={12} fill="var(--ink)">
          book: (0%, 0%)
        </text>

        <text x={MARGIN.left} y={HEIGHT - 10} className="mono" fontSize={12} fill="var(--ink-soft)">
          reference shock %
        </text>
        <text x={14} y={MARGIN.top + 10} className="mono" fontSize={12} fill="var(--ink-soft)" transform={`rotate(-90 14 ${MARGIN.top + 10})`}>
          crypto mark shock %
        </text>
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
