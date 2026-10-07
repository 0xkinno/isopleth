// Number-binding guard (I6): every number in any LLM narration must already
// exist in the kernel's result set. The LLM explains; it never computes.
// Driver-independent by construction - it operates on text + a facts array,
// never on which driver produced the text. See the cross-driver test in
// tests/unit/number-binding.test.ts for the evidence that this holds.
export function extractNumbers(text: string): number[] {
  return (text.match(/-?\$?\d[\d,]*\.?\d*%?/g) ?? [])
    .map((s) => Number(s.replace(/[$,%]/g, "").replace(/,/g, "")))
    .filter(Number.isFinite);
}

export function bindNumbers(text: string, facts: readonly number[], tol = 0.005): { ok: boolean; orphans: number[] } {
  const orphans = extractNumbers(text).filter(
    (n) => !facts.some((f) => Math.abs(f - n) <= Math.max(tol, Math.abs(f) * tol) || Math.abs(f * 100 - n) <= tol),
  );
  return { ok: orphans.length === 0, orphans };
}
