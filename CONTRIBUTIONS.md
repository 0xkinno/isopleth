# CONTRIBUTIONS.md

Traps and findings worth documenting for anyone else building against the
Bitget UTA v3 API, independent of whether they're entering this hackathon.
Not a changelog — see `PROGRESS.md` for that.

## The rToken candle silent-fallback trap (F8, confirmed E3)

**What happens:** `GET /api/v3/market/candles?category=SPOT&symbol=<rTOKEN>&type=index`
(or `type=mark`, `type=premium`) does **not** error, and does **not** return
an empty result. It silently returns exactly the same data as
`type=market` — byte-identical arrays, confirmed live against `RTSLAUSDT` on
2026-10-05 (evidence: `data/clock/e3-fallback-trap.json`).

**Why this is a real trap, not a minor quirk:** if you are building anything
that needs a *reference-price* time series for an rToken — a backtest, a
risk model, a chart labelled "index price" — the naive approach is to request
`type=index` candles and trust the label. Nothing in the response tells you
it silently became market data. Your reference series is quietly wrong, with
no error, no warning, and no shape difference to detect it by (same fields,
same array length, same timestamps).

**What we did about it:** this is architecturally guarded, not just
documented. `packages/data/src/guards.ts` exposes
`guardRTokenCandleType(requestedType)`, which throws if anything other than
`"market"` is requested for an rToken candle call, and
`assertNotUsedAsReferenceIndex()` for the symmetric case of trying to *use*
candle data as a reference index after the fact. Any future code path in
this repo that tries to reintroduce this bug fails loudly at the call site
instead of silently producing wrong numbers three layers downstream.

**The actual fix for anyone hitting this:** don't use rToken candles for
reference-price data at all. Use the futures ticker's `indexPrice` field
(public, no key, `GET /api/v3/market/tickers?category=USDT-FUTURES&symbol=<PERP>`)
sampled over time instead — that's what this project's Collateral Clock (E1)
does.

## The v3 discount-rate endpoint's actual shape (undocumented as of this writing)

Public documentation for `/api/v2/mix/market/discount-rate` describes a
no-parameter call returning every coin's ladder. It was not obvious this
shape would hold for `/api/v3/market/discount-rate` — v3 UTA endpoints
elsewhere in this project required per-symbol/per-category parameters where
v2 didn't. We built the capture script to try the bulk no-param call first
and fall back to per-coin calls only if that came back empty, logging which
strategy actually worked rather than assuming either shape. For the record:
**the bulk no-param call works in v3 too**, returning 520 entries in one
request as of 2026-10-05.
