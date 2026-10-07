# E4 pre-registered analysis rule

Written 2026-10-05, before any replay of window candle data has run. This file
is the commitment: the rule below must not change after results are seen. If
it needs to change, that is a new pre-registration with a new date, and the
old one stays in history, not edited away.

## Definitions

- `G_w` = `log(first post-thaw reference print / frozen anchor)`, per rToken,
  per closed window in `data/windows/window-set.json`.
- "Shadow predictor" = the weekend/holiday rToken **spot** price move over the
  same closed window (available because rToken spot keeps trading on
  weekends via platform liquidity for selected assets, F10), used to predict
  `G_w` before the stock-perp reference print actually reopens.

## The rule (fixed before running)

The shadow predictor is published as **informative** only if both hold:

1. Leave-one-window-out mean absolute error of the shadow predictor beats the
   null predictor (always predict zero gap) by **>= 20%**.
2. The shadow predictor beats a permuted-shadow control (shadow values
   randomly reassigned across windows) at **p < 0.05** over **10,000**
   permutations.

If either fails, the shadow predictor is dropped. We publish the empirical
distribution of `G_w` alone, state N explicitly, and say plainly that the
sample is small.

## What would make this claim false

- The shadow predictor's LOO-MAE improvement over the null falls under 20%.
- The permutation test p-value is >= 0.05.
- N is small enough (the window count depends on how long E1 has been
  recording before submission) that any "beats null" result is not
  distinguishable from noise - if so, say that instead of overclaiming.

## Status

Not yet run. Blocked on: (a) enough elapsed closed-market windows actually
observed by the E1 recorder to have real `G_w` values, not just the calendar
scaffold in `data/windows/window-set.json`, and (b) live Bitget connectivity
to fetch rToken/stock-perp candles per window (see PROGRESS.md for the
connectivity issue affecting this environment).
