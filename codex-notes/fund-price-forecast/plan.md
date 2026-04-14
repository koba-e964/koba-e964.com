# Plan: Fund Price Forecast Site

## Overview

The implementation should be split into four clear layers:

1. Static public frontend hosted on GitHub Pages
2. Collector and calculation backend running on AWS Lambda
3. Neon Postgres for durable source and prediction history
4. A small published data/API surface for the frontend

The frontend remains fund-agnostic in routing and wording where possible, with the initial fund selected by configuration rather than by a hard-coded `sp500` URL path.

The first shipped version should optimize for:

- clear separation between official observed values and modeled estimates
- durable source history outside GitHub
- support for future additional funds without rewriting the site structure
- operational simplicity and low recurring cost

The first version should not claim exact replication of the official fund NAV unless calibration against historical official NAV is implemented and validated.

## Proposed Architecture

### Public site

- Build a static site in a normal frontend toolchain and publish the built output to GitHub Pages.
- Serve the main user-facing page from a neutral route such as:
  - `/`
  - `/fund/253266/`
  - `/funds/253266/`
- Avoid fund names or benchmark names in the URL.
- The frontend fetches read-only JSON from a backend endpoint.

### Backend

- Use AWS Lambda for:
  - source ingestion
  - prediction recalculation
  - optional read API if direct DB exposure is avoided
- Trigger ingestion on a schedule with EventBridge Scheduler.
- Use separate Lambda functions or handlers for:
  - `ingest-market-data`
  - `ingest-fund-nav`
  - `recompute-predictions`
  - `read-public-data`

### Database

- Use Neon Postgres as the system of record.
- Persist raw source observations, normalized business-date data, official fund NAV history, and derived predictions.
- Keep enough provenance to recompute derived values if formulas change.

### Data delivery to frontend

Two viable options:

- Option A: frontend calls a small public read API backed by Lambda
- Option B: scheduled backend writes static JSON snapshots to a public bucket/CDN that the site reads

Preferred initial choice:

- Option A, because it keeps the deployment simpler and makes future multi-fund support easier.

## Files To Change

Expected initial file set:

- `codex-notes/fund-price-forecast/plan.md`
- `.gitignore`
- `.github/workflows/deploy-pages.yml`
- `.jekyllignore` or `_config.yml`
- `.nojekyll` if the final Pages output should bypass Jekyll entirely
- `package.json`
- `package-lock.json` or equivalent lockfile
- `tsconfig.json`
- `vite.config.ts` or equivalent bundler config
- `index.html`
- `src/main.tsx` or `src/main.ts`
- `src/app.tsx` or `src/app.ts`
- `src/styles.css`
- `src/lib/api.ts`
- `src/lib/types.ts`
- `src/lib/format.ts`
- `src/config/funds.ts`
- `src/components/...`
- `backend/package.json`
- `backend/tsconfig.json`
- `backend/src/config.ts`
- `backend/src/db.ts`
- `backend/src/schema.sql` or migration files
- `backend/src/sources/yahoo.ts`
- `backend/src/sources/mufg.ts`
- `backend/src/sources/emaxis.ts`
- `backend/src/domain/predict.ts`
- `backend/src/handlers/ingestMarketData.ts`
- `backend/src/handlers/ingestFundNav.ts`
- `backend/src/handlers/recomputePredictions.ts`
- `backend/src/handlers/readPublicData.ts`
- `backend/infra/...` if infra definitions are added
- `README.md`
- `public/...` if static assets are needed

Exact filenames can shift based on the chosen frontend stack, but the functional boundaries should remain.

## Data Model

### `funds`

- `id`
- `code`
- `slug`
- `display_name`
- `provider_name`
- `source_url`
- `benchmark_kind`
- `annual_fee_rate`
- `currency`
- `active`

Purpose:

- generic registry for current and future funds

### `market_index_daily`

- `trade_date`
- `symbol`
- `close_value`
- `currency`
- `source_name`
- `source_url`
- `fetched_at`
- `raw_payload`

Purpose:

- normalized daily upstream market data

### `fx_daily`

- `business_date`
- `currency_pair`
- `tts`
- `ttb`
- `ttm`
- `source_name`
- `source_url`
- `fetched_at`
- `raw_payload`

Purpose:

