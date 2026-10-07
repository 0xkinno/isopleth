// The E4 pre-registered analysis rule (data/windows/pre-registration.md),
// implemented exactly as written BEFORE any replay ran - this file must
// never be edited to make a result look better after the fact. Pure
// functions over an array of { gW, shadow } pairs so they are directly
// unit-testable without any file I/O.

export interface WindowObservation {
  gW: number;
  shadow: number;
}

function mae(residuals: number[]): number {
  return residuals.reduce((s, r) => s + Math.abs(r), 0) / residuals.length;
}

/** Leave-one-window-out MAE of "predict shadow * beta" where beta is fit on the other N-1 windows by least squares through the origin. */
export function looMae(obs: WindowObservation[]): number {
  const residuals: number[] = [];
  for (let i = 0; i < obs.length; i += 1) {
    const rest = obs.filter((_, j) => j !== i);
    const num = rest.reduce((s, o) => s + o.shadow * o.gW, 0);
    const den = rest.reduce((s, o) => s + o.shadow * o.shadow, 0);
    const beta = den === 0 ? 0 : num / den;
    residuals.push(obs[i]!.gW - beta * obs[i]!.shadow);
  }
  return mae(residuals);
}

export function nullMae(obs: WindowObservation[]): number {
  return mae(obs.map((o) => o.gW)); // null predictor: always predict zero gap
}

/** Deterministic PRNG (mulberry32) so a permutation test is reproducible given a fixed seed. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export interface PreRegisteredResult {
  n: number;
  shadowLooMae: number;
  nullMae: number;
  looImprovementPct: number; // (nullMae - shadowLooMae) / nullMae * 100
  permutationPValue: number;
  permutations: number;
  passesLooThreshold: boolean; // >= 20%
  passesPermutationThreshold: boolean; // p < 0.05
  informative: boolean; // both pass
  insufficientN: boolean; // n < 2, cannot even define LOO
}

/** The rule from data/windows/pre-registration.md, verbatim: >=20% LOO-MAE improvement over the null AND p<0.05 over 10,000 permutations. */
export function evaluatePreRegisteredRule(obs: WindowObservation[], permutations = 10_000, seed = 42): PreRegisteredResult {
  if (obs.length < 2) {
    return {
      n: obs.length,
      shadowLooMae: NaN,
      nullMae: obs.length === 1 ? Math.abs(obs[0]!.gW) : NaN,
      looImprovementPct: NaN,
      permutationPValue: NaN,
      permutations: 0,
      passesLooThreshold: false,
      passesPermutationThreshold: false,
      informative: false,
      insufficientN: true,
    };
  }

  const shadowLooMae = looMae(obs);
  const nMae = nullMae(obs);
  const looImprovementPct = ((nMae - shadowLooMae) / nMae) * 100;

  const rand = mulberry32(seed);
  const gWs = obs.map((o) => o.gW);
  let atLeastAsGood = 0;
  for (let p = 0; p < permutations; p += 1) {
    const permutedShadows = shuffle(obs.map((o) => o.shadow), rand);
    const permuted = obs.map((o, i) => ({ gW: o.gW, shadow: permutedShadows[i]! }));
    void gWs;
    if (looMae(permuted) <= shadowLooMae) atLeastAsGood += 1;
  }
  const permutationPValue = (atLeastAsGood + 1) / (permutations + 1); // +1/+1: never report p=0 from a finite simulation

  const passesLooThreshold = looImprovementPct >= 20;
  const passesPermutationThreshold = permutationPValue < 0.05;

  return {
    n: obs.length,
    shadowLooMae,
    nullMae: nMae,
    looImprovementPct,
    permutationPValue,
    permutations,
    passesLooThreshold,
    passesPermutationThreshold,
    informative: passesLooThreshold && passesPermutationThreshold,
    insufficientN: false,
  };
}
