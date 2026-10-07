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
  MSTR: "microstrategy",
};

// Simple Icons has no Amazon mark at all (delisted library-wide, not just a
// missing slug - verified 2026-10-07 against amazon/amazonaws/amazonalexa,
// all 404, while unrelated slugs like twitch/imdb return 200 on the same
// CDN). Amazon's real smile-arrow mark is served locally instead, sourced
// from the Homarr dashboard-icons project (MIT-licensed SVG set).
const LOCAL_ICON: Record<string, string> = {
  AMZN: "/icons/amzn.svg",
};

/** Returns a logo URL for a ticker (local asset or Simple Icons CDN), or null if no verified mapping exists. */
export function logoUrlFor(underlying: string): string | null {
  const ticker = underlying.toUpperCase();
  if (LOCAL_ICON[ticker]) return LOCAL_ICON[ticker];
  const slug = TICKER_SLUG[ticker];
  return slug ? `https://cdn.simpleicons.org/${slug}` : null;
}