- normalized daily FX data with reproducible midpoint

### `fund_nav_daily`

- `fund_id`
- `business_date`
- `nav`
- `nav_change`
- `source_name`
- `source_url`
- `fetched_at`
- `raw_payload`

Purpose:

- official fund values for backfilling, calibration, and display

### `fund_predictions_daily`

- `fund_id`
- `business_date`
- `status`
- `predicted_nav`
- `predicted_from_trade_date`
- `predicted_from_fx_date`
- `used_index_value`
- `used_ttm`
- `fee_adjustment_factor`
- `method_version`
- `confidence_note`
- `computed_at`

Status examples:

- `official`
- `estimated_complete_inputs`
- `estimated_missing_index`
- `estimated_missing_fx`
- `estimated_long_horizon`

## Detailed Implementation Steps

## Step 1: Scaffold the repository

- Add a modern static frontend scaffold suitable for GitHub Pages.
- Add a separate `backend/` workspace for Lambda-oriented code.
- Configure `.gitignore` for local env files, build outputs, and notes.
- Configure Jekyll exclusion so non-public files do not affect Pages.

Implementation notes:

- Prefer a minimal TypeScript stack.
- Keep frontend and backend dependency trees separate.
- Ensure the public build output is the only deployed Pages artifact.

## Step 2: Define the database schema and local contracts

- Create SQL schema or migrations for the four core tables.
- Add TypeScript domain types shared conceptually across backend handlers.
- Add uniqueness constraints for idempotent daily ingestion.

Key constraints:

- unique index on `market_index_daily(symbol, trade_date)`
- unique index on `fx_daily(currency_pair, business_date)`
- unique index on `fund_nav_daily(fund_id, business_date)`
- unique index on `fund_predictions_daily(fund_id, business_date, method_version)`

## Step 3: Implement source adapters

- Build a source adapter for Yahoo `^GSPC`.
- Build a source adapter for MUFG/MURC FX data.
- Build a source adapter for the fund page or fund history source.

Adapter responsibilities:

- fetch raw content
- parse relevant values
- return normalized typed data
- preserve raw payload or raw snippets for debugging

Important design rule:

- Keep parsing logic isolated per source so markup changes are localized.

## Step 4: Implement ingestion handlers

- Write `ingest-market-data` Lambda to fetch and upsert S&P 500 and FX source data.
- Write `ingest-fund-nav` Lambda to fetch and upsert official fund NAV.
- Add date alignment helpers for US market date vs Japan business date.
- Record fetch timestamps and source dates separately.

Failure handling:

- If one source fails, persist the successful source and leave prediction recomputation to use partial inputs.
- Avoid deleting or overwriting prior successful values with nulls.

## Step 5: Implement prediction logic

- Implement the first prediction engine in `backend/src/domain/predict.ts`.
- Use previous official NAV and the relative movement implied by available upstream inputs.
- For short horizon prediction:
  - use index movement ratio
  - use TTM movement ratio
  - ignore fee drag only for near-term daily estimate
- For long horizon projection:
  - multiply by a fee adjustment factor derived from annual fee

First model shape:

- `predicted_nav = base_nav * index_ratio * fx_ratio * fee_factor`

Where:

- `base_nav` is the latest official known NAV before the target date
- `index_ratio` is derived from latest known upstream index level versus base date level
- `fx_ratio` is derived from latest known TTM versus base date TTM
- `fee_factor` defaults near `1.0` on one-day forecasts and decays for longer horizons

Important limitation:

- Because the fund benchmark is `配当込み、円換算ベース`, model version `v1` must be labeled as an approximation until validated against official NAV history.

## Step 6: Backfill and calibration path

- Add a backfill command or admin handler that imports historical official NAV and upstream data.
- Compare modeled `v1` estimates against official NAV history.
- Compute summary error metrics such as:
  - mean absolute percentage error
  - max error
  - recent 30-day error

Use calibration to decide whether a `v2` method is needed for:

- dividend-inclusive handling
- holiday carry-forward logic
- better base-date selection

## Step 7: Implement public read API

- Expose a read-only endpoint for the frontend.
- Return:
  - selected fund metadata
  - latest official NAV
  - latest upstream values
  - latest prediction
  - recent history series for charting
  - status labels and timestamps

