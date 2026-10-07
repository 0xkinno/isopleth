// Server-only: computes the demo contour with the real kernel. Never
// imported from a "use client" file - packages/core's hash.ts pulls in
// node:crypto, which has no business in a client bundle. Server Components
// call this and pass plain computed numbers down to the client chart.
import { locateContour, buildSurface, type Scenario, type SurfaceCell } from "@isopleth/core";
import { demoBook } from "./demoBook";

export const THRESHOLD = 0.8; // 80% cross margin rate - Bitget's documented warning line (F3)
export const X_RANGE = { min: -20, max: 15 }; // reference shock %, the reopening-gap axis
export const Y_RANGE: [number, number] = [-11, 5]; // crypto mark shock %, bounded short of insolvency at the extremes

const axis = (x: number, y: number): Scenario => ({
  id: `x${x}_y${y}`,
  referenceShockPct: { rAAPL: x },
  collateralRatioOverride: {},
  markShockPct: { BTCUSDT: y, ETHUSDT: y },
  asOf: "demo",
});

export interface ContourFrame {
  reopeningGapPct: number; // the slider value this frame represents
  points: Array<{ x: number; y: number | null }>;
  surface: SurfaceCell[]; // the full counterfactual surface, same grid, same kernel call
}

const SURFACE_RESOLUTION = 36; // cells per axis - fine enough to read as a real heatmap, not blocky

/** Precompute the contour AND the full counterfactual surface at a handful of "what if the reopening gap were X%" slider positions. */
export function buildContourFrames(): ContourFrame[] {
  const book = demoBook();
  const sliderValues = [-10, -5, 0, 5, 10];
  const xs = Array.from({ length: 25 }, (_, i) => X_RANGE.min + (i * (X_RANGE.max - X_RANGE.min)) / 24);
  const surfaceXs = Array.from({ length: SURFACE_RESOLUTION }, (_, i) => X_RANGE.min + (i * (X_RANGE.max - X_RANGE.min)) / (SURFACE_RESOLUTION - 1));
  const surfaceYs = Array.from({ length: SURFACE_RESOLUTION }, (_, i) => Y_RANGE[0] + (i * (Y_RANGE[1] - Y_RANGE[0])) / (SURFACE_RESOLUTION - 1));

  return sliderValues.map((gap) => {
    // the slider nudges the reference shock axis itself, reusing the same
    // kernel call the static contour and surface both use - one mechanism,
    // never two different code paths computing the "same" number.
    const shiftedAxis = (x: number, y: number) => axis(x + gap, y);
    const points = locateContour(book, shiftedAxis, THRESHOLD, xs, Y_RANGE, 1e-3);
    const surface = buildSurface(book, shiftedAxis, surfaceXs, surfaceYs);
    return { reopeningGapPct: gap, points, surface };
  });
}
