// PUBLIC Bitget UTA v3 market data only. No API key, no signing, no account.
// Base domain confirmed against Bitget's published v3 UTA REST surface
// (api.bitget.com/api/v3/market/*). See docs/sources/ for the fetched pages.

const BASE_URL = "https://api.bitget.com";

export class BitgetPublicApiError extends Error {
  constructor(
    public readonly path: string,
    public readonly status: number | null,
    public readonly body: unknown,
  ) {
    super(`Bitget public GET ${path} failed: status=${status ?? "network-error"}`);
    this.name = "BitgetPublicApiError";
  }
}

export interface BitgetEnvelope<T = unknown> {
  code?: string;
  msg?: string;
  requestTime?: number;
  data: T;
}

/**
 * GET a public (unauthenticated) Bitget v3 market endpoint.
 * Never throws on a well-formed non-2xx API error envelope (code !== "00000"):
 * callers get the parsed envelope back and decide how to fail closed (I5).
 * Throws BitgetPublicApiError only on transport failure or unparseable body,
 * since there is nothing safe to hand back in that case.
 */
export async function bitgetPublicGet<T = unknown>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  init: { timeoutMs?: number; retries?: number } = {},
): Promise<BitgetEnvelope<T>> {
  const { timeoutMs = 10_000, retries = 2 } = init;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const url = `${BASE_URL}${path}${qs.size > 0 ? `?${qs.toString()}` : ""}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new BitgetPublicApiError(path, res.status, text.slice(0, 500));
      }
      if (!res.ok) {
        // Still return the parsed envelope when we have one: upstream callers
        // (the recorder) must record what Bitget actually said, not swallow it.
        if (parsed && typeof parsed === "object") {
          return parsed as BitgetEnvelope<T>;
        }
        throw new BitgetPublicApiError(path, res.status, parsed);
      }
      return parsed as BitgetEnvelope<T>;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastErr instanceof BitgetPublicApiError) throw lastErr;
  throw new BitgetPublicApiError(path, null, lastErr instanceof Error ? lastErr.message : String(lastErr));
}
