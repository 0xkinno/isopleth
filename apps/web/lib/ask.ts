// The Ask bar's brain. Intent is routed by explicit rules to the same read-only
// tools the MCP server exposes, and the answer text is assembled by code from
// the tools' own outputs. No model is needed and none can invent a number: the
// sentence is a template over kernel facts. Every call is recorded in a trace
// (tool, arguments, output, duration) that the UI shows expanded on request.
import { TOOLS } from "./mcpTools";
import { demoBookJson } from "./demoBook";

export interface TraceStep { tool: string; args: Record<string, unknown>; output: unknown; ms: number; error?: string }
export interface AskResult {
  ok: true;
  route: string;
  answer: string[];
  trace: TraceStep[];
  receipt: { engineVersion: string; hash: string } | null;
  thesis: string | null;
}

type Book = Record<string, unknown>;

async function call(trace: TraceStep[], tool: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const def = TOOLS.find((t) => t.name === tool);
  if (!def) throw new Error(`no such tool ${tool}`);
  const t0 = Date.now();
  try {
    const output = (await def.run(args)) as Record<string, unknown>;
    trace.push({ tool, args: summarise(args), output, ms: Date.now() - t0 });
    return output;
  } catch (e) {
    trace.push({ tool, args: summarise(args), output: null, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

// keep the trace readable: a whole book is replaced by a one-line marker
function summarise(args: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) out[k] = k === "book" ? "<book>" : v;
  return out;
}

const pct = (n: number, d = 2) => `${(n * 100).toFixed(d)}%`;
const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

type Outcome = { ok: true; value: { crossMarginRate: number; adjEquityUsd: number; maintenanceMarginUsd: number } } | { ok: false; reason: string };

function describe(label: string, r: Outcome): string {
  return r.ok
    ? `${label}: cross margin rate ${pct(r.value.crossMarginRate)}, adjusted equity ${usd(r.value.adjEquityUsd)}, maintenance margin ${usd(r.value.maintenanceMarginUsd)}.`
    : `${label}: the kernel REFUSED (${r.reason}). It does not guess a number here.`;
}

function parseShock(q: string): { reference?: number; mark?: number } {
  const m = q.match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (!m) return {};
  let v = Math.abs(Number(m[1]));
  const down = /(down|drop|fall|fell|crash|lower|decline|dump|minus|-)/i.test(q) || Number(m[1]) < 0;
  const up = /(up|rise|rally|pump|gain|higher|plus)/i.test(q) && !down;
  v = up ? v : -v;
  const crypto = /(btc|bitcoin|eth|ethereum|crypto|perp|mark)/i.test(q);
  const ref = /(reopen|reference|rtoken|aapl|nvda|tsla|stock|equity|collateral|nyse|open)/i.test(q);
  if (crypto && !ref) return { mark: v };
  if (ref && !crypto) return { reference: v };
  return crypto ? { mark: v, reference: v } : { reference: v };
}

export async function ask(question: string, bookInput: Book | null, thesis: string): Promise<AskResult> {
  const q = question.trim().slice(0, 300);
  const book = bookInput ?? (JSON.parse(demoBookJson()) as Book);
  const trace: TraceStep[] = [];
  const answer: string[] = [];
  let receipt: AskResult["receipt"] = null;
  let route = "state";

  const evalWith = async (shock: { reference?: number; mark?: number }) => {
    const out = await call(trace, "isopleth_evaluate_book", { book, referenceShockPct: shock.reference ?? 0, markShockPct: shock.mark ?? 0 });
    receipt = out.receipt as AskResult["receipt"];
    return out as { result: Outcome; shockedResult: Outcome };
  };

  const shock = parseShock(q);
  const wantsBreak = /(break|boundary|contour|fragile|first|threshold|where.*(fail|liquid))/i.test(q);
  const wantsPlan = /(smallest|plan|fix|safe|keep me|reduce|intervention|top.?up|how much (cash|margin))/i.test(q);
  const wantsClock = /(clock|frozen|freeze|thaw|lag|reference (price|index)|how stale|measured)/i.test(q) && shock.reference === undefined && shock.mark === undefined;

  if (wantsClock) {
    route = "clock";
    const lag = (await call(trace, "isopleth_reference_lag", {})) as { totals: { ticksAnalysed: number; pairsAnalysed: number; frozenShare: number }; gapShare: { medianPct: number; p95Pct: number }; widestGaps: Array<{ perp: string; maxGapPct: number; longestFrozenMin: number }> };
    const st = (await call(trace, "isopleth_clock_status", {})) as { clock: { rawRecordCount: number; pairsWithConfirmedFreezeThaw: number } };
    answer.push(`Across ${lag.totals.ticksAnalysed.toLocaleString()} recorded ticks on ${lag.totals.pairsAnalysed} rToken pairs, the public reference index was unchanged from the previous tick ${(lag.totals.frozenShare * 100).toFixed(1)}% of the time. Market spot sat a median ${lag.gapShare.medianPct}% away from it (95th percentile ${lag.gapShare.p95Pct}%).`);
    const w = lag.widestGaps[0];
    if (w) answer.push(`Widest gap: ${w.perp} at ${w.maxGapPct}%, with the reference frozen up to ${w.longestFrozenMin} minutes. The hash chain holds ${st.clock.rawRecordCount.toLocaleString()} records; ${st.clock.pairsWithConfirmedFreezeThaw} pair(s) show a confirmed freeze and thaw so far.`);
  } else if (wantsBreak && shock.reference === undefined && shock.mark === undefined) {
    route = "boundary";
    const now = await evalWith({});
    answer.push(describe("Right now", now.result));
    const c = (await call(trace, "isopleth_locate_contour", { book, xMin: 0, xMax: 0, steps: 2 })) as { threshold: number; points: Array<{ x: number; y: number | null }>; allLocatedPointsReEvaluatedWithinTolerance: boolean };
    const y = c.points[0]?.y;
    answer.push(
      y === null || y === undefined
        ? `With the reference price unchanged, no crypto mark move inside the searched range crosses the ${pct(c.threshold, 0)} line. The contour has a gap here, and it is shown as a gap, not bridged.`
        : `With the reference price unchanged, the book crosses the ${pct(c.threshold, 0)} threshold when crypto marks fall about ${Math.abs(y).toFixed(2)}%. That point was found by bisection on the kernel and re-evaluated within tolerance (${c.allLocatedPointsReEvaluatedWithinTolerance ? "verified" : "NOT verified"}).`,
    );
  } else if (wantsPlan && shock.reference === undefined && shock.mark === undefined) {
    route = "plan";
    const out = await evalWith({ reference: -12, mark: -15 });
    answer.push(describe("Under the standard stress (-12% reference, -15% crypto)", out.shockedResult));
    const plan = (await call(trace, "isopleth_minimum_intervention", { book })) as { plan: { ok: boolean; reason?: string; value?: Array<{ actions: Array<{ kind: string; target?: string; amountUsd: number }>; interventionCostUsd: number; residualCrossMarginRate: number }> } };
    if (plan.plan.ok && plan.plan.value && plan.plan.value[0]) {
      const p = plan.plan.value[0];
      answer.push(`Smallest move that returns the stressed book inside 80%: ${p.actions.map((a) => `${a.kind}${a.target ? ` (${a.target})` : ""} ${usd(a.amountUsd)}`).join(" + ")}, leaving a cross margin rate of ${pct(p.residualCrossMarginRate)}. This is advisory only; nothing is placed.`);
    } else {
      answer.push(`No plan found within the search limits: ${plan.plan.reason ?? "none"}.`);
    }
  } else if (shock.reference !== undefined || shock.mark !== undefined) {
    route = "what-if";
    const out = await evalWith(shock);
    const label = [shock.reference !== undefined ? `reference ${shock.reference > 0 ? "+" : ""}${shock.reference}%` : null, shock.mark !== undefined ? `crypto ${shock.mark > 0 ? "+" : ""}${shock.mark}%` : null].filter(Boolean).join(" and ");
    answer.push(describe("Now", out.result));
    answer.push(describe(`If ${label}`, out.shockedResult));
  } else {
    route = "state";
    const out = await evalWith({});
    answer.push(describe("Your book", out.result));
    answer.push("Ask where it breaks first, what if the reference or crypto marks move by some percent, the smallest move that keeps it safe, or how frozen the reference clock is.");
  }

  return { ok: true, route, answer, trace, receipt, thesis: thesis.trim() ? thesis.trim().slice(0, 200) : null };
}
