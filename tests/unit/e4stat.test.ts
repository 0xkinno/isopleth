import { describe, expect, it } from "vitest";
import { evaluatePreRegisteredRule } from "@isopleth/core";

describe("E4 pre-registered rule", () => {
  it("reports insufficientN rather than running LOO/permutation stats on N<2", () => {
    const r0 = evaluatePreRegisteredRule([]);
    expect(r0.insufficientN).toBe(true);
    expect(r0.informative).toBe(false);

    const r1 = evaluatePreRegisteredRule([{ gW: 0.01, shadow: 0.01 }]);
    expect(r1.insufficientN).toBe(true);
  });

  it("finds a perfectly linear shadow predictor informative", () => {
    const obs = Array.from({ length: 12 }, (_, i) => ({ shadow: (i - 6) * 0.004, gW: (i - 6) * 0.004 }));
    const r = evaluatePreRegisteredRule(obs, 2000, 1);
    expect(r.n).toBe(12);
    expect(r.passesLooThreshold).toBe(true);
    expect(r.informative).toBe(true);
    expect(r.permutationPValue).toBeLessThan(0.05);
  });

  it("finds pure noise (shadow unrelated to gW) NOT informative", () => {
    // Fixed, deliberately uncorrelated series (shadow is gW read backwards and
    // negated) - large enough N that this isn't an accident of one unlucky draw.
    const gWs = [0.012, -0.031, 0.004, 0.027, -0.009, 0.018, -0.022, 0.001, 0.015, -0.006, 0.029, -0.013, 0.008, -0.019, 0.003, -0.025];
    const obs = gWs.map((gW, i) => ({ gW, shadow: -gWs[gWs.length - 1 - i]! }));
    const r = evaluatePreRegisteredRule(obs, 2000, 7);
    expect(r.n).toBe(16);
    expect(r.informative).toBe(false);
  });
});
