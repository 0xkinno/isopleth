// Deterministic serialization + hashing (I4): same serialized inputs +
// ruleset + engine version must produce an identical output hash.
import { createHash } from "node:crypto";

export const ENGINE_VERSION = "0.1.0";

export function canonicalJson(o: unknown): string {
  return JSON.stringify(o, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

export function resultHash(input: unknown, result: unknown): string {
  return createHash("sha256")
    .update(canonicalJson({ engineVersion: ENGINE_VERSION, input, result }))
    .digest("hex");
}
