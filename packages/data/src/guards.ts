// Hard guards against known Bitget API traps. Each guard corresponds to a
// named UNKNOWN/invariant in FINAL_INSTRUCTION.md and exists so a future code
// path cannot reintroduce a bug that was already found and proven once.

/**
 * F8 / E3: rToken candle requests only support `type=market`. Requesting
 * `type=index`, `mark` or `premium` silently returns `market` data with no
 * error - there is nothing in the response shape that distinguishes it.
 * Any code path that wants a *reference* price series for an rToken MUST NOT
 * read it off a candle endpoint at all; it must come from the Collateral
 * Clock (E1, the stock-perp `indexPrice`) instead. This function exists so
 * that intent is enforced at the type/call level, not just in a comment.
 */
export function assertNotUsedAsReferenceIndex(source: "rtoken-candle"): never {
  throw new Error(
    `[guard] rToken candle data (source="${source}") can never be treated as a reference index: ` +
      "Bitget silently serves type=market for any requested candle type on rToken symbols (F8, confirmed by E3). " +
      "Use the Collateral Clock (E1 stock-perp indexPrice) for reference-state data instead.",
  );
}

/**
 * Call this at the single point where rToken candle `type` requests are
 * constructed, so any future code asking for `index`/`mark`/`premium` fails
 * loudly instead of silently receiving `market` data under a different name.
 */
export function guardRTokenCandleType(requestedType: string): "market" {
  if (requestedType !== "market") {
    throw new Error(
      `[guard] rToken candles only support type=market (F8). Requested type="${requestedType}" would silently ` +
        "be served as market data by Bitget with no error - refusing instead of pretending it is a reference index.",
    );
  }
  return "market";
}

/**
 * I7: Isopleth only ever needs read access. Any API key whose permission list
 * contains anything other than a read-only grant (trade, withdraw, transfer, or
 * any permission string it does not recognise) is refused at boot. Fails
 * closed: an unknown permission is treated as dangerous.
 */
const READ_ONLY_GRANTS = new Set(["read", "readonly", "read-only", "read_only", "reads"]);
export function assertReadOnlyKey(permissions: readonly string[]): void {
  if (permissions.length === 0) {
    throw new Error("[guard] key permission list is empty or unreadable - refusing (fail closed, I7).");
  }
  const offending = permissions.filter((p) => !READ_ONLY_GRANTS.has(p.trim().toLowerCase()));
  if (offending.length > 0) {
    throw new Error(`[guard] refusing a key with non-read-only permission(s): ${offending.join(", ")} (I7). Isopleth never trades; create a read-only key.`);
  }
}