Suggested endpoints:

- `GET /api/funds`
- `GET /api/funds/:code/latest`
- `GET /api/funds/:code/history?days=90`

## Step 8: Implement the frontend

- Build a single public page that centers the initial fund but is config-driven.
- Render the following sections:
  - latest official NAV
  - latest estimated next value
  - whether the estimate is confirmed or partial
  - upstream source cards for S&P 500 and TTM
  - short historical chart
  - model assumptions and caveats

Frontend behavior:

- distinguish visually between official and estimated values
- show source timestamps in JST
- avoid language that implies guaranteed exactness

Route strategy:

- start with `/` and optionally support `/funds/:code/`
- keep path naming generic so more funds can be added later

## Step 9: Deploy and operations

- Configure GitHub Pages deploy workflow for the frontend build only.
- Deploy Lambda handlers independently from Pages.
- Store secrets outside the repo:
  - Neon connection string
  - any API keys if later needed
- Schedule ingestion at times that match the publication windows of both data sources.

Suggested scheduling pattern:

- one morning JST run for FX and fund NAV
- one run after US market close data becomes available in Japan time
- one recomputation run after each ingestion

## Alternatives Considered

### Put all history in the repo

Rejected because:

- violates the stated requirement
- bloats git history
- makes corrections and deduplication awkward

### Use GitHub Actions as the main daily ingestion system

Rejected because:

- user explicitly does not want this
- scheduler and persistence are weaker than a dedicated backend setup

### Expose Neon directly to the browser

Rejected because:

- poor security posture for a public site
- couples frontend to database schema
- makes rate limiting and response shaping harder

### Use only static JSON regenerated on a schedule

Partially viable, but not preferred initially because:

- requires extra publication plumbing
- complicates future multi-fund filtering and query flexibility
- offers fewer operational debugging hooks than a small read API

## Risks

- Yahoo page scraping may break or be disallowed operationally.
- The exact benchmark transformation may differ materially from `^GSPC * TTM`.
- Fund NAV publication timing may create frequent partial-data windows.
- Holiday calendars between US markets and Japan banks may create misleading date joins.
- A naive fee model may be directionally right but numerically off on longer horizons.
- Neon cold starts or Lambda networking setup may complicate implementation if not kept simple.

## Test Strategy

### Unit tests

- parse Yahoo payload into normalized index record
- parse MUFG/MURC payload into TTS/TTB/TTM record
- parse fund NAV payload into normalized NAV record
- prediction math for:
  - full inputs
  - missing FX
  - missing index
  - long horizon fee adjustment

### Integration tests

- insert historical fixtures and verify idempotent upsert behavior
- compute predictions from fixture timelines
- verify public API response shape

### Manual verification

- compare latest rendered upstream values against source pages
- compare a sample of predicted values against subsequent official NAV
- verify Pages build excludes backend and notes directories

## Assumptions

- The initial scope is one fund, but the architecture should support more than one.
- AWS Lambda and Neon are acceptable deployment targets for the user.
- A TypeScript stack is acceptable for both frontend and backend.
- The public site may consume a small backend API rather than being fully self-contained.
- An approximate `v1` prediction model is acceptable as long as the UI labels it honestly.

## Open Questions

- Is Yahoo acceptable as the long-term production source for S&P 500, or should we switch to a more stable licensed/API source before implementation?
- Do you want the first public release to show only the current fund, or should fund switching UI exist from day one even with one configured fund?
- Is an approximation explicitly labeled as such acceptable for `v1`, with later calibration to reduce tracking error?
- Do you want infra defined in code in this repo, or is manual AWS/Neon setup acceptable for the first cut?

## Implementation Checklist

- [ ] Scaffold frontend and backend workspaces
- [ ] Configure GitHub Pages deployment and Jekyll exclusions
- [ ] Add database schema and DB access layer for Neon
- [ ] Implement source adapters for index, FX, and fund NAV
- [ ] Implement ingestion handlers with idempotent upserts
- [ ] Implement `v1` prediction engine with status labeling
- [ ] Implement public read API
- [ ] Build the static frontend for latest value, estimate, and history
- [ ] Add tests for parsing, prediction math, and API shape
- [ ] Document local setup, deploy flow, and model caveats in `README.md`
