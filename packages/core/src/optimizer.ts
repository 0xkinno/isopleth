// Minimum-intervention optimizer: deterministic grid search over candidate
// actions. Advisory only - never executes a trade. Returns the top 3 plans
// by intervention cost, each with the full trace needed for evidence
// reversibility (I8). See FINAL_INSTRUCTION.md section 6.5.
import { evaluate } from "./margin";
import type { Book, MarginResult, Outcome } from "./types";

export type ActionKind = "ADD_CASH" | "REDUCE_POSITION" | "REDUCE_LEVERAGE" | "CONVERT_RTOKEN_TO_CASH";

export interface Action {
  kind: ActionKind;
  target?: string; // position symbol or collateral coin, when applicable
  amountUsd: number; // the cost of this action, in USD, used as the objective
}

export interface Plan {
  actions: Action[];
  interventionCostUsd: number;
  residualCrossMarginRate: number;
  trace: MarginResult;
}

function applyAction(book: Book, a: Action): Book {
  switch (a.kind) {
    case "ADD_CASH":
      return { ...book, cashUsd: book.cashUsd + a.amountUsd };
    case "REDUCE_POSITION": {
      const positions = book.positions.map((p) => {
        if (p.symbol !== a.target) return p;
        const reduceQty = Math.min(p.qty, a.amountUsd / p.markUsd);
        return { ...p, qty: p.qty - reduceQty };
      });
      return { ...book, positions };
    }
    case "REDUCE_LEVERAGE": {
      // Equivalent effect to REDUCE_POSITION here: the kernel has no separate
      // leverage field, so "reduce leverage" means shrinking the position
      // notional, same mechanism, kept distinct for presentation purposes.
      return applyAction(book, { ...a, kind: "REDUCE_POSITION" });
    }
    case "CONVERT_RTOKEN_TO_CASH": {
      const collateral = book.collateral.map((c) => {
        if (c.coin !== a.target || c.referenceUsd === null) return c;
        const sellQty = Math.min(c.qty, a.amountUsd / c.referenceUsd);
        return { ...c, qty: c.qty - sellQty };
      });
      // the haircut is already encoded in the tier rates (documented, not
      // assumed) - selling at reference price and crediting the proceeds as
      // cash 1:1 is the correct modelled effect of a sale, not a shortcut.
      return { ...book, collateral, cashUsd: book.cashUsd + a.amountUsd };
    }
  }
}

function candidateActions(book: Book, stepUsd: number, maxUsd: number): Action[] {
  const actions: Action[] = [];
  for (let amt = stepUsd; amt <= maxUsd; amt += stepUsd) {
    actions.push({ kind: "ADD_CASH", amountUsd: amt });
    for (const p of book.positions) actions.push({ kind: "REDUCE_POSITION", target: p.symbol, amountUsd: amt });
    for (const c of book.collateral) actions.push({ kind: "CONVERT_RTOKEN_TO_CASH", target: c.coin, amountUsd: amt });
  }
  return actions;
}

/**
 * Grid-search the minimum-cost action (or pair of actions) that brings
 * crossMarginRate at or below `thresholdRate` for the given (already
 * scenario-shocked) book. Returns the top 3 plans found, cheapest first.
 */
export function minimumIntervention(
  shockedBook: Book,
  thresholdRate: number,
  opts: { stepUsd?: number; maxUsd?: number } = {},
): Outcome<Plan[]> {
  const stepUsd = opts.stepUsd ?? 500;
  const maxUsd = opts.maxUsd ?? 50_000;

  const singles = candidateActions(shockedBook, stepUsd, maxUsd);
  const plans: Plan[] = [];

  for (const a of singles) {
    const candidate = applyAction(shockedBook, a);
    const r = evaluate(candidate);
    if (r.ok && r.value.crossMarginRate <= thresholdRate) {
      plans.push({ actions: [a], interventionCostUsd: a.amountUsd, residualCrossMarginRate: r.value.crossMarginRate, trace: r.value });
    }
  }

  if (plans.length === 0) {
    // try the smallest valid PAIR of two actions, capped at a coarser step to bound the search
    const coarseStep = stepUsd * 2;
    const coarse = candidateActions(shockedBook, coarseStep, maxUsd / 2);
    outer: for (const a of coarse) {
      for (const b of coarse) {
        const cost = a.amountUsd + b.amountUsd;
        if (cost >= maxUsd) continue;
        const candidate = applyAction(applyAction(shockedBook, a), b);
        const r = evaluate(candidate);
        if (r.ok && r.value.crossMarginRate <= thresholdRate) {
          plans.push({ actions: [a, b], interventionCostUsd: cost, residualCrossMarginRate: r.value.crossMarginRate, trace: r.value });
          if (plans.length >= 20) break outer; // enough candidates to rank from
        }
      }
    }
  }

  if (plans.length === 0) {
    return { ok: false, reason: "no single or paired action within the search bounds restores the threshold", field: "optimizer" };
  }

  plans.sort((x, y) => x.interventionCostUsd - y.interventionCostUsd);
  return { ok: true, value: plans.slice(0, 3) };
}
