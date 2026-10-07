// Standalone hash-chain integrity verifier for the E1 Collateral Clock log
// (data/clock/raw/e1.jsonl). Recomputes every record's hash from scratch
// using the exact same rule tick.ts writes with (sha256(prevHash +
// canonicalJson(body))) and checks the prevHash linkage between consecutive
// records. Used by both `pnpm break` (B8) and `pnpm verify:offline`.
import { createHash } from "node:crypto";
import { canonicalJson } from "./tick";

export interface ChainRecord {
  prevHash: string;
  hash: string;
  [k: string]: unknown;
}

export interface ChainVerifyResult {
  ok: boolean;
  total: number;
  brokenAt: number[]; // 0-based line indices where hash or linkage mismatched
}

export function recomputeHash(prevHash: string, record: ChainRecord): string {
  const { prevHash: _p, hash: _h, ...body } = record;
  return createHash("sha256").update(prevHash + canonicalJson(body)).digest("hex");
}

/** Pure function over already-parsed records - no file I/O, so it is directly unit-testable and reusable by both the break campaign and the offline verifier. */
export function verifyChain(records: ChainRecord[]): ChainVerifyResult {
  const brokenAt: number[] = [];
  let prev = records.length > 0 ? records[0]!.prevHash : "GENESIS";
  for (let i = 0; i < records.length; i += 1) {
    const r = records[i]!;
    if (r.prevHash !== prev) {
      brokenAt.push(i);
    } else if (recomputeHash(prev, r) !== r.hash) {
      brokenAt.push(i);
    }
    prev = r.hash;
  }
  return { ok: brokenAt.length === 0, total: records.length, brokenAt };
}

export function parseJsonlChain(raw: string): ChainRecord[] {
  return raw
    .trimEnd()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as ChainRecord);
}
