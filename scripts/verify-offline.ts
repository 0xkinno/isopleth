// pnpm verify:offline (FINAL_INSTRUCTION.md section 11): recomputes every
// published result from stored inputs, with NO network and NO model, checks
// every hash, and prints PASS or FAIL per check with counts. CI runs this on
// every push - it is the thing that catches a published number drifting
// from what the kernel actually produces.
//
// Deliberately imports nothing that can reach the network: no
// packages/data/src/client.ts (Bitget), no packages/llm driver construction
// beyond the pure, local bindNumbers/extractNumbers guard functions.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { evaluate, resultHash } from "@isopleth/core";
import { bindNumbers } from "@isopleth/llm";
import { parseJsonlChain, verifyChain } from "../packages/data/src/chainVerify";
import { guardRTokenCandleType } from "../packages/data/src/guards";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const checks: Check[] = [];
function check(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
}

async function sha256File(path: string): Promise<string | null> {
  try {
    return createHash("sha256").update(await readFile(path)).digest("hex");
  } catch {
    return null;
  }
}

async function checkGolden() {
  let golden: Record<string, { book: unknown; expectedHash: string }>;
  try {
    golden = JSON.parse(await readFile("data/verify/golden.json", "utf8"));
  } catch {
    check("golden-kernel-recompute", false, "data/verify/golden.json missing - run `pnpm verify:build-golden` once");
    return;
  }
  let allOk = true;
  const mismatches: string[] = [];
  for (const [name, { book, expectedHash }] of Object.entries(golden)) {
    const r = evaluate(book as Parameters<typeof evaluate>[0]);
    if (!r.ok) {
      allOk = false;
      mismatches.push(`${name}: kernel now REFUSES (${r.reason}) - was expected to compute`);
      continue;
    }
    const actual = resultHash(book, r.value);
    if (actual !== expectedHash) {
      allOk = false;
      mismatches.push(`${name}: hash drifted (expected ${expectedHash.slice(0, 12)}, got ${actual.slice(0, 12)})`);
    }
  }
  check("golden-kernel-recompute", allOk, allOk ? `${Object.keys(golden).length}/${Object.keys(golden).length} fixtures byte-identical to their recorded hash` : mismatches.join("; "));
}

async function checkClockChain() {
  let raw: string;
  try {
    raw = await readFile("data/clock/raw/e1.jsonl", "utf8");
  } catch {
    check("clock-hash-chain", false, "data/clock/raw/e1.jsonl not present in this checkout");
    return;
  }
  const records = parseJsonlChain(raw);
  const result = verifyChain(records);
  check("clock-hash-chain", result.ok, result.ok ? `${result.total} records, chain intact` : `${result.brokenAt.length} break(s) at indices ${result.brokenAt.slice(0, 10).join(",")}`);
}

async function checkManifestHashes() {
  let manifest: { fileHashes: Record<string, string> };
  try {
    manifest = JSON.parse(await readFile("data/manifests/run_manifest.json", "utf8"));
  } catch {
    check("manifest-file-hashes", false, "data/manifests/run_manifest.json missing - run `pnpm manifest` first");
    return;
  }
  const mismatches: string[] = [];
  for (const [path, expected] of Object.entries(manifest.fileHashes)) {
    if (expected === "MISSING") continue;
    const actual = await sha256File(path);
    if (actual !== expected) mismatches.push(`${path}: expected ${expected.slice(0, 12)}, got ${actual?.slice(0, 12) ?? "FILE MISSING"}`);
  }
  check("manifest-file-hashes", mismatches.length === 0, mismatches.length === 0 ? `${Object.keys(manifest.fileHashes).length} result file(s) match the last manifest run` : mismatches.join("; "));
}

function checkNumberBindingGuard() {
  const facts = [1234.5, 0.802, 99];
  const clean = bindNumbers("Your rate is 80.20% on $1234.50 of equity.", facts);
  const invented = bindNumbers("Your rate is 80.20% but liquidation triggers at 7777777.", facts);
  const ok = clean.ok && !invented.ok && invented.orphans.includes(7777777);
  check("number-binding-guard", ok, ok ? "bound narration accepted, invented number rejected" : `unexpected: clean.ok=${clean.ok} invented.ok=${invented.ok}`);
}

function checkFallbackGuard() {
  let threw = false;
  try {
    guardRTokenCandleType("index");
  } catch {
    threw = true;
  }
  check("f8-fallback-guard", threw, threw ? "guardRTokenCandleType throws on type=index, as required by the confirmed F8 trap" : "guard failed to throw");
}

async function main() {
  await checkGolden();
  await checkClockChain();
  await checkManifestHashes();
  checkNumberBindingGuard();
  checkFallbackGuard();

  const passed = checks.filter((c) => c.ok).length;
  console.log(`[verify:offline] ${passed}/${checks.length} checks passed, no network, no model\n`);
  for (const c of checks) console.log(`  ${c.ok ? "PASS" : "FAIL"} ${c.name}: ${c.detail}`);

  if (passed !== checks.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error("[verify:offline] fatal:", e);
  process.exitCode = 1;
});
