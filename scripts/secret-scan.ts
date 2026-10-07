// Phase G: automated secret-exposure scan (previously done by hand only,
// see PROGRESS.md 2026-10-07 - live Bitget credentials once sat in a
// tracked .env.example). Scans every git-tracked file for credential-shaped
// strings; exits non-zero and prints every hit if it finds one. Never
// touches gitignored files - those are out of scope by definition, but a
// tracked file carrying a real-looking secret fails the build.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "generic API key assignment with a long value", re: /(API_KEY|SECRET|ACCESS_KEY|PRIVATE_KEY)\s*[=:]\s*["']?[A-Za-z0-9/_\-+.]{20,}["']?/ },
  { name: "AWS access key ID", re: /AKIA[0-9A-Z]{16}/ },
  { name: "Bitget-style bg_ prefixed key", re: /\bbg_[a-f0-9]{24,}\b/i },
  { name: "PEM private key block", re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/ },
  { name: "generic bearer token", re: /\bBearer [A-Za-z0-9\-._~+/]{30,}\b/ },
];

const ALLOWLIST_FILES = new Set(["scripts/secret-scan.ts", ".env.example"]);

function trackedFiles(): string[] {
  return execSync("git ls-files", { encoding: "utf8" })
    .split("\n")
    .filter((f) => f.length > 0 && !f.startsWith("reference/"));
}

function looksLikePlaceholder(line: string): boolean {
  return /your[_-]?|example|placeholder|xxxx|\.\.\.|<[^>]+>|changeme/i.test(line);
}

function main() {
  const hits: Array<{ file: string; line: number; pattern: string; snippet: string }> = [];

  for (const file of trackedFiles()) {
    if (ALLOWLIST_FILES.has(file)) continue;
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue; // binary or unreadable - not a text secret carrier
    }
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!;
      if (looksLikePlaceholder(line)) continue;
      for (const { name, re } of PATTERNS) {
        if (re.test(line)) hits.push({ file, line: i + 1, pattern: name, snippet: line.trim().slice(0, 120) });
      }
    }
  }

  if (hits.length > 0) {
    console.error(`[secret-scan] FAIL - ${hits.length} potential secret(s) found in tracked files:\n`);
    for (const h of hits) console.error(`  ${h.file}:${h.line} [${h.pattern}] ${h.snippet}`);
    process.exit(1);
  }

  console.log(`[secret-scan] PASS - ${trackedFiles().length} tracked files scanned, 0 hits.`);
}

main();
