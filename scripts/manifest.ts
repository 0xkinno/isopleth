// pnpm manifest (FINAL_INSTRUCTION.md section 11): git commit, SHA-256 of
// every results file, Node version, lockfile hash, engine version, timestamp.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { ENGINE_VERSION } from "@isopleth/core";

const RESULT_FILES = [
  "data/clock/clock-map.json",
  "data/clock/e3-fallback-trap.json",
  "data/break/results.json",
  "data/windows/window-set.json",
  "CLAIMS.json",
];

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function gitCommit(): string {
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch {
    return "UNCOMMITTED";
  }
}

async function main() {
  const hashes: Record<string, string> = {};
  for (const f of RESULT_FILES) {
    try {
      hashes[f] = sha256(await readFile(f));
    } catch {
      hashes[f] = "MISSING";
    }
  }

  const lockfile = await readFile("pnpm-lock.yaml").catch(() => Buffer.from(""));

  const manifest = {
    generatedAt: new Date().toISOString(),
    gitCommit: gitCommit(),
    nodeVersion: process.version,
    engineVersion: ENGINE_VERSION,
    lockfileHash: sha256(lockfile),
    fileHashes: hashes,
  };

  await mkdir("data/manifests", { recursive: true });
  await writeFile("data/manifests/run_manifest.json", JSON.stringify(manifest, null, 2));
  console.log(`[manifest] -> data/manifests/run_manifest.json (commit ${manifest.gitCommit.slice(0, 12)})`);
}

main().catch((e) => {
  console.error("[manifest] fatal:", e);
  process.exitCode = 1;
});
