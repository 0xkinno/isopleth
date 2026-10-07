// Maps an underlying ticker to a brand icon via Simple Icons' free, keyless
// CDN (cdn.simpleicons.org/{slug}) - SVG brand marks, no API key, no
// hotlinking restrictions. Every slug below was verified live (HTTP 200)
// on 2026-10-07; unmapped tickers simply render no logo (never a guessed,
// possibly-wrong one, and never an unverified slug that might 404 silently).
const TICKER_SLUG: Record<string, string> = {
  TSLA: "tesla",
  NVDA: "nvidia",
  AAPL: "apple",
  GOOGL: "google",
  META: "meta",
  NFLX: "netflix",
  MCD: "mcdonalds",
  COIN: "coinbase",
  CRCL: "circle",
  HOOD: "robinhood",
  ARM: "arm",
  INTC: "intel",
  PLTR: "palantir",
  AMD: "amd",
  QCOM: "qualcomm",
  UBER: "uber",
  SHOP: "shopify",
  PYPL: "paypal",
  SNOW: "snowflake",
  DELL: "dell",
  GS: "goldmansachs",
  BAC: "bankofamerica",
  KO: "cocacola",
  NKE: "nike",
  BA: "boeing",
  SONY: "sony",
  ABNB: "airbnb",
  SPOT: "spotify",
  RBLX: "roblox",
  DDOG: "datadog",
  NET: "cloudflare",
  ZM: "zoom",
  GTLB: "gitlab",
  TEAM: "atlassian",
  MDB: "mongodb",
  OKTA: "okta",
};

/** Returns a Simple Icons logo URL for a ticker, or null if no verified mapping exists. */
export function logoUrlFor(underlying: string): string | null {
  const slug = TICKER_SLUG[underlying.toUpperCase()];
  return slug ? `https://cdn.simpleicons.org/${slug}` : null;
}
