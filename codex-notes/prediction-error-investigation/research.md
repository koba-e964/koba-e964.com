# Prediction Error Investigation

## Relevant files

- `fund-price-forecast/backend/src/domain/predict.ts`
- `fund-price-forecast/backend/src/jobs.ts`
- `fund-price-forecast/backend/src/db.ts`
- `fund-price-forecast/backend/src/sources/yahoo.ts`
- `fund-price-forecast/backend/src/sources/mufg.ts`
- `fund-price-forecast/backend/src/sources/emaxis.ts`
- `fund-price-forecast/backend/src/types.ts`

## Current execution flow

1. `runIngestFundNav()` fetches official NAV and stores one row per `fund_code + business_date`.
2. `runIngestMarketData()` fetches Yahoo `^GSPC` and MUFG/MURC TTM and stores one row per date.
3. `runRecomputePredictions()` selects the latest official NAV row, chooses a target business date, builds a `PredictionInput`, and calls `buildPrediction()`.
4. `buildPrediction()` computes:
   - `predicted_nav = base_nav * index_ratio * fx_ratio * fee_factor`
5. `readPublicData` exposes the latest official NAV, latest prediction, latest sources, and history rows.

## Current formula and invariants

The formula is in `fund-price-forecast/backend/src/domain/predict.ts`.

- `baseNav = input.baseNav.nav`
- `indexRatio = targetIndex.closeValue / baseIndex.closeValue`
- `fxRatio = targetFx.ttm / baseFx.ttm`
- `feeFactor = 1` for one day, otherwise `(1 - annualFeeRate)^(days/365)`

Important invariant:

- The model only uses:
  - official NAV
  - Yahoo `^GSPC` close
  - USD/JPY TTM midpoint

It does not use:

- dividend-adjusted total return index
- any explicit fund-level tracking error model
- any same-day intraday market proxy
- any accounting lag correction beyond the selected dates

## Latest target-date behavior

The latest prediction path in `fund-price-forecast/backend/src/jobs.ts` now prefers:

- the latest TTM `business_date` when it is newer than the latest official NAV date
- otherwise `nextBusinessDate(baseNavBusinessDate)`

This aligns the latest estimate with the day for which TTM has just been published.

For historical rebuilds:

- `runRecomputeAllPredictions()` now picks the first later TTM date after each official NAV date
- then rebuilds the prediction for that target date

## Live production observation

Using `payload:check` against production, one recent pair was:

- official NAV: `41981` for `2026-04-28`
- estimated NAV for the same date in history: `41724.53`

Inputs used for that estimate:

- base NAV: `41935`
- base index: `7173.91`
- target index: `7138.8`
- base TTM: `159.56`
- target TTM: `159.54`

So the estimate was mechanically:

`41935 * (7138.8 / 7173.91) * (159.54 / 159.56)`

This is internally consistent with the current code.

## Most likely source of the remaining error

The largest remaining issue is not an implementation bug in the arithmetic itself. It is a model mismatch:

- The fund is effectively closer to a dividend-included yen-converted benchmark.
- The current source for equities is Yahoo `^GSPC`, which is a price index close, not a total-return series.

This means the current `indexRatio` is structurally wrong even if the date handling is correct.

Secondary sources of mismatch:

- official NAV accounting timing may not align exactly with the naive `base date -> first later TTM date` mapping
- TTM midpoint may not be the exact FX convention embedded in the fund’s published NAV
- holidays and U.S./Japan date boundaries create subtle mapping ambiguity

## Error handling / storage patterns

- market, fx, nav, prediction all store one logical row per date key
- predictions are upserted by `(fund_code, business_date, method_version)`
- repeated identical latest predictions are skipped before insert
- history rows are post-processed for UI de-duplication

## Constraints

- We only have stable ingestion for:
  - Yahoo `^GSPC`
  - MUFG/MURC TTM
  - MUFG AM fund NAV JSON
- The current DB schema stores only one market index source table.
- The current UI assumes one displayed prediction formula, not a richer attribution model.

## Architectural conclusion

The day-selection bug was real and has already been corrected locally and deployed.

But the remaining visible gap between estimate and official NAV is most likely caused by using the wrong equity benchmark source, not by a simple off-by-one or timestamp bug.

The next realistic fix is to replace or augment `^GSPC` with a dividend-adjusted source that better matches the fund’s benchmark semantics, then rebuild history under a new `method_version`.

## Unknowns

- Which publicly accessible total-return series is acceptable as the canonical upstream source
- Whether MUFG publishes or references a closer benchmark index directly
- Whether the user wants strict historical comparability preserved by introducing a new `method_version` instead of mutating old rows in place
