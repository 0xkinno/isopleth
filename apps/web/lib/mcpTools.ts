// The read-only tool surface Isopleth exposes over MCP (and that the Ask bar
// calls). Every tool is a thin, typed view over the deterministic kernel or over
// stored measurements. None of them can place an order, write state, or return a
// number the kernel or the recorder did not produce. Each kernel answer carries a
// receipt (SHA-256 over engine version + canonical input + result) that anyone
// can recompute with isopleth_verify_receipt or offline.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { evaluate, applyScenario, minimumIntervention, locateContour, verifyContourPoint, resultHash, ENGINE_VERSION, type Book, type Scenario } from "@isopleth/core";
import { validateBook } from "./bookValidate";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<unknown>;
}

const bookSchema = { type: "object", description: "An Isopleth Book: collateral[], positions[], cashUsd, liabilitiesUsd, unrealisedPnlUsd, partialLiqFeeUsd (same shape as @isopleth/core Book)." };
const shockProps = {
  referenceShockPct: { type: "number", description: "Percent move applied to every collateral reference price (default -12)." },
  markShockPct: { type: "number", description: "Percent move applied to every crypto position mark (default -15)." },
};

function parseBook(args: Record<string, unknown>): Book {
  const v = validateBook(args.book);
  if (!v.ok) throw new Error(`invalid book: ${v.errors.join("; ")}`);
  return v.book;
}

function scenarioFor(book: Book, referenceShockPct: number, markShockPct: number, id: string): Scenario {
  return {
    id,
    referenceShockPct: Object.fromEntries(book.collateral.map((c) => [c.coin, referenceShockPct])),
    collateralRatioOverride: {},
    markShockPct: Object.fromEntries(book.positions.filter((p) => p.kind === "crypto").map((p) => [p.symbol, markShockPct])),
    asOf: "mcp",
  };
}

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

async function readPublicJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(process.cwd(), "public", "data", name), "utf8")) as T;
}

export const TOOLS: ToolDef[] = [
  {
    name: "isopleth_evaluate_book",
    description: "Run a book through the deterministic margin kernel, current and under a stress. Refuses (never guesses) on unknown reference state, missing tiers, or non-positive equity. Returns a verifiable receipt.",
    inputSchema: { type: "object", properties: { book: bookSchema, ...shockProps }, required: ["book"] },
    async run(args) {
      const book = parseBook(args);
      const result = evaluate(book);
      const scenario = scenarioFor(book, num(args.referenceShockPct, -12), num(args.markShockPct, -15), "mcp-evaluate");
      const shockedResult = evaluate(applyScenario(book, scenario));
      return {
        result,
        shockedResult,
        scenario,
        receipt: { engineVersion: ENGINE_VERSION, hash: resultHash(book, result), covers: "engineVersion + canonical(book) + result" },
      };
    },
  },
  {
    name: "isopleth_minimum_intervention",
    description: "Search the cheapest actions (add cash, reduce a position, sell collateral) that bring the stressed book back under the threshold. Advisory only, never executes anything.",
    inputSchema: { type: "object", properties: { book: bookSchema, ...shockProps, threshold: { type: "number", description: "Cross margin rate ceiling, default 0.8." } }, required: ["book"] },
    async run(args) {
      const book = parseBook(args);
      const scenario = scenarioFor(book, num(args.referenceShockPct, -12), num(args.markShockPct, -15), "mcp-plan");
      const shocked = applyScenario(book, scenario);
      const plan = minimumIntervention(shocked, num(args.threshold, 0.8));
      return { plan, receipt: { engineVersion: ENGINE_VERSION, hash: resultHash({ book, scenario, threshold: num(args.threshold, 0.8) }, plan) } };
    },
  },
  {
    name: "isopleth_locate_contour",
    description: "Locate the contour where the book crosses the threshold, by bisection on the kernel itself. x = reference shock %, y = crypto mark shock %. Each located point is re-evaluated and verified (I10).",
    inputSchema: {
      type: "object",
      properties: {
        book: bookSchema,
        threshold: { type: "number", description: "default 0.8" },
        xMin: { type: "number", description: "default -20" },
        xMax: { type: "number", description: "default 15" },
        steps: { type: "number", description: "default 15, max 60" },
        yMin: { type: "number", description: "default -11" },
        yMax: { type: "number", description: "default 5" },
      },
      required: ["book"],
    },
    async run(args) {
      const book = parseBook(args);
      const threshold = num(args.threshold, 0.8);
      const xMin = num(args.xMin, -20);
      const xMax = num(args.xMax, 15);
      const steps = Math.max(2, Math.min(60, Math.round(num(args.steps, 15))));
      const xs = Array.from({ length: steps }, (_, i) => xMin + ((xMax - xMin) * i) / (steps - 1));
      const axis = (x: number, y: number) => scenarioFor(book, x, y, "mcp-contour");
      const yRange: [number, number] = [num(args.yMin, -11), num(args.yMax, 5)];
      const points = locateContour(book, axis, threshold, xs, yRange);
      const verified = points.filter((p) => p.y !== null).every((p) => verifyContourPoint(book, axis, threshold, p));
      return { threshold, axes: { x: "reference shock %", y: "crypto mark shock %" }, points, allLocatedPointsReEvaluatedWithinTolerance: verified };
    },
  },
  {
    name: "isopleth_clock_status",
    description: "Current state of the Collateral Clock recorder: records in the hash chain, rToken pairs, observed reference-price transitions, confirmed freeze+thaw events, and the F8 candle-trap result.",
    inputSchema: { type: "object", properties: {} },
    async run() {
      const s = await readPublicJson<Record<string, unknown>>("summary.json");
      return { clock: s.clock, f8Trap: s.f8Trap, universe: { pairCount: (s.universe as { pairCount?: number } | undefined)?.pairCount }, claims: s.claims, note: "evidence classes: MEASURED for the clock, never inferred" };
    },
  },
  {
    name: "isopleth_reference_lag",
    description: "Measured reference lag from the real recorded chain: how often the public reference index sat frozen while spot moved, the widest spot-vs-index gaps, and the margin shift a fixed leveraged book would see under each valuation. Optionally a single pair.",
    inputSchema: { type: "object", properties: { pair: { type: "string", description: "e.g. TSLAUSDT" } } },
    async run(args) {
      const d = await readPublicJson<{ totals: unknown; gapShare: unknown; anomalies: unknown; top: Array<{ perp: string }>; evidence: string; featured: string[]; series: Record<string, { points: unknown[] }> }>("clock-replay.json");
      const pair = typeof args.pair === "string" ? args.pair.toUpperCase() : null;
      if (pair) {
        const row = d.top.find((r) => r.perp === pair);
        const s = d.series[pair];
        if (!row && !s) return { error: `no replay series for ${pair}`, available: d.featured };
        return { pair, stats: row ?? null, points: s ? s.points.length : 0, evidence: d.evidence };
      }
      return { totals: d.totals, gapShare: d.gapShare, anomalies: d.anomalies, widestGaps: d.top.slice(0, 5), evidence: d.evidence };
    },
  },
  {
    name: "isopleth_verify_receipt",
    description: "Recompute a receipt hash from the original input and result and say whether it matches. This is how any published Isopleth number is checked without trusting the server.",
    inputSchema: { type: "object", properties: { input: {}, result: {}, hash: { type: "string" } }, required: ["input", "result", "hash"] },
    async run(args) {
      const recomputed = resultHash(args.input, args.result);
      return { engineVersion: ENGINE_VERSION, recomputed, supplied: args.hash, valid: recomputed === args.hash };
    },
  },
];

export function listTools() {
  return TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}
