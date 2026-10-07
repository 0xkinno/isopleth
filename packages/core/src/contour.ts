// Locate the threshold crossing by bisection on the kernel itself - never by
// interpolating rendered pixels. Each located point is re-evaluated and must
// satisfy the threshold within tolerance (I10). A row with no sign change
// returns null and renders as a gap - never draw a contour through a region
// the kernel refused or where no crossing exists.
import { applyScenario, type Scenario } from "./scenario";
import { evaluate } from "./margin";
import type { Book } from "./types";

export interface ContourPoint {
  x: number;
  y: number | null;
}

export function locateContour(
  book: Book,
  axis: (x: number, y: number) => Scenario,
  threshold: number,
  xs: number[],
  yRange: [number, number],
  tol = 1e-4,
): ContourPoint[] {
  const rate = (x: number, y: number): number | null => {
    const r = evaluate(applyScenario(book, axis(x, y)));
    return r.ok ? r.value.crossMarginRate : null;
  };

  return xs.map((x) => {
    let [lo, hi] = yRange;
    const rLo = rate(x, lo);
    const rHi = rate(x, hi);
    if (rLo === null || rHi === null) return { x, y: null };
    if ((rLo - threshold) * (rHi - threshold) > 0) return { x, y: null }; // no crossing on this row
    for (let i = 0; i < 60 && hi - lo > tol; i += 1) {
      const mid = (lo + hi) / 2;
      const rM = rate(x, mid);
      if (rM === null) return { x, y: null };
      if ((rLo - threshold) * (rM - threshold) <= 0) hi = mid;
      else lo = mid;
    }
    return { x, y: (lo + hi) / 2 };
  });
}

/** I10: re-evaluate a located contour point and confirm it's within tolerance of the threshold. */
export function verifyContourPoint(
  book: Book,
  axis: (x: number, y: number) => Scenario,
  threshold: number,
  point: ContourPoint,
  tol = 1e-3,
): boolean {
  if (point.y === null) return true; // nothing to verify for an honest gap
  const r = evaluate(applyScenario(book, axis(point.x, point.y)));
  if (!r.ok) return false;
  return Math.abs(r.value.crossMarginRate - threshold) <= tol;
}

export interface SurfaceCell {
  x: number;
  y: number;
  crossMarginRate: number | null;
}

/** The full counterfactual surface: the kernel evaluated across a state grid. */
export function buildSurface(
  book: Book,
  axis: (x: number, y: number) => Scenario,
  xs: number[],
  ys: number[],
): SurfaceCell[] {
  const cells: SurfaceCell[] = [];
  for (const x of xs) {
    for (const y of ys) {
      const r = evaluate(applyScenario(book, axis(x, y)));
      cells.push({ x, y, crossMarginRate: r.ok ? r.value.crossMarginRate : null });
    }
  }
  return cells;
}
